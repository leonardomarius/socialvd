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

  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // 🔐 Récupérer l'utilisateur connecté
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setMyId(data.user?.id || null);
    };
    getUser();
  }, []);

  // Charger toutes les données du profil
  useEffect(() => {
    if (!id) return;
    loadProfile();
    loadUserPosts();
    checkFollow();
    loadFollowCounts();
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

  // Charger les posts du user
  const loadUserPosts = async () => {
    setLoadingPosts(true);

    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    setUserPosts(data || []);
    setLoadingPosts(false);
  };

  // Followers / Following Count
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

  // Vérifier si je suis déjà abonné
  const checkFollow = async () => {
    if (!myId) return;

    const { data } = await supabase
      .from("follows")
      .select("*")
      .eq("follower_id", myId)
      .eq("following_id", id);

    setIsFollowing(!!data && data.length > 0);
  };

  // Suivre / Se désabonner
  const handleToggleFollow = async () => {
    if (!myId) return;

    await supabase.rpc("toggle_follow", {
      p_follower: myId,
      p_following: id,
    });

    checkFollow();
    loadFollowCounts();
  };

  if (!profile) return <p>Profil introuvable...</p>;

  return (
    <>
      {/* 🔥 FOND SPATIAL */}
      <div className="profile-background"></div>

      {/* CONTENU DU PROFIL */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "20px",
          maxWidth: "750px",
          margin: "0 auto",
        }}
      >
        {/* HEADER PROFIL */}
        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center",
            marginBottom: 20,
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
              }}
            />
          ) : (
            <div
              style={{
                width: 120,
                height: 120,
                background: "#333",
                borderRadius: "50%",
              }}
            ></div>
          )}

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 24, marginBottom: 4 }}>{profile.pseudo}</h1>

            {/* Followers / Following */}
            <p style={{ color: "#999", marginBottom: 8 }}>
              <Link
                href={`/profile/${id}/followers`}
                style={{ color: "#4aa3ff", textDecoration: "none" }}
              >
                {followersCount} abonnés
              </Link>

              {" · "}

              <Link
                href={`/profile/${id}/following`}
                style={{ color: "#4aa3ff", textDecoration: "none" }}
              >
                {followingCount} abonnements
              </Link>
            </p>

            <p>{profile.bio || "Aucune bio."}</p>

            {/* Actions */}
            <div style={{ marginTop: 15, display: "flex", gap: 10 }}>
              {myId && myId !== id && (
                <button
                  onClick={handleToggleFollow}
                  style={{
                    padding: "8px 16px",
                    background: isFollowing ? "red" : "green",
                    color: "white",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {isFollowing ? "Se désabonner" : "S'abonner"}
                </button>
              )}

              {myId && myId === id && (
                <button
                  onClick={() => setShowEdit(!showEdit)}
                  style={{
                    padding: "8px 16px",
                    background: "#0070f3",
                    color: "white",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {showEdit ? "Fermer" : "Modifier mon profil"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* FORMULAIRE D'ÉDITION (avec fix myId) */}
        {myId && myId === id && showEdit && (
          <EditProfileForm
            userId={myId}
            currentPseudo={profile.pseudo}
            currentBio={profile.bio}
            currentAvatar={profile.avatar_url}
            onUpdated={() => {
              setShowEdit(false);
              loadProfile();
            }}
          />
        )}

        {/* POSTS DU USER */}
        <section style={{ marginTop: 30 }}>
          <h2 style={{ fontSize: 20, marginBottom: 10 }}>Publications</h2>

          {loadingPosts ? (
            <p>Chargement...</p>
          ) : userPosts.length === 0 ? (
            <p>Pas encore de post.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {userPosts.map((post) => (
                <article
                  key={post.id}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #333",
                    background: "#111",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                      fontSize: 12,
                      color: "#aaa",
                    }}
                  >
                    <span>{post.game || "Jeu non précisé"}</span>
                    <span>
                      {new Date(post.created_at).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>

                  <p style={{ marginBottom: 6 }}>{post.content}</p>

                  {post.media_type === "image" && (
                    <img
                      src={post.media_url!}
                      alt="post media"
                      style={{
                        width: "100%",
                        borderRadius: 10,
                        marginTop: 10,
                        marginBottom: 10,
                      }}
                    />
                  )}

                  {post.media_type === "video" && (
                    <video
                      src={post.media_url!}
                      controls
                      style={{
                        width: "100%",
                        borderRadius: 10,
                        marginTop: 10,
                        marginBottom: 10,
                      }}
                    ></video>
                  )}

                  <p style={{ fontSize: 12, color: "#777" }}>
                    👍 {post.likes ?? 0} like(s)
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
