"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import { supabaseBrowser } from "@/utils/supabaseClient";
import { useEffect, useState } from "react";

const supabase = supabaseBrowser();

export default function ProfilePage() {
  return (
    <AuthGuard>
   <ProfileContent />
</AuthGuard>

  );
}



function ProfileContent() {
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const user_id = localStorage.getItem("user_id");
    if (!user_id) return;

    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", user_id)
      .single();

    setUserInfo(data);
  };

  if (!userInfo) return <p className="p-6">Chargement du profil...</p>;

  return (
    <div className="max-w-xl mx-auto pt-10 pb-16">
      <h1 className="text-3xl font-bold mb-6">Mon Profil</h1>

      <div className="p-4 border rounded-lg bg-white shadow-sm">
        <p><strong>Pseudo :</strong> {userInfo.pseudo}</p>
        <p><strong>Email :</strong> {userInfo.email}</p>
        <p><strong>ID :</strong> {userInfo.id}</p>

        <div className="mt-6">
          <button
            className="bg-black text-white px-4 py-2 rounded"
            onClick={async () => {
              await supabase.auth.signOut();
              localStorage.clear();
              window.location.href = "/login";
            }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
