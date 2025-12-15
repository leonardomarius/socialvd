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
  import ProfilePerformances from "@/components/ProfilePerformances";
  import AddPerformanceForm from "@/components/AddPerformanceForm";

  type Profile = {
    id: string;
    pseudo: string | null;
    bio: string | null;
    avatar_url: string | null;
  };

  type Post = {
    id: string;
    user_id: string;
    content: string;
    game: string | null;
    likes: number;
    media_url: string | null;
    media_type: string | null;
    created_at: string;
  };

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_pseudo: string | null;
  author_avatar: string | null;
  likes: number;
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
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [isLiking, setIsLiking] = useState(false);
    const [localLikes, setLocalLikes] = useState<number>(0);


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
  // UI toggle for Game Accounts card
  const [showAccountsCard, setShowAccountsCard] = useState(false);

  useEffect(() => {
  if (!selectedPost) return;

setLocalLikes(selectedPost.likes ?? 0);

  const loadComments = async () => {
    setLoadingComments(true);

    const { data } = await supabase
      .from("comments")
      .select(`
        id,
        post_id,
        user_id,
        content,
        created_at,
        likes,
        profiles:profiles (
          pseudo,
          avatar_url
        )
      `)
      .eq("post_id", selectedPost.id)
      .order("created_at", { ascending: true });

    const formatted = (data || []).map((c: any) => ({
      id: c.id,
      post_id: c.post_id,
      user_id: c.user_id,
      content: c.content,
      created_at: c.created_at,
      likes: c.likes ?? 0,
      author_pseudo: c.profiles?.pseudo ?? null,
      author_avatar: c.profiles?.avatar_url ?? null,
    }));

    setComments(formatted);
    setLoadingComments(false);
  };

  loadComments();
}, [selectedPost]);

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

const handleToggleFollow = async () => {
  if (!myId) return;

  await supabase.rpc("toggle_follow", {
    p_follower: myId,
    p_following: id,
  });

  checkFollow();
  loadFollowCounts();
};


    // Follow toggle
    
const handleToggleLike = async () => {
  if (!myId || !selectedPost || isLiking) return;

  setIsLiking(true);

  // Toggle like in DB
  const { error } = await supabase.rpc("toggle_like", {
    p_post_id: selectedPost.id,
    p_user_id: myId,
  });

  if (error) {
    console.error("Like error:", error.message);
    setIsLiking(false);
    return;
  }

  // 🔁 Refetch likes from DB (source of truth)
  const { data: freshPost, error: fetchError } = await supabase
    .from("posts")
    .select("likes")
    .eq("id", selectedPost.id)
    .single();

  if (!fetchError && freshPost) {
  setLocalLikes(freshPost.likes ?? 0);
  setSelectedPost((prev) =>
    prev ? { ...prev, likes: freshPost.likes ?? 0 } : prev
  );
}


  setIsLiking(false);
};



    // DM creation
    const handleStartConversation = async () => {
  if (!myId || !id) {
    alert("Error: user not loaded.");
    return;
  }

  try {
    const { data, error } = await supabase.rpc(
      "create_or_get_conversation",
      { other_user: id }
    );

    if (error || !data) {
      alert("Error creating conversation: " + error?.message);
      return;
    }

    router.push(`/messages/${data}`);
  } catch (e: any) {
    alert("Error: " + e?.message);
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
        alert("Error during verification: " + error.message);
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
        alert("Error: " + error.message);
        return;
      }

      setEditingAccountId(null);
      loadGameAccounts();
    };

    const deleteAccount = async (accountId: string) => {
      const confirmDelete = window.confirm(
        "Delete this game account? This action is permanent."
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

    if (!profile) return <p>Profile not found...</p>;


    return (
      <>
        <div className="profile-background"></div>

{selectedPost && (
  <div
    onClick={() => setSelectedPost(null)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.75)",
      zIndex: 9999,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "680px",
        maxHeight: "90vh",
        overflowY: "auto",
        borderRadius: 16,
        padding: 20,
        background:
          "linear-gradient(135deg, rgba(14,14,22,0.98), rgba(6,6,12,0.98))",
        border: "1px solid rgba(110,110,155,0.25)",
      }}
    >
      <div style={{ marginBottom: 14 }}>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      fontSize: 12,
      color: "rgba(220,220,235,0.75)",
      marginBottom: 6,
    }}
  >
    <span>{selectedPost.game || "Unspecified game"}</span>
    <span>
      {new Date(selectedPost.created_at).toLocaleString("en-US", {
        dateStyle: "short",
        timeStyle: "short",
      })}
    </span>
  </div>


  <p
    style={{
      fontSize: 15,
      color: "rgba(245,245,255,0.95)",
      marginBottom: 10,
      lineHeight: 1.45,
    }}
  >
    {selectedPost.content}
  </p>

  {selectedPost.media_type === "image" && (
    <img
      src={selectedPost.media_url!}
      alt="post media"
      style={{
        width: "100%",
        borderRadius: 14,
        marginTop: 10,
      }}
    />
  )}

  {selectedPost.media_type === "video" && (
    <video
      src={selectedPost.media_url!}
      controls
      style={{
        width: "100%",
        borderRadius: 14,
        marginTop: 10,
      }}
    />
  )}
</div>



<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 18,
    marginTop: 18,
    paddingTop: 12,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  }}
