"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

type Profile = {
  id: string;
  pseudo: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export default function ProfilePage({ params }: any) {

  // 🔥 Nouvelle syntaxe Next.js 15/16
const { id } = use(params) as { id: string };


  const myId =
    typeof window !== "undefined"
      ? localStorage.getItem("user_id")
      : null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);

  // ---------------------------------------
  // Charger le profil + état follow
  // ---------------------------------------
  useEffect(() => {
    if (!id) return;
    loadProfile();
    checkFollow();
  }, [id]);

  // Charger les infos du profil
  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    setProfile(data || null);
  };

  // Vérifier si "moi" je suis "id"
  const checkFollow = async () => {
    if (!myId) return;

    const { data } = await supabase
      .from("follows")
      .select("*")
      .eq("follower_id", myId)
      .eq("following_id", id);

    setIsFollowing(!!data && data.length > 0);
  };

  // Toggle Follow / Unfollow
  const handleToggleFollow = async () => {
    if (!myId) return;

    await supabase.rpc("toggle_follow", {
      p_follower: myId,
      p_following: id,
    });

    checkFollow(); // update du bouton
  };

  // ---------------------------------------
  // Render
  // ---------------------------------------
  if (!profile) return <p>Profil introuvable</p>;

  return (
    <div style={{ padding: "20px", maxWidth: "650px", margin: "0 auto" }}>
      <h1>{profile.pseudo}</h1>

      {/* Avatar */}
      {profile.avatar_url ? (
        <Image
          src={profile.avatar_url}
          alt="avatar"
          width={120}
          height={120}
          style={{
            borderRadius: "50%",
            objectFit: "cover",
            marginBottom: "10px",
          }}
        />
      ) : (
        <div
          style={{
            width: 120,
            height: 120,
            background: "#333",
            borderRadius: "50%",
            marginBottom: "10px",
          }}
        ></div>
      )}

      <p>{profile.bio || "Aucune bio."}</p>

      {/* Bouton follow si on regarde le profil d'un autre */}
      {myId !== id && (
        <button
          onClick={handleToggleFollow}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            background: isFollowing ? "red" : "green",
            color: "white",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
          }}
        >
          {isFollowing ? "Se désabonner" : "S'abonner"}
        </button>
      )}
    </div>
  );
}
