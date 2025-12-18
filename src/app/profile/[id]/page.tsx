  "use client";

  import { useEffect, useState, useRef } from "react";
  import { useParams, useRouter } from "next/navigation";
  import { supabase } from "@/lib/supabase";
  import Image from "next/image";
  import EditProfileForm from "@/components/EditProfileForm";
  import Link from "next/link";
  import MateButton from "@/components/MateButton";
  import { XMarkIcon } from "@heroicons/react/24/outline";

  // 🔥 AJOUT — IMPORT
  import MateSessionButton from "@/components/MateSessionButton";
  import ProfilePerformances from "@/components/ProfilePerformances";
  import AddPerformanceForm from "@/components/AddPerformanceForm";

  // ---------------------
  // FORMATAGE DATE POST
  // ---------------------
  function formatPostDate(dateString: string): string {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffMs = now.getTime() - postDate.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    // Just now (moins de 1 minute)
    if (diffSec < 60) {
      return "Just now";
    }

    // Minutes ago (moins de 1 heure)
    if (diffMin < 60) {
      return `${diffMin} min ago`;
    }

    // Hours ago (moins de 24 heures)
    if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      postDate.getDate() === yesterday.getDate() &&
      postDate.getMonth() === yesterday.getMonth() &&
      postDate.getFullYear() === yesterday.getFullYear()
    ) {
      const hours = postDate.getHours().toString().padStart(2, "0");
      const minutes = postDate.getMinutes().toString().padStart(2, "0");
      return `Yesterday at ${hours}:${minutes}`;
    }

    // Date complète (plus de 24h)
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const day = postDate.getDate();
    const month = months[postDate.getMonth()];
    const year = postDate.getFullYear();
    const hours = postDate.getHours().toString().padStart(2, "0");
    const minutes = postDate.getMinutes().toString().padStart(2, "0");

    // Si c'est la même année, on n'affiche pas l'année
    if (postDate.getFullYear() === now.getFullYear()) {
      return `${day} ${month} at ${hours}:${minutes}`;
    }

    return `${day} ${month} ${year} at ${hours}:${minutes}`;
  }

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
  parent_id: string | null;
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
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const commentInputRef = useRef<HTMLTextAreaElement | null>(null);


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

  // Blocage du scroll quand la modal est ouverte
  useEffect(() => {
    if (selectedPost) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedPost]);

  // Gestion de la touche ESC pour fermer la modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedPost) {
        setSelectedPost(null);
      }
    };
    if (selectedPost) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [selectedPost]);

  useEffect(() => {
  if (!selectedPost) return;
  setNewComment("");
setComments([]);


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
    parent_id,
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
  parent_id: c.parent_id,
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

  let postsQuery = supabase
    .from("posts")
    .select(`
      *,
      games (
        id,
        name,
        slug
      ),
      likes(count)
    `)
    .eq("user_id", id)
    .order("created_at", { ascending: false });

  const { data: postsData, error } = await postsQuery;

  if (error) {
    console.error(error);
    setLoadingPosts(false);
    return;
  }

  // récupérer les likes du user connecté
  let myLikesMap: Record<string, boolean> = {};
  if (myId) {
    const { data: myLikes } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", myId);

    myLikesMap =
      myLikes?.reduce((acc: any, row: any) => {
        acc[row.post_id] = true;
        return acc;
      }, {}) || {};
  }

  const formattedPosts = (postsData || []).map((p: any) => {
    const likesArray = p.likes || [];
    const likesCount =
      Array.isArray(likesArray) && likesArray[0]?.count
        ? likesArray[0].count
        : 0;

    return {
      ...p,
      likes: likesCount,
      isLikedByMe: !!myLikesMap[p.id],
    };
  });

  setUserPosts(formattedPosts);
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

  const currentlyLiked = !!(selectedPost as any).isLikedByMe;

  if (currentlyLiked) {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("post_id", selectedPost.id)
      .eq("user_id", myId);

    if (error) {
      console.error("Error unliking:", error);
      setIsLiking(false);
      return;
    }
  } else {
    const { error } = await supabase.from("likes").insert({
      post_id: selectedPost.id,
      user_id: myId,
    });

    if (error) {
      console.error("Error liking:", error);
      setIsLiking(false);
      return;
    }
  }

  // 🔁 UPDATE LOCAL — USER POSTS
  setUserPosts((prev: Post[]) =>
    prev.map((p: Post) =>
      p.id !== selectedPost.id
        ? p
        : {
            ...p,
            likes: Math.max(0, p.likes + (currentlyLiked ? -1 : 1)),
            isLikedByMe: !currentlyLiked,
          }
    )
  );

  // 🔁 UPDATE LOCAL — SELECTED POST (MODAL)
  setSelectedPost((prev) =>
    prev
      ? {
          ...prev,
          likes: Math.max(0, prev.likes + (currentlyLiked ? -1 : 1)),
          isLikedByMe: !currentlyLiked,
        }
      : prev
  );

  setLocalLikes((prev) => Math.max(0, prev + (currentlyLiked ? -1 : 1)));
  setIsLiking(false);
};

  const handleAddComment = async () => {
    if (!myId || !selectedPost || !newComment.trim()) return;

    const { error } = await supabase.from("comments").insert({
      post_id: selectedPost.id,
      user_id: myId,
      content: newComment.trim(),
      parent_id: replyTo,
    });

    if (error) {
      console.error("Insert comment error:", error);
      return;
    }

    setNewComment("");
    setReplyTo(null);

    // 🔥 SOURCE DE VÉRITÉ : REFETCH DB
    setLoadingComments(true);

    const { data } = await supabase
      .from("comments")
      .select(`
        id,
        post_id,
        user_id,
        content,
        created_at,
        parent_id,
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
      parent_id: c.parent_id,
      likes: c.likes ?? 0,
      author_pseudo: c.profiles?.pseudo ?? null,
      author_avatar: c.profiles?.avatar_url ?? null,
    }));

    setComments(formatted);
    setLoadingComments(false);
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

{selectedPost && (
  <div
    onClick={() => setSelectedPost(null)}
    className="modal-backdrop"
    style={{ overflow: "hidden" }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="card"
      style={{
        width: "680px",
        maxWidth: "90vw",
        maxHeight: "90vh",
        height: "auto",
        overflowY: "auto",
        overflowX: "hidden",
        margin: "auto",
        position: "relative",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Close Button */}
      <button
        onClick={() => setSelectedPost(null)}
        type="button"
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          background: "rgba(30, 30, 30, 0.9)",
          border: "1px solid rgba(100, 100, 100, 0.3)",
          borderRadius: "50%",
          width: "32px",
          height: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#ffffff",
          zIndex: 10001,
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(40, 40, 40, 0.95)";
          e.currentTarget.style.borderColor = "rgba(250, 204, 21, 0.5)";
          e.currentTarget.style.color = "#facc15";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(30, 30, 30, 0.9)";
          e.currentTarget.style.borderColor = "rgba(100, 100, 100, 0.3)";
          e.currentTarget.style.color = "#ffffff";
        }}
      >
        <XMarkIcon style={{ width: "18px", height: "18px" }} />
      </button>

      {/* Header */}
      <div className="post-header">
        <div className="post-user">
          <Link href={`/profile/${selectedPost.user_id}`}>
            <img
              src={
                profile.avatar_url ||
                "https://via.placeholder.com/40/333333/FFFFFF?text=?"
              }
              className="avatar"
            />
          </Link>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <Link
                href={`/profile/${selectedPost.user_id}`}
                className="post-author username-display"
              >
                {profile.pseudo}
              </Link>

              {selectedPost.game && (
                <span className="game-link" style={{ marginLeft: "10px" }}>
                  {selectedPost.game}
                </span>
              )}
            </div>
            <span className="post-date">
              {formatPostDate(selectedPost.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <p className="post-content">{selectedPost.content}</p>

      {/* Media */}
      {selectedPost.media_type === "image" && selectedPost.media_url && (
        <div className="post-media-wrapper">
          <img
            src={selectedPost.media_url}
            className="post-media post-media-image"
            alt="Post content"
            loading="lazy"
          />
        </div>
      )}

      {selectedPost.media_type === "video" && selectedPost.media_url && (
        <div className="post-media-wrapper">
          <video
            src={selectedPost.media_url}
            controls
            className="post-media post-media-video"
            preload="metadata"
          ></video>
        </div>
      )}

      {/* Actions */}
      <div className="post-actions">
        <button
          className={`like-button ${(selectedPost as any).isLikedByMe ? "liked" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleToggleLike();
          }}
          type="button"
          disabled={isLiking}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={(selectedPost as any).isLikedByMe ? "#facc15" : "none"}
            stroke={(selectedPost as any).isLikedByMe ? "#facc15" : "#ffffff"}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 9V5a3 3 0 0 0-6 0v4" />
            <path d="M5 15V11a2 2 0 0 1 2-2h11l-1 8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2" />
          </svg>
          <span>{localLikes}</span>
        </button>
      </div>

      {/* Comments Section */}
      <div className="glass-card" style={{ marginTop: "16px" }}>
        {loadingComments ? (
          <p style={{ opacity: 0.6, color: "#ffffff" }}>Loading comments...</p>
        ) : comments.length === 0 ? (
          <p style={{ opacity: 0.6, color: "#ffffff" }}>No comments yet.</p>
        ) : (
          comments.map((comment) => {
            const canDelete = comment.user_id === myId;
            const isReply = !!comment.parent_id;

            return (
              <div
                key={comment.id}
                className="glass-comment"
                style={{ marginLeft: isReply ? "32px" : "0", marginBottom: "12px" }}
              >
                <div className="comment-header">
                  <Link
                    href={`/profile/${comment.user_id}`}
                    className="comment-author clickable-author"
                  >
                    {comment.author_pseudo || "Unknown"}
                  </Link>
                </div>

                <div className="comment-content">
                  <span className="comment-text">{comment.content}</span>
                </div>

                <div className="comment-actions">
                  <button
                    className="btn ghost-btn btn-small"
                    onClick={() => {
                      setReplyTo(comment.id);
                      setNewComment(`@${comment.author_pseudo} `);
                      setTimeout(() => {
                        if (commentInputRef.current) {
                          commentInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                          commentInputRef.current.focus();
                        }
                      }, 100);
                    }}
                    type="button"
                  >
                    Reply
                  </button>

                  {canDelete && (
                    <button
                      className="btn danger-btn btn-small"
                      onClick={async () => {
                        await supabase
                          .from("comments")
                          .delete()
                          .eq("id", comment.id);
                        setComments((prev) => prev.filter((c) => c.id !== comment.id));
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Add Comment */}
        <div className="comment-input-row" style={{ marginTop: "16px" }}>
          <textarea
            ref={commentInputRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="textarea"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
          />
          <button
            className="btn ghost-btn btn-small"
            onClick={handleAddComment}
            disabled={!newComment.trim()}
            type="button"
          >
            Send
          </button>
        </div>
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
    <div
      className="profile-post-media-wrapper"
      onMouseEnter={(e) => {
        const video = e.currentTarget.querySelector("video") as HTMLVideoElement;
        if (video) {
          video.play().catch(() => {
            // Ignore play() errors (autoplay restrictions, etc.)
          });
        }
      }}
      onMouseLeave={(e) => {
        const video = e.currentTarget.querySelector("video") as HTMLVideoElement;
        if (video) {
          try {
            video.pause();
            video.currentTime = 0;
          } catch (err) {
            // Ignore pause() errors
          }
        }
      }}
    >
      {post.media_type === "image" && post.media_url && (
        <img src={post.media_url} alt="" style={{ pointerEvents: "none" }} />
      )}

      {post.media_type === "video" && post.media_url && (
        <video
          src={post.media_url}
          muted
          loop
          playsInline
          preload="metadata"
          style={{ pointerEvents: "none" }}
          onPlay={(e) => {
            // Prevent play errors from bubbling
            e.stopPropagation();
          }}
          onPause={(e) => {
            // Prevent pause errors from bubbling
            e.stopPropagation();
          }}
        />
      )}
    </div>
  </div>
))}

    </div>
  )}
</section>

        </div>
      </>
    );
  }