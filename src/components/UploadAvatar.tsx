"use client";

import { supabase } from "@/lib/supabase";
import { useState } from "react";

export default function UploadAvatar({ userId }: { userId: string }) {
  const [uploading, setUploading] = useState(false);

  async function uploadAvatar(e: any) {
    const file = e.target.files[0];
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
    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    setUploading(false);
    alert("Photo mise à jour !");

    // Recharger la page pour afficher la nouvelle image
    window.location.reload();
  }

  return (
    <label className="cursor-pointer inline-block bg-gray-200 px-3 py-2 mt-3 rounded">
      {uploading ? "Chargement..." : "Changer ma photo"}
      <input type="file" onChange={uploadAvatar} className="hidden" />
    </label>
  );
}
