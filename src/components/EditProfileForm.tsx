"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { isCS2Account } from "@/lib/cs2-utils";

/* ---------------------------------------------
   Types
--------------------------------------------- */
type EditProfileFormProps = {
  userId: string;
  currentPseudo: string | null;
  currentBio: string | null; // mindset stocké dans bio
  currentAvatar: string | null;
  onUpdated: () => void;
};

type Performance = {
  id: string;
  user_id: string;
  game_name: string;
  performance_title: string;
  performance_value: string | null;
};

type GameAccount = {
  id: string;
  user_id: string;
  game: string;
  username: string;
  platform: string | null;
  verified: boolean;
};

/* ---------------------------------------------
   Component
--------------------------------------------- */
export default function EditProfileForm({
  userId,
  currentPseudo,
  currentBio,
  currentAvatar,
  onUpdated,
}: EditProfileFormProps) {
  const router = useRouter();
  const [pseudo, setPseudo] = useState(currentPseudo || "");

  // 🔥 REMPLACEMENT — bio → mindset
  const [mindset, setMindset] = useState(currentBio || "");

  const [avatarUrl, setAvatarUrl] = useState(currentAvatar || null);
  const [uploading, setUploading] = useState(false);

  // performances (verified only)
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [loadingPerf, setLoadingPerf] = useState(true);

  /* ---------------------------------------------
     GAME ACCOUNTS — STATES (READ-ONLY)
  --------------------------------------------- */
  const [gameAccounts, setGameAccounts] = useState<GameAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  /* ---------------------------------------------
     Load performances (verified only)
  --------------------------------------------- */
  async function loadPerformances() {
    setLoadingPerf(true);
    
    try {
      // Load verified performances from latest_game_performances_verified view
      const { data: verifiedData, error: verifiedError } = await supabase
        .from("latest_game_performances_verified")
        .select("*")
        .eq("user_id", userId);

      if (verifiedError) {
        console.error("Error loading verified performances:", verifiedError);
        setPerformances([]);
        setLoadingPerf(false);
        return;
      }

      // Récupérer les noms de jeux pour les game_id trouvés
      const gameIds = verifiedData?.map(r => r.game_id).filter(Boolean) || [];
      const gameMap: Record<string, string> = {};
      
      if (gameIds.length > 0) {
        const { data: gamesData } = await supabase
          .from("games")
          .select("id, slug, name")
          .in("id", gameIds);
        
        if (gamesData) {
          for (const game of gamesData) {
            gameMap[game.id] = game.name || game.slug || "Unknown";
          }
        }
      }

      // Parser les performances vérifiées
      const verifiedPerformances: Performance[] = [];
      
      if (verifiedData && verifiedData.length > 0) {
        for (const row of verifiedData) {
          const gameName = gameMap[row.game_id] || "Unknown";
          
          // Parser le champ stats (JSON)
          let statsData: any = null;
          try {
            if (typeof row.stats === 'string') {
              statsData = JSON.parse(row.stats);
            } else {
              statsData = row.stats;
            }
          } catch (e) {
            console.warn("Failed to parse stats JSON:", e, row.stats);
            continue;
          }

          if (statsData && typeof statsData === 'object') {
            if (statsData.title && statsData.value !== undefined) {
              verifiedPerformances.push({
                id: row.id || `verified-${row.user_id}-${row.game_id}`,
                user_id: row.user_id,
                game_name: gameName,
                performance_title: statsData.title,
                performance_value: statsData.value !== null ? String(statsData.value) : null,
              });
            } else if (Array.isArray(statsData)) {
              for (const stat of statsData) {
                if (stat && stat.title && stat.value !== undefined) {
                  verifiedPerformances.push({
                    id: `${row.id}-${stat.title}`,
                    user_id: row.user_id,
                    game_name: gameName,
                    performance_title: stat.title,
                    performance_value: stat.value !== null ? String(stat.value) : null,
                  });
                }
              }
            }
          }
        }
      }

      setPerformances(verifiedPerformances);
    } catch (error) {
      console.error("Error in loadPerformances:", error);
      setPerformances([]);
    } finally {
      setLoadingPerf(false);
    }
  }

  useEffect(() => {
    loadPerformances();
    loadGameAccounts();
  }, []);

  /* ---------------------------------------------
     Load game accounts (from game_account_links)
  --------------------------------------------- */
  async function loadGameAccounts() {
    setLoadingAccounts(true);
    
    try {
      const { data: links, error } = await supabase
        .from("game_account_links")
        .select(`
          id,
          provider,
          external_account_id,
          username,
          linked_at,
          game_id,
          games (
            id,
            name,
            slug
          )
        `)
        .eq("user_id", userId)
        .is("revoked_at", null)
        .order("linked_at", { ascending: false });

      console.log("[loadGameAccounts] Response - data:", links, "error:", error);

      if (links !== null && links !== undefined) {
        const accounts: GameAccount[] = (links || []).map((link: any) => ({
          id: link.id,
          user_id: userId,
          game: link.games?.name || link.games?.slug || "Unknown",
          username: link.username || link.external_account_id,
          platform: link.provider === "steam" ? "Steam" : link.provider || null,
          verified: link.provider === "steam",
        }));
        setGameAccounts(accounts);
        if (error && (error.message || error.code)) {
          console.warn("[loadGameAccounts] Warning (data still processed):", error);
        }
      } else if (error && (error.message || error.code)) {
        console.error("[loadGameAccounts] Error loading game accounts:", error);
        setGameAccounts([]);
      } else {
        setGameAccounts([]);
      }
    } catch (error) {
      console.error("[loadGameAccounts] Exception in loadGameAccounts:", error);
      setGameAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  }

  /* ---------------------------------------------
     Upload avatar
  --------------------------------------------- */
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);
    } catch (error) {
      console.error("Avatar upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  /* ---------------------------------------------
     Save profile
  --------------------------------------------- */
  const handleSave = async () => {
    const trimmedMindset = mindset.trim();

    // 🔥 AJOUT — validation mindset
    if (trimmedMindset.length < 3) {
      alert("Your mindset must be at least 3 characters long.");
      return;
    }
    if (trimmedMindset.length > 80) {
      alert("Your mindset must be shorter than 80 characters.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        pseudo,
        bio: trimmedMindset, // 🔥 SAVED CLEAN
        avatar_url: avatarUrl,
      })
      .eq("id", userId);

    if (!error) {
      alert("Profile updated!");
      onUpdated();
    }
  };



  /* ---------------------------------------------
     UI
  --------------------------------------------- */
  return (
    <div
      style={{
        marginTop: "20px",
        padding: "24px",
        borderRadius: "16px",
        background:
          "linear-gradient(135deg, rgba(12,12,22,0.85), rgba(8,8,14,0.95))",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 0 22px rgba(0,0,0,0.4)",
      }}
    >
      <h2 style={{ marginBottom: 16 }}>Profile settings</h2>

      {/* Avatar */}
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt="avatar"
          width={120}
          height={120}
          style={{ borderRadius: "50%", marginBottom: 10 }}
        />
      ) : (
        <div
          style={{
            width: 120,
            height: 120,
            background: "#333",
            borderRadius: "50%",
            marginBottom: 10,
          }}
        ></div>
      )}

      {/* Avatar button */}
      <div style={{ marginBottom: 20 }}>
        <label
          htmlFor="avatarUpload"
          style={{
            display: "inline-block",
            padding: "10px 18px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 10,
            cursor: "pointer",
            color: "#dce5ff",
            fontSize: "0.9rem",
            transition: "all 0.25s ease",
          }}
        >
          {uploading ? "Uploading..." : "Change avatar"}
        </label>

        <input
          id="avatarUpload"
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          style={{ display: "none" }}
        />
      </div>

      {/* Username */}
      <div style={{ marginTop: 20 }}>
        <label>Username</label>
        <input
          type="text"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          style={inputField}
        />
      </div>

      {/* 🔥 Mindset */}
      <div style={{ marginTop: 20 }}>
        <label>Mindset</label>
        <textarea
          value={mindset}
          onChange={(e) => setMindset(e.target.value)}
          placeholder='Ex: "Grind now. Glory later."'
          style={{ ...inputField, height: 80 }}
        />
      </div>

      <button onClick={handleSave} style={saveBtn}>
        Save
      </button>

      <h2 style={{ marginTop: 40 }}>Verified performances</h2>

      {/* Verified performances display (read-only) */}
      {loadingPerf ? (
        <p style={{ opacity: 0.7, marginTop: 20 }}>Loading...</p>
      ) : performances.length === 0 ? (
        <p style={{ opacity: 0.7, marginTop: 20 }}>
          No verified performances yet. Connect your game accounts to sync stats automatically.
        </p>
      ) : (
        <div
          style={{
            marginTop: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {performances.map((p) => (
            <div key={p.id} style={perfCard}>
              <strong style={{ fontSize: 16 }}>{p.game_name}</strong>
              <p>{p.performance_title}</p>
              {p.performance_value && (
                <p style={{ opacity: 0.7 }}>{p.performance_value}</p>
              )}
              <div style={{ 
                marginTop: 10, 
                fontSize: 12, 
                color: "rgba(80, 200, 120, 0.9)",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 6
              }}>
                <span style={{ fontSize: 14 }}>✓</span>
                <span>Verified • Official API Data</span>
              </div>
            </div>
          ))}
        </div>
      )}


      {/* GAME ACCOUNTS */}
      <h2 style={{ marginTop: 40 }}>Game accounts</h2>

      {/* CS2 Status (if connected) */}
      {gameAccounts.some((acc) => isCS2Account(acc.game)) && (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "rgba(80, 200, 120, 0.1)",
              border: "1px solid rgba(80, 200, 120, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>✓</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: "rgba(80, 200, 120, 0.9)" }}>
                CS2 stats synchronisées automatiquement
              </p>
              <p style={{ fontSize: 12, opacity: 0.7, margin: "4px 0 0 0" }}>
                Synchronisation automatique après connexion et toutes les 12 heures
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connect your stats button - ALWAYS VISIBLE */}
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => router.push("/profile/stats")}
          style={{
            ...saveBtn,
            background: "rgba(80,120,255,0.85)",
            cursor: "pointer",
            opacity: 1,
          }}
        >
          Connect your stats
        </button>
        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
          Connect your game accounts to sync stats automatically
        </p>
      </div>

      {/* Display all game accounts (read-only) */}
      {loadingAccounts ? (
        <p style={{ opacity: 0.7, marginTop: 20 }}>Loading game accounts...</p>
      ) : gameAccounts.length === 0 ? (
        <p style={{ opacity: 0.6, marginTop: 10 }}>
          No game accounts connected yet. Use the "Connect your stats" button above to link your game accounts.
        </p>
      ) : (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {gameAccounts.map((acc) => (
            <div
              key={acc.id}
              style={{
                ...perfCard,
                opacity: 0.8,
                borderColor: isCS2Account(acc.game) 
                  ? "rgba(80, 200, 120, 0.3)" 
                  : "rgba(255,255,255,0.07)",
              }}
            >
              <div>
                <strong>{acc.game}</strong>
                <p style={{ margin: "4px 0", opacity: 0.8 }}>Username: {acc.username}</p>
                <p style={{ margin: "4px 0", opacity: 0.8 }}>Platform: {acc.platform || (isCS2Account(acc.game) ? "Steam" : "N/A")}</p>
                {isCS2Account(acc.game) ? (
                  <p style={{ 
                    margin: "4px 0", 
                    fontSize: 12, 
                    color: "rgba(80, 200, 120, 0.9)",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}>
                    <span style={{ fontSize: 14 }}>✓</span>
                    <span>Verified • Official Steam Data</span>
                  </p>
                ) : (
                  <p style={{ 
                    margin: "4px 0", 
                    fontSize: 12, 
                    color: acc.verified ? "rgba(80, 200, 120, 0.9)" : "rgba(255, 200, 80, 0.9)",
                    fontWeight: 500,
                  }}>
                    {acc.verified ? "✓ Verified" : "⚠ Not verified"}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ opacity: 0.6, marginTop: 10, fontSize: 12 }}>
        Game accounts are managed through the Stats Hub. Connect your accounts to sync stats automatically.
      </p>
    </div>
  );
}

/* ---------------------------------------------
   Styles
--------------------------------------------- */

const inputField: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  borderRadius: 10,
  background: "hsla(240, 1%, 29%, 0.40)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "white",
};

const saveBtn: React.CSSProperties = {
  marginTop: 16,
  padding: "10px 18px",
  background: "rgba(80,120,255,0.85)",
  color: "white",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 15,
};

const perfCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 12,
  background: "linear-gradient(135deg, rgba(10,10,18,0.9), rgba(6,6,10,0.92))",
  border: "1px solid rgba(255,255,255,0.07)",
  boxShadow: "0 0 14px rgba(0,0,0,0.4)",
};
