"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const userId = localStorage.getItem("user_id");
    if (!userId) return;

    const { data } = await supabase
      .from("users")
      .select("avatar_url")
      .eq("id", userId)
      .single();

    setAvatarUrl(data?.avatar_url || null);
  };

  const uploadAvatar = async (file: File) => {
    try {
      setUploading(true);
      const userId = localStorage.getItem("user_id");
      if (!userId) return;

      const ext = file.name.split(".").pop();
      const filePath = `${userId}.${ext}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (error) {
        console.error(error);
        return;
      }

      const publicUrl = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath).data.publicUrl;

      await supabase
        .from("users")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      setAvatarUrl(publicUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAvatar(file);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Mon Profil</h1>

      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="avatar"
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            objectFit: "cover",
            marginBottom: 20,
          }}
        />
      ) : (
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            backgroundColor: "#333",
            marginBottom: 20,
          }}
        />
      )}

      <input type="file" accept="image/*" onChange={handleFileChange} />

      {uploading && <p>Envoi en cours...</p>}
    </div>
  );
}