>
  {/* LIKE */}
  <button
  onClick={handleToggleLike}
  disabled={isLiking}
  style={{
    background: "transparent",
    border: "none",
    color: "rgba(230,230,255,0.9)",
    fontSize: 15,
    cursor: isLiking ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    opacity: isLiking ? 0.6 : 1,
  }}
>
  👍{" "}
  <span style={{ fontSize: 13 }}>
    {localLikes}
  </span>
</button>


  {/* COMMENT */}
  <button
    style={{
      background: "transparent",
      border: "none",
      color: "rgba(230,230,255,0.9)",
      fontSize: 15,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}
  >
    💬 <span style={{ fontSize: 13 }}>Comment</span>
  </button>

  {/* DELETE (owner only) */}
  {myId === selectedPost.user_id && (
    <button
      style={{
        marginLeft: "auto",
        background: "transparent",
        border: "none",
        color: "rgba(255,120,120,0.9)",
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      🗑 Delete
    </button>
  )}
</div>

{/* ADD COMMENT */}
<div style={{ marginTop: 16 }}>
  <textarea
    value={newComment}
    onChange={(e) => setNewComment(e.target.value)}
    placeholder="Write a comment..."
    style={{
      width: "100%",
      minHeight: 60,
      background: "rgba(20,20,30,0.8)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10,
      padding: 10,
      color: "white",
      resize: "none",
      fontSize: 14,
    }}
  />

  <button
    disabled={!newComment.trim()}
    onClick={async () => {
      if (!myId || !selectedPost || !newComment.trim()) return;

      await supabase.from("comments").insert({
        post_id: selectedPost.id,
        user_id: myId,
        content: newComment.trim(),
      });

      setNewComment("");
      setComments((prev) => [
  ...prev,
  {
    id: crypto.randomUUID(), // placeholder UI (ou supprime si tu reload)
    post_id: selectedPost.id,
    user_id: myId,
    content: newComment.trim(),
    created_at: new Date().toISOString(),
    author_pseudo: profile?.pseudo ?? null,
    author_avatar: profile?.avatar_url ?? null,
    likes: 0,
  },
]);
    }}
    style={{
      marginTop: 8,
      padding: "6px 14px",
      borderRadius: 999,
      background: "rgba(70,100,255,0.9)",
      border: "none",
      color: "white",
      cursor: "pointer",
      fontSize: 13,
    }}
  >
    Post comment
  </button>
</div>

{/* COMMENTS LIST */}
<div style={{ marginTop: 20 }}>
  {loadingComments ? (
    <p style={{ opacity: 0.6 }}>Loading comments...</p>
  ) : comments.length === 0 ? (
    <p style={{ opacity: 0.6 }}>No comments yet.</p>
  ) : (
    comments.map((comment) => (
      <div
        key={comment.id}
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <img
          src={
            comment.author_avatar ||
            "https://via.placeholder.com/32/333333/FFFFFF?text=?"
          }
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />

        <div>
          <div style={{ fontSize: 13 }}>
            <b>{comment.author_pseudo || "Unknown"}</b>{" "}
            <span style={{ opacity: 0.85 }}>{comment.content}</span>
          </div>
        </div>
      </div>
    ))
  )}
</div>


    </div>
  </div>
)}



        <div
          style={{
            position: "relative",
            zIndex: 10,
            padding: "24px 20px 40px",
            maxWidth: "780px",
            margin: "0 auto",
          }}
        >
          {/* HEADER */}
          <div
            style={{
              display: "flex",
              gap: 20,
              alignItems: "center",
              marginBottom: 28,
              padding: 20,
              borderRadius: 16,
              background:
                "linear-gradient(135deg, rgba(12,12,18,0.95), rgba(8,8,14,0.98))",
              border: "1px solid rgba(110,110,155,0.20)",
              boxShadow:
                "0 0 26px rgba(70,90,255,0.20), inset 0 0 14px rgba(10,10,22,0.65)",
            }}
          >
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt="avatar"
                width={120}
                height={120}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid rgba(110,110,155,0.7)",
                  boxShadow: "0 0 22px rgba(90,110,255,0.65)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle at 30% 0%, rgba(90,110,255,0.35), transparent 55%), #111",
                  border: "2px solid rgba(110,110,155,0.5)",
                  boxShadow: "0 0 22px rgba(90,110,255,0.4)",
                }}
              ></div>
            )}

            {/* COLONNE GAUCHE : infos + actions */}
            <div style={{ flex: 1 }}>
              <h1
                style={{
                  fontSize: 24,
                  marginBottom: 4,
                  letterSpacing: "0.5px",
                  color: "rgba(255,255,255,0.96)",
                }}
              >
                {profile.pseudo}
              </h1>

              <p
                style={{
                  color: "rgba(220,220,235,0.8)",
                  marginBottom: 8,
                  fontSize: 13,
                }}
              >
                <Link
                  href={`/profile/${id}/followers`}
                  style={{
                    color: "#4aa3ff",
                    textDecoration: "none",
                  }}
                >
                  {followersCount} follower{followersCount > 1 ? "s" : ""}
                </Link>

                {" · "}

                <Link
                  href={`/profile/${id}/following`}
                  style={{
                    color: "#4aa3ff",
                    textDecoration: "none",
                  }}
                >
                  {followingCount} following
                </Link>

                {" · "}

                <Link
                  href={`/profile/${id}/mates`}
                  style={{
                    color: "#4aa3ff",
                    textDecoration: "none",
                  }}
                >
                  {matesCount} mate{matesCount > 1 ? "s" : ""}
                </Link>
              </p>

              <p
                style={{
                  marginTop: 4,
                  fontSize: 14,
                  color: "rgba(235,235,245,0.82)",
                }}
              >
                {profile.bio || "No bio."}
              </p>

              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                {myId && myId !== id && (
                  <>
                    <button
                      onClick={handleToggleFollow}
                      style={{
                        padding: "8px 18px",
                        background: isFollowing
                          ? "rgba(176,0,32,0.9)"
                          : "rgba(70,100,255,0.9)",
                        color: "white",
                        borderRadius: 999,
                        cursor: "pointer",
                        border: "1px solid rgba(255,255,255,0.18)",
                        fontSize: 13,
                      }}
                    >
                      {isFollowing ? "Unfollow" : "Follow"}
                    </button>

                    <button
                      onClick={handleStartConversation}
                      style={{
                        padding: "8px 18px",
                        background: "rgba(0,112,243,0.9)",
                        color: "white",
                        borderRadius: 999,
                        cursor: "pointer",
                        border: "1px solid rgba(255,255,255,0.18)",
                        fontSize: 13,
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
                      padding: "8px 18px",
                      background: "rgba(0,112,243,0.9)",
                      color: "white",
                      borderRadius: 999,
                      cursor: "pointer",
                      border: "1px solid rgba(255,255,255,0.18)",
                      fontSize: 13,
                    }}
                  >
                    {showEdit ? "Close" : "Edit my profile"}
                  </button>
                )}
              </div>
            </div>

        {/* COLONNE DROITE : 3 BOUTONS (Performances / Events / Game Accounts) */}
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 10,
      marginLeft: "auto",
      minWidth: 170,
    }}
  >
    <Link
      href={`/profile/${id}/performances`}
      style={{
        padding: "8px 16px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.14)",
        color: "#dbe9ff",
        fontSize: "0.82rem",
        textDecoration: "none",
        textAlign: "center",
        transition: "all 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow =
          "0 0 12px rgba(80,150,255,0.55), inset 0 0 4px rgba(90,140,255,0.4)";
        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0px)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      }}
    >
      Performances
    </Link>

    <Link
      href={`/profile/${id}/events`}
      style={{
        padding: "8px 16px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.14)",
        color: "#dbe9ff",
        fontSize: "0.82rem",
        textDecoration: "none",
        textAlign: "center",
        transition: "all 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow =
          "0 0 12px rgba(80,150,255,0.55), inset 0 0 4px rgba(90,140,255,0.4)";
        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0px)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      }}
    >
      Events
    </Link>

    <button
    onClick={() => setShowAccountsCard(!showAccountsCard)}
    style={{
      padding: "8px 16px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.14)",
      color: "#dbe9ff",
      fontSize: "0.82rem",
      textDecoration: "none",
      textAlign: "center",
      transition: "all 0.25s ease",
      cursor: "pointer",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow =
        "0 0 12px rgba(80,150,255,0.55), inset 0 0 4px rgba(90,140,255,0.4)";
      e.currentTarget.style.background = "rgba(255,255,255,0.08)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0px)";
      e.currentTarget.style.boxShadow = "none";
      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
    }}
  >
    Game Accounts
  </button>

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

 {/* GAME ACCOUNTS CARD — VERSION OVERLAY DROITE */}
{showAccountsCard && (
  <div
    style={{
      position: "absolute",            // 🔥 SUPERPOSITION
      top: "175px",                    // Aligné sous le header
      right: "0px",                    // Collé à droite
      width: "58%",                    // 🔥 55-60% de largeur
      zIndex: 9999,                    // 🔥 Passe au-dessus de tout
      padding: "20px",
      borderRadius: "16px",
      background:
        "linear-gradient(135deg, rgba(14,14,22,0.96), rgba(6,6,12,0.98))",
      border: "1px solid rgba(110,110,155,0.25)",
      boxShadow:
        "0 0 32px rgba(90,110,255,0.35), inset 0 0 14px rgba(10,10,22,0.55)",
      animation: "fadeSlideIn 0.25s ease-out",
    }}
  >
    <h2
      style={{
        fontSize: 18,
        marginBottom: 14,
        color: "rgba(240,240,255,0.9)",
        letterSpacing: "0.4px",
      }}
    >
      Game Accounts
    </h2>

    {loadingGames ? (
      <p>Loading...</p>
    ) : gameAccounts.length === 0 ? (
      <p>No accounts found.</p>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {gameAccounts.map((acc) => (
          <div
            key={acc.id}
            style={{
              padding: 14,
              borderRadius: 12,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <p style={{ color: "#fff" }}><b>Game:</b> {acc.game}</p>
            <p style={{ color: "#ddd" }}><b>Username:</b> {acc.username}</p>
            <p style={{ color: "#aaa" }}><b>Platform:</b> {acc.platform}</p>
            <p style={{ marginTop: 6, color: acc.verified ? "lightgreen" : "orange" }}>
              {acc.verified ? "✔ Verified" : "⚠ Not verified"}
            </p>
          </div>
        ))}
      </div>
    )}
  </div>
)}



          {/* POSTS GRID (Instagram-like) */}
<section style={{ marginTop: 40 }}>
  <h2
    style={{
      fontSize: 20,
      marginBottom: 16,
      letterSpacing: "0.4px",
    }}
  >
    Posts
  </h2>

  {loadingPosts ? (
    <p>Loading...</p>
  ) : userPosts.length === 0 ? (
    <p>No posts yet.</p>
  ) : (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 6,
      }}
    >
      {userPosts.map((post) => (
        <div
          key={post.id}
          onClick={() => setSelectedPost(post)}
          style={{
            aspectRatio: "1 / 1",
            background: "rgba(20,20,30,0.8)",
            borderRadius: 6,
            overflow: "hidden",
            cursor: "pointer",
            position: "relative",
          }}
        >
          {post.media_type === "image" ? (
            <img
              src={post.media_url!}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                padding: 10,
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {post.content.slice(0, 120)}
            </div>
          )}
        </div>
      ))}
    </div>
  )}
</section>

        </div>
      </>
    );
  }
