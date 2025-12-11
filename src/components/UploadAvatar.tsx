"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export default function UploadAvatar({ userId }: { userId: string }) {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Charger l'avatar actuel (y compris l'avatar par défaut SQL)
  useEffect(() => {
    const loadAvatar = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .single();

      if (!error && data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    };

    loadAvatar();
  }, [userId]);

  // Upload d’un nouvel avatar
  async function uploadAvatar(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const ext = file.name.split(".").pop();
    const filePath = `${userId}.${ext}`;

    // Upload dans Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      alert("Erreur upload : " + uploadError.message);
      setUploading(false);
      return;
    }

    // Obtenir l’URL publique du fichier
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    // Mise à jour dans la table profiles
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    if (updateError) {
      alert("Erreur mise à jour : " + updateError.message);
      setUploading(false);
      return;
    }

    setAvatarUrl(publicUrl);
    setUploading(false);
  }

  return (
    <div className="flex flex-col items-center gap-3 mt-3">

      {/* Affichage de l’avatar actuel (ou défaut SQL) */}
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt="avatar"
          className="w-24 h-24 rounded-full object-cover border shadow"
        />
      )}

      {/* Bouton upload */}
      <label className="cursor-pointer inline-block bg-gray-200 px-3 py-2 rounded hover:bg-gray-300 transition">
        {uploading ? "Chargement..." : "Changer ma photo"}
        <input type="file" onChange={uploadAvatar} className="hidden" />
      </label>
    </div>
  );
}
