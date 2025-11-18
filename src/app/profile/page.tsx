"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import EditProfileForm from "@/components/EditProfileForm";
import Link from "next/link";

type Profile = {
  id: string;
  pseudo: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type Post = {
  id: string;
  content: string;
  game: string | null;
  likes: number;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
};

export default function ProfilePage({ params }: any) {
  const { id } = use(params) as { id: string };

  const [myId, setMyId] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setMyId(data.user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!id) return;
    loadProfile();
    loadPosts();
    loadFollowCounts();
    checkFollow();
  }, [id]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    setProfile(data || null);
  };

  const loadPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    setPosts(data || []);
  };

  const loadFollowCounts = async () => {
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", id),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", id),
    ]);

    setFollowersCount(followers || 0);
    setFollowingCount(following || 0);
  };

  const checkFollow = async () => {
    if (!myId) return;

    const { data } = await supabase
      .from("follows")
      .select("*")
      .eq("follower_id", myId)
      .eq("following_id", id);

    setIsFollowing(!!data && data.length > 0);
  };

  const handleToggleFollow = async () => {
    if (!myId) return;

    await supabase.rpc("toggle_follow", {
      p_follower: myId,
      p_following: id,
    });

    checkFollow();
    loadFollowCounts();
  };

  if (!profile) return <p>Chargement...</p>;

  return (
    <div
      style={{
        padding: "30px",
        maxWidth: "900px",
        margin: "0 auto",
        color: "white",
      }}
    >

      {/* ----------- CAPSULE HEADER ----------- */}
      <div
        style={{
          borderRadius: "18px",
          padding: "25px",
          background:
            "rgba(20, 20, 30, 0.45)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 0 35px rgba(0, 180, 255, 0.12)",
          backdropFilter: "blur(8px)",
          display: "flex",
          gap: 25,
          alignItems: "center",
          marginBottom: 30,
        }}
      >

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
              boxShadow: "0 0 20px rgba(0,150,255,0.5)",
            }}
          />
        ) : (
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "#222",
              boxShadow: "0 0 20px rgba(0,150,255,0.4)",
            }}
          />
        )}

        {/* Infos */}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 28, marginBottom: 5 }}>
            {profile.pseudo}
          </h1>

          <div style={{ opacity: 0.8, marginBottom: 8 }}>
            <Link href={`/profile/${id}/followers`} style={{ color: "#5bc0ff" }}>
              {followersCount} abonnés
            </Link>
            {" · "}
            <Link href={`/profile/${id}/following`} style={{ color: "#5bc0ff" }}>
              {followingCount} abonnements
            </Link>
          </div>

          <p style={{ opacity: 0.9 }}>{profile.bio || "Aucune bio."}</p>

          <div style={{ marginTop: 15, display: "flex", gap: 10 }}>
            {myId && myId !== id && (
              <button
                onClick={handleToggleFollow}
                style={{
                  background: isFollowing ? "#d33" : "#0a7d42",
                  color: "white",
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {isFollowing ? "Se désabonner" : "S'abonner"}
              </button>
            )}

            {myId === id && (
              <button
                onClick={() => setShowEdit(!showEdit)}
                style={{
                  background: "#005bbd",
                  color: "white",
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {showEdit ? "Fermer" : "Modifier"}
              </button>
            )}
          </div>
        </div>
      </div>

      {myId && myId === id && showEdit && (
  <EditProfileForm
    userId={myId}
    currentPseudo={profile.pseudo}
    currentBio={profile.bio}
    currentAvatar={profile.avatar_url}
    onUpdated={() => {
      loadProfile();
      setShowEdit(false);
    }}
  />
)}

      {/* ---------- POSTS ---------- */}
      <h2 style={{ marginBottom: 12, fontSize: 22 }}>Publications</h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 15,
        }}
      >
        {posts.length === 0 && (
          <p style={{ opacity: 0.8 }}>Aucune publication.</p>
        )}

        {posts.map((post) => (
          <div
            key={post.id}
            style={{
              background: "rgba(20,20,30,0.5)",
              padding: 15,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 0 15px rgba(0,150,255,0.08)",
            }}
          >
            <p>{post.content}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
