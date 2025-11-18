"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

type EditProfileFormProps = {
  userId: string;
  currentPseudo: string | null;
  currentBio: string | null;
  currentAvatar: string | null;
  onUpdated: () => void; // callback pour recharger la page
};

export default function EditProfileForm({
  userId,
  currentPseudo,
  currentBio,
  currentAvatar,
  onUpdated,
}: EditProfileFormProps) {

  const [pseudo, setPseudo] = useState(currentPseudo || "");
  const [bio, setBio] = useState(currentBio || "");
  const [avatarUrl, setAvatarUrl] = useState(currentAvatar || null);
  const [uploading, setUploading] = useState(false);

  // ---------------------------------------------
  // 🔥 Upload avatar dans Supabase Storage
  // ---------------------------------------------
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload dans le bucket "avatars"
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Récupérer l'URL publique
      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);

    } catch (error) {
      console.error("Erreur upload avatar:", error);
    } finally {
      setUploading(false);
    }
  };

  // ---------------------------------------------
  // 🔥 Sauvegarde pseudo + bio + avatar_url
  // ---------------------------------------------
  const handleSave = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({
        pseudo,
        bio,
        avatar_url: avatarUrl,
      })
      .eq("id", userId);

    if (!error) {
      alert("Profil mis à jour !");
      onUpdated(); // on recharge le parent (page profil)
    } else {
      console.error(error);
    }
  };

  return (
    <div
      style={{
        marginTop: "20px",
        padding: "20px",
        border: "1px solid #ccc",
        borderRadius: 8,
      }}
    >
      <h2>Modifier mon profil</h2>

      {/* Avatar Preview */}
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

      <input type="file" onChange={handleAvatarUpload} />
      {uploading && <p>Upload en cours...</p>}

      <div style={{ marginTop: 15 }}>
        <label>Pseudo :</label>
        <input
          type="text"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            marginTop: 5,
            padding: 8,
          }}
        />
      </div>

      <div style={{ marginTop: 15 }}>
        <label>Bio :</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          style={{
            display: "block",
            width: "100%",
            marginTop: 5,
            padding: 8,
          }}
        />
      </div>

      <button
        onClick={handleSave}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          background: "blue",
          color: "white",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
        }}
      >
        Enregistrer
      </button>
    </div>
  );
}
