"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import EditProfileForm from "@/components/EditProfileForm";
import Link from "next/link";
import MateButton from "@/components/MateButton";

// 🔥 AJOUT — IMPORT
import MateSessionButton from "@/components/MateSessionButton";

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

type GameAccount = {
  id: string;
  game: string;
  username: string;
  platform: string | null;
  verified: boolean;
  verification_code: string | null;
};

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [myId, setMyId] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [matesCount, setMatesCount] = useState(0);

  const [gameAccounts, setGameAccounts] = useState<GameAccount[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editGame, setEditGame] = useState("apex");
  const [editUsername, setEditUsername] = useState("");
  const [editPlatform, setEditPlatform] = useState("psn");
  const [savingEdit, setSavingEdit] = useState(false);

  // Load current user
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setMyId(data.user?.id || null);
    };
    getUser();
  }, []);

  // Load all profile-related data
  useEffect(() => {
    if (!id) return;
    loadProfile();
    loadUserPosts();
    loadFollowCounts();
    loadGameAccounts();
    checkFollow();
    loadMatesCount();
  }, [id, myId]);

  // Profile
  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    setProfile(data || null);
  };

  // Posts
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

  // Game accounts
  const loadGameAccounts = async () => {
    setLoadingGames(true);

    const { data } = await supabase
      .from("game_accounts")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    setGameAccounts((data as GameAccount[]) || []);
    setLoadingGames(false);
  };

  // Follows count
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

  // Load Mate count
  const loadMatesCount = async () => {
    const { count } = await supabase
      .from("mates")
      .select("*", { count: "exact", head: true })
      .or(`user1_id.eq.${id},user2_id.eq.${id}`);

    setMatesCount(count || 0);
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

  // Follow toggle
  const handleToggleFollow = async () => {
    if (!myId) return;

    await supabase.rpc("toggle_follow", {
      p_follower: myId,
      p_following: id,
    });

    checkFollow();
    loadFollowCounts();
  };

  // DM creation
  const handleStartConversation = async () => {
    if (!myId || !id) {
      alert("Erreur : utilisateur non chargé.");
      return;
    }

    try {
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({ created_at: new Date().toISOString() })
        .select("id")
        .single();

      if (convErr || !newConv) {
        alert("Erreur création conversation :" + convErr?.message);
        return;
      }

      const convId = newConv.id as string;

      await supabase.from("conversations_users").insert([
        { conversation_id: convId, user_id: myId },
        { conversation_id: convId, user_id: id },
      ]);

      router.push(`/messages/${convId}`);
    } catch (error: any) {
      alert("Erreur : " + error?.message);
    }
  };

  // ⭐ FIX : missing function re-added
  const markAccountVerified = async (accountId: string) => {
    if (!myId) return;

    const { error } = await supabase
      .from("game_accounts")
      .update({ verified: true })
      .eq("id", accountId)
      .eq("user_id", myId);

    if (error) {
      alert("Erreur lors de la vérification : " + error.message);
      return;
    }

    loadGameAccounts();
  };

  // Game account editing
  const startEditAccount = (acc: GameAccount) => {
    setEditingAccountId(acc.id);
    setEditGame(acc.game);
    setEditUsername(acc.username);
    setEditPlatform(acc.platform || "psn");
  };

  const cancelEditAccount = () => {
    setEditingAccountId(null);
    setSavingEdit(false);
  };

  const saveEditAccount = async () => {
    if (!editingAccountId) return;

    setSavingEdit(true);

    const { error } = await supabase
      .from("game_accounts")
      .update({
        game: editGame,
        username: editUsername,
        platform: editPlatform,
      })
      .eq("id", editingAccountId)
      .eq("user_id", myId);

    setSavingEdit(false);

    if (error) {
      alert("Erreur : " + error.message);
      return;
    }

    setEditingAccountId(null);
    loadGameAccounts();
  };

  const deleteAccount = async (accountId: string) => {
    const confirmDelete = window.confirm(
      "Supprimer ce compte de jeu ? Action définitive."
    );
    if (!confirmDelete) return;

    await supabase
      .from("game_accounts")
      .delete()
      .eq("id", accountId)
      .eq("user_id", myId);

    loadGameAccounts();
  };

  // 🔥 AJOUT — WRAPPER SESSION (detect mate & show button)
  function MatesSessionWrapper({
    myId,
    otherId,
  }: {
    myId: string | null;
    otherId: string;
  }) {
    const [isMate, setIsMate] = useState(false);

    useEffect(() => {
      if (!myId || !otherId) return;

      const checkMate = async () => {
        const { data } = await supabase
          .from("mates")
          .select("*")
          .or(
            `and(user1_id.eq.${myId},user2_id.eq.${otherId}),and(user1_id.eq.${otherId},user2_id.eq.${myId})`
          )
          .single();

        setIsMate(!!data);
      };

      checkMate();
    }, [myId, otherId]);

    if (!isMate) return null;

    return (
      <div style={{ marginTop: 10 }}>
        <MateSessionButton myId={myId!} otherId={otherId} />
      </div>
    );
  }

  if (!profile) return <p>Profil introuvable...</p>;

  return (
    <>
      <div className="profile-background"></div>

      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "20px",
          maxWidth: "750px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt="avatar"
              width={120}
              height={120}
              style={{ borderRadius: "50%", objectFit: "cover" }}
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
            <h1 style={{ fontSize: 24, marginBottom: 4 }}>
              {profile.pseudo}
            </h1>

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

              {" · "}

              <Link
                href={`/profile/${id}/mates`}
                style={{ color: "#4aa3ff", textDecoration: "none" }}
              >
                {matesCount} mate{matesCount > 1 ? "s" : ""}
              </Link>
            </p>

            <p>{profile.bio || "Aucune bio."}</p>

            <div style={{ marginTop: 15, display: "flex", gap: 10 }}>
              {myId && myId !== id && (
                <>
                  <button
                    onClick={handleToggleFollow}
                    style={{
                      padding: "8px 16px",
                      background: isFollowing ? "red" : "green",
                      color: "white",
                      borderRadius: 6,
                      cursor: "pointer",
                      border: "none",
                    }}
                  >
                    {isFollowing ? "Se désabonner" : "S'abonner"}
                  </button>

                  <button
                    onClick={handleStartConversation}
                    style={{
                      padding: "8px 16px",
                      background: "#0070f3",
                      color: "white",
                      borderRadius: 6,
                      cursor: "pointer",
                      border: "none",
                    }}
                  >
                    Message
                  </button>

                  {/* BOUTON MATE */}
                  <MateButton myId={myId} otherId={id} />

                  {/* 🔥 AJOUT — BOUTON SESSION */}
                  <MatesSessionWrapper myId={myId} otherId={id} />
                </>
              )}

              {myId === id && (
                <button
                  onClick={() => setShowEdit(!showEdit)}
                  style={{
                    padding: "8px 16px",
                    background: "#0070f3",
                    color: "white",
                    borderRadius: 6,
                    cursor: "pointer",
                    border: "none",
                  }}
                >
                  {showEdit ? "Fermer" : "Modifier mon profil"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* EDIT PROFILE */}
        {myId === id && showEdit && (
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

        {/* GAME ACCOUNTS */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Comptes de jeu</h2>

          {myId === id && (
            <Link
              href={`/profile/${id}/add-game-account`}
              style={{
                display: "inline-block",
                marginBottom: 14,
                padding: "8px 14px",
                background: "#0070f3",
                color: "white",
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              ➕ Ajouter un compte de jeu
            </Link>
          )}

          {loadingGames ? (
            <p>Chargement...</p>
          ) : gameAccounts.length === 0 ? (
            <p>Aucun compte ajouté.</p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {gameAccounts.map((acc) => {
                const isEditing = editingAccountId === acc.id;

                return (
                  <div
                    key={acc.id}
                    style={{
                      padding: 14,
                      background:
                        "linear-gradient(135deg, rgba(30,30,30,1), rgba(10,10,10,1))",
                      borderRadius: 10,
                      border: "1px solid #333",
                      boxShadow: "0 0 12px rgba(0,0,0,0.5)",
                    }}
                  >
                    {!isEditing && (
                      <>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              padding: "2px 8px",
                              borderRadius: 999,
                              border: "1px solid #555",
                            }}
                          >
                            🎮 {acc.game}
                          </span>

                          <span
                            style={{
                              fontSize: 12,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "#111",
                              border: "1px solid #444",
                            }}
                          >
                            {acc.platform || "Plateforme"}
                          </span>
                        </div>

                        <p style={{ marginTop: 4, fontSize: 15 }}>
                          <b>Pseudo : </b> {acc.username}
                        </p>

                        <p style={{ marginTop: 4, fontSize: 13 }}>
                          {acc.verified ? (
                            <span style={{ color: "lightgreen" }}>
                              ✔ Compte vérifié
                            </span>
                          ) : (
                            <span style={{ color: "orange" }}>
                              ⚠ Non vérifié
                            </span>
                          )}
                        </p>

                        {myId === id && (
                          <div
                            style={{
                              marginTop: 8,
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              onClick={() => startEditAccount(acc)}
                              style={{
                                padding: "6px 10px",
                                fontSize: 12,
                                borderRadius: 6,
                                border: "1px solid #555",
                                background: "#111",
                                color: "#fff",
                              }}
                            >
                              ✏ Modifier
                            </button>

                            {!acc.verified && (
                              <button
                                onClick={() => markAccountVerified(acc.id)}
                                style={{
                                  padding: "6px 10px",
                                  fontSize: 12,
                                  borderRadius: 6,
                                  background: "#198754",
                                  color: "#fff",
                                  border: "none",
                                }}
                              >
                                ✔ Vérifier
                              </button>
                            )}

                            <button
                              onClick={() => deleteAccount(acc.id)}
                              style={{
                                padding: "6px 10px",
                                fontSize: 12,
                                borderRadius: 6,
                                background: "#b00020",
                                color: "#fff",
                                border: "none",
                              }}
                            >
                              🗑 Supprimer
                            </button>
                          </div>
                        )}
                      </>
                    )}


                    {isEditing && (
                      <div style={{ marginTop: 4 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12 }}>Jeu</label>
                            <select
                              value={editGame}
                              onChange={(e) =>
                                setEditGame(e.target.value)
                              }
                              style={{
                                width: "100%",
                                marginTop: 3,
                                padding: 6,
                                background: "#111",
                                color: "#fff",
                                borderRadius: 6,
                                border: "1px solid #444",
                              }}
                            >
                              <option value="apex">
                                Apex Legends
                              </option>
                              <option value="fortnite">
                                Fortnite
                              </option>
                              <option value="gta">
                                GTA Online
                              </option>
                              <option value="valorant">
                                Valorant
                              </option>
                              <option value="cod">
                                Call of Duty
                              </option>
                            </select>
                          </div>

                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12 }}>
                              Plateforme
                            </label>
                            <select
  value={editPlatform}
  onChange={(e) => setEditPlatform(e.target.value)}
  style={{
    width: "100%",
    marginTop: 3,
    padding: 6,
    background: "#111",
    color: "#fff",
    borderRadius: 6,
    border: "1px solid #444",
  }}
>
  <option value="psn">PlayStation</option>
  <option value="xbl">Xbox</option>
  <option value="steam">Steam</option>
  <option value="epic">Epic Games</option>
  <option value="origin">EA Origin</option>
</select>

                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: 12 }}>
                            Pseudo
                          </label>
                          <input
                            type="text"
                            value={editUsername}
                            onChange={(e) =>
                              setEditUsername(e.target.value)
                            }
                            style={{
                              width: "100%",
                              marginTop: 3,
                              padding: 6,
                              background: "#111",
                              color: "#fff",
                              borderRadius: 6,
                              border: "1px solid #444",
                            }}
                          />
                        </div>

                        <div
                          style={{
                            marginTop: 8,
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={saveEditAccount}
                            disabled={savingEdit}
                            style={{
                              padding: "6px 10px",
                              fontSize: 12,
                              borderRadius: 6,
                              background: "#0070f3",
                              color: "#fff",
                              border: "none",
                            }}
                          >
                            {savingEdit
                              ? "Enregistrement..."
                              : "💾 Enregistrer"}
                          </button>

                          <button
                            onClick={cancelEditAccount}
                            style={{
                              padding: "6px 10px",
                              fontSize: 12,
                              borderRadius: 6,
                              background: "#111",
                              color: "#fff",
                              border: "1px solid #555",
                            }}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* POSTS */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 20, marginBottom: 10 }}>
            Publications
          </h2>

          {loadingPosts ? (
            <p>Chargement...</p>
          ) : userPosts.length === 0 ? (
            <p>Pas encore de post.</p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
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
                      {new Date(
                        post.created_at
                      ).toLocaleString("fr-FR", {
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