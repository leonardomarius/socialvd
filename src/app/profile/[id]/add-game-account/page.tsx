"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isCS2Account } from "@/lib/cs2-utils";

export default function AddGameAccountPage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;

  const [game, setGame] = useState("apex");
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("psn");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setMyId(data.user?.id || null);
    };
    getUser();
  }, []);

  // Génère un code unique type SV-123456
  const generateVerificationCode = () => {
    const random = Math.floor(100000 + Math.random() * 900000);
    return `SV-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!myId) {
      setErrorMsg("Vous devez être connecté pour ajouter un compte.");
      return;
    }

    // CS2 accounts cannot be added manually - they must be synced via backend
    if (isCS2Account(game)) {
      setErrorMsg("CS2 accounts must be connected via Steam. CS2 accounts are managed automatically through the backend sync.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const verificationCode = generateVerificationCode();

    const { error } = await supabase.from("game_accounts").insert({
      user_id: myId,
      game,
      username,
      platform,
      verified: false,
      verification_code: verificationCode,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);

    // Retour au profil
    router.push(`/profile/${profileId}`);
  };

  return (
    <div
      style={{
        maxWidth: 450,
        margin: "40px auto",
        padding: 20,
        borderRadius: 10,
        border: "1px solid #222",
        background: "#050505",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>
        Ajouter un compte de jeu
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {/* Choix du jeu */}
        <div>
          <label>Jeu</label>
          <select
            value={game}
            onChange={(e) => setGame(e.target.value)}
            style={{
              width: "100%",
              marginTop: 4,
              padding: 8,
              background: "#111",
              color: "#fff",
              borderRadius: 6,
              border: "1px solid #333",
            }}
          >
            <option value="apex">Apex Legends</option>
            <option value="fortnite">Fortnite</option>
            <option value="gta">GTA Online</option>
            <option value="valorant">Valorant</option>
            <option value="cod">Call of Duty</option>
            {/* CS2 is not available - synced automatically */}
          </select>
          <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            Note: CS2 accounts are synced automatically from Steam and cannot be added manually.
          </p>
        </div>

        {/* Pseudo */}
        <div>
          <label>Pseudo en jeu</label>
          <input
            type="text"
            placeholder="Ton pseudo exact"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{
              width: "100%",
              marginTop: 4,
              padding: 8,
              background: "#111",
              color: "#fff",
              borderRadius: 6,
              border: "1px solid #333",
            }}
          />
        </div>

        {/* Plateforme */}
        <div>
          <label>Plateforme</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            style={{
              width: "100%",
              marginTop: 4,
              padding: 8,
              background: "#111",
              color: "#fff",
              borderRadius: 6,
              border: "1px solid #333",
            }}
          >
            <option value="psn">PlayStation</option>
            <option value="xbl">Xbox</option>
            <option value="steam">Steam</option>
            <option value="epic">Epic Games</option>
            <option value="origin">Origin</option>
          </select>
        </div>

        {/* Erreur */}
        {errorMsg && (
          <p style={{ color: "red", fontSize: 14 }}>{errorMsg}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 10,
            padding: "10px 16px",
            background: "#0070f3",
            color: "white",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Ajout en cours..." : "Ajouter ce compte"}
        </button>
      </form>
    </div>
  );
}
