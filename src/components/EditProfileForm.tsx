"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

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
  const [pseudo, setPseudo] = useState(currentPseudo || "");

  // 🔥 REMPLACEMENT — bio → mindset
  const [mindset, setMindset] = useState(currentBio || "");

  const [avatarUrl, setAvatarUrl] = useState(currentAvatar || null);
  const [uploading, setUploading] = useState(false);

  // performances
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [loadingPerf, setLoadingPerf] = useState(true);

  const [gameName, setGameName] = useState("");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGameName, setEditGameName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editValue, setEditValue] = useState("");

  /* ---------------------------------------------
     GAME ACCOUNTS — STATES
  --------------------------------------------- */
  const [accGame, setAccGame] = useState("");
  const [accUsername, setAccUsername] = useState("");
  const [accPlatform, setAccPlatform] = useState("PlayStation");

  /* ---------------------------------------------
     Load performances
  --------------------------------------------- */
  async function loadPerformances() {
    setLoadingPerf(true);
    const { data } = await supabase
      .from("game_performances")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setPerformances((data || []) as Performance[]);
    setLoadingPerf(false);
  }

  useEffect(() => {
    loadPerformances();
  }, []);

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
     Add performance
  --------------------------------------------- */
  const handleAddPerformance = async (e: any) => {
    e.preventDefault();
    setAdding(true);

    if (performances.length >= 4) {
      alert("You can only add up to 4 performances.");
      setAdding(false);
      return;
    }

    const { error } = await supabase.from("game_performances").insert({
      user_id: userId,
      game_name: gameName,
      performance_title: title,
      performance_value: value,
    });

    setAdding(false);

    if (!error) {
      setGameName("");
      setTitle("");
      setValue("");
      loadPerformances();
    }
  };

  /* ---------------------------------------------
     Delete performance
  --------------------------------------------- */
  const deletePerformance = async (id: string) => {
    const ok = confirm("Delete this performance?");
    if (!ok) return;

    await supabase.from("game_performances").delete().eq("id", id);

    loadPerformances();
  };

  /* ---------------------------------------------
     Edit performance
  --------------------------------------------- */
  const startEdit = (p: Performance) => {
    setEditingId(p.id);
    setEditGameName(p.game_name);
    setEditTitle(p.performance_title);
    setEditValue(p.performance_value || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const { error } = await supabase
      .from("game_performances")
      .update({
        game_name: editGameName,
        performance_title: editTitle,
        performance_value: editValue,
      })
      .eq("id", editingId);

    if (!error) {
      setEditingId(null);
      loadPerformances();
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
      <h2 style={{ marginBottom: 16 }}>Edit my profile</h2>

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

{/* --- ADD PERFORMANCE FORM --- */}
<form onSubmit={handleAddPerformance} style={addBox}>
  <div style={{ marginBottom: 10 }}>
    <label>Game</label>
    <input
      type="text"
      value={gameName}
      onChange={(e) => setGameName(e.target.value)}
      required
      style={inputField}
    />
  </div>

  <div style={{ marginBottom: 10 }}>
    <label>Performance</label>
    <input
      type="text"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      required
      style={inputField}
    />
  </div>

  <div style={{ marginBottom: 10 }}>
    <label>Details (optional)</label>
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={inputField}
    />
  </div>

  <button
    type="submit"
    disabled={adding}
    style={saveBtn}
  >
    {adding ? "Adding..." : "Add performance"}
  </button>
</form>

{/* --- LIST EXISTING PERFORMANCES --- */}
<div
  style={{
    marginTop: 30,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }}
>
  {performances.length === 0 && (
    <p style={{ opacity: 0.7 }}>No performance yet.</p>
  )}

  {performances.map((p) => (
    <div key={p.id} style={perfCard}>
      {editingId !== p.id ? (
        <>
          <strong style={{ fontSize: 16 }}>{p.game_name}</strong>
          <p>{p.performance_title}</p>
          {p.performance_value && (
            <p style={{ opacity: 0.7 }}>{p.performance_value}</p>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={() => startEdit(p)} style={btnIcon}>✏</button>
            <button onClick={() => deletePerformance(p.id)} style={btnDelete}>🗑</button>
          </div>
        </>
      ) : (
        <>
          <input
            value={editGameName}
            onChange={(e) => setEditGameName(e.target.value)}
            style={inputField}
          />

          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            style={inputField}
          />

          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            style={inputField}
          />

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={saveEdit} style={saveBtn}>
              Save
            </button>
            <button
              onClick={() => setEditingId(null)}
              style={cancelBtn}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  ))}
</div>


      {/* GAME ACCOUNTS */}
      <h2 style={{ marginTop: 40 }}>Game accounts</h2>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginTop: "15px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <input
          placeholder="Game"
          value={accGame}
          onChange={(e) => setAccGame(e.target.value)}
          style={{
            ...inputField,
            flex: "1",
            minWidth: "120px",
          }}
        />

        <input
          placeholder="Username"
          value={accUsername}
          onChange={(e) => setAccUsername(e.target.value)}
          style={{
            ...inputField,
            flex: "1",
            minWidth: "120px",
          }}
        />

        <select
          value={accPlatform}
          onChange={(e) => setAccPlatform(e.target.value)}
          style={{
            ...inputField,
            flex: "1",
            minWidth: "120px",
            height: "44px",
            cursor: "pointer",
          }}
        >
          <option value="PlayStation">PlayStation</option>
          <option value="Xbox">Xbox</option>
          <option value="Steam">Steam</option>
          <option value="EA (Origin)">EA (Origin)</option>
        </select>

        <button
          onClick={async () => {
            if (!accGame || !accUsername) {
              alert("Game and username are required.");
              return;
            }

            await supabase.from("game_accounts").insert({
              user_id: userId,
              game: accGame,
              username: accUsername,
              platform: accPlatform,
              verified: false,
            });

            setAccGame("");
            setAccUsername("");
            setAccPlatform("PlayStation");

            alert("Account successfully registered in your game accounts.");
          }}
          style={{
            padding: "10px 16px",
            background: "rgba(80,120,255,0.85)",
            border: "none",
            color: "white",
            borderRadius: 10,
            cursor: "pointer",
            minWidth: "90px",
          }}
        >
          Add
        </button>
      </div>

      <p style={{ opacity: 0.6, marginTop: 10 }}>
        Your game accounts are successfully stored.
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

const cancelBtn: React.CSSProperties = {
  padding: "10px 18px",
  background: "rgba(90,90,90,0.25)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "white",
  borderRadius: 10,
  cursor: "pointer",
};

const addBox: React.CSSProperties = {
  padding: 20,
  marginTop: 10,
  background: "rgba(0,0,0,0.35)",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 0 16px rgba(0,0,0,0.3)",
};

const perfCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 12,
  background: "linear-gradient(135deg, rgba(10,10,18,0.9), rgba(6,6,10,0.92))",
  border: "1px solid rgba(255,255,255,0.07)",
  boxShadow: "0 0 14px rgba(0,0,0,0.4)",
};

const btnIcon: React.CSSProperties = {
  padding: "4px 10px",
  background: "rgba(255,255,255,0.06)",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.15)",
  cursor: "pointer",
  color: "white",
};

const btnDelete: React.CSSProperties = {
  padding: "4px 10px",
  background: "rgba(160,0,30,0.85)",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.15)",
  cursor: "pointer",
  color: "white",
};
