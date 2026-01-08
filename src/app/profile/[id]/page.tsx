  "use client";

  import { useEffect, useState, useRef } from "react";
  import { useParams, useRouter } from "next/navigation";
  import { supabase } from "@/lib/supabase";
  import Image from "next/image";
  import EditProfileForm from "@/components/EditProfileForm";
  import Link from "next/link";
  import MateButton from "@/components/MateButton";
  import { XMarkIcon, HeartIcon } from "@heroicons/react/24/outline";
  import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
  import { isCS2Account } from "@/lib/cs2-utils";

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
  likes_count?: number;
  isLikedByMe?: boolean;
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
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileError, setProfileError] = useState<string | null>(null);
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
    const [showComments, setShowComments] = useState(false);


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
  if (!selectedPost) {
    setShowComments(false);
    return;
  }
  setNewComment("");
setComments([]);
setShowComments(false);


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
    ),
    comment_likes(count)
  `)
  .eq("post_id", selectedPost.id)
  .order("created_at", { ascending: true });


    // Get comment likes for current user
    let myCommentLikesMap: Record<string, boolean> = {};
    if (myId) {
      const { data: myCommentLikes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", myId);

      if (myCommentLikes) {
        myCommentLikesMap = myCommentLikes.reduce(
          (acc: Record<string, boolean>, row: any) => {
            acc[row.comment_id] = true;
            return acc;
          },
          {}
        );
      }
    }

    const formatted = (data || []).map((c: any) => {
      const likesArray = c.comment_likes || [];
      const likesCount =
        Array.isArray(likesArray) && likesArray[0]?.count
          ? likesArray[0].count
          : 0;

      return {
        id: c.id,
        post_id: c.post_id,
        user_id: c.user_id,
        content: c.content,
        created_at: c.created_at,
        parent_id: c.parent_id,
        likes: c.likes ?? 0,
        author_pseudo: c.profiles?.pseudo ?? null,
        author_avatar: c.profiles?.avatar_url ?? null,
        likes_count: likesCount,
        isLikedByMe: !!myCommentLikesMap[c.id],
      };
    });


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

    // ✅ Load profile first
    useEffect(() => {
      if (!id) {
        setProfileError("Invalid profile ID");
        setProfileLoading(false);
        return;
      }

      let mounted = true;

      const init = async () => {
        await loadProfile();
        if (!mounted) return;
      };

      init();

      return () => {
        mounted = false;
      };
    }, [id]);

    // ✅ Load other data after profile is loaded
    useEffect(() => {
      if (!id || profileLoading || !profile) return;

      loadUserPosts();
      loadFollowCounts();
      loadGameAccounts();
      loadMatesCount();
    }, [id, profileLoading, profile]);

    // ✅ Check follow status when myId is available
    useEffect(() => {
      if (!id || !myId || profileLoading || !profile) return;
      checkFollow();
    }, [myId, id, profileLoading, profile]);

    // ✅ Profile avec gestion d'erreur explicite
    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        setProfileError(null);

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", id)
          .single();

        if (profileError) {
          console.error("Profile error:", profileError);
          // ✅ Distinguer "not found" de "erreur réseau"
          if (profileError.code === "PGRST116") {
            setProfileError("Profile not found");
          } else {
            setProfileError("Failed to load profile. Please try again.");
          }
          setProfile(null);
          setProfileLoading(false);
          return;
        }

        setProfile(data || null);
        setProfileLoading(false);
        setProfileError(null);
      } catch (err) {
        console.error("Exception in loadProfile:", err);
        setProfileError("An unexpected error occurred. Please refresh the page.");
        setProfile(null);
        setProfileLoading(false);
      }
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

      // Load non-CS2 accounts from legacy table
      const { data: legacyAccounts } = await supabase
        .from("game_accounts")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false });

      // Load CS2 account from game_account_links
      const { data: cs2Game } = await supabase
        .from("games")
        .select("id")
        .eq("slug", "cs2")
        .single();

      let cs2Account: GameAccount | null = null;
      if (cs2Game) {
        const { data: cs2Link } = await supabase
          .from("game_account_links")
          .select("external_account_id, created_at")
          .eq("user_id", id)
          .eq("game_id", cs2Game.id)
          .eq("provider", "steam")
          .is("revoked_at", null)
          .single();

        if (cs2Link) {
          cs2Account = {
            id: `cs2-link-${id}`,
            game: "CS2",
            username: cs2Link.external_account_id || "Steam Account",
            platform: "Steam",
            verified: true, // Steam links are always verified
            verification_code: null,
          };
        }
      }

      // Combine: CS2 from links, others from legacy
      const legacyAccountsList = (legacyAccounts || []).filter(
        (acc) => !isCS2Account(acc.game)
      ) as GameAccount[];

      const allAccounts = cs2Account 
        ? [cs2Account, ...legacyAccountsList]
        : legacyAccountsList;

      setGameAccounts(allAccounts);
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

  const handleToggleCommentLike = async (commentId: string) => {
    if (!myId) return;

    const comment = comments.find((c) => c.id === commentId);
    const currentlyLiked = comment?.isLikedByMe;

    if (currentlyLiked) {
      await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", myId);
    } else {
      await supabase.from("comment_likes").insert({
        comment_id: commentId,
        user_id: myId,
      });
    }

    // Mise à jour locale
    setComments((prev) =>
      prev.map((c) =>
        c.id !== commentId
          ? c
          : {
              ...c,
              isLikedByMe: !currentlyLiked,
              likes_count: (c.likes_count ?? 0) + (currentlyLiked ? -1 : 1),
            }
      )
    );
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
      // CS2 accounts are read-only
      if (isCS2Account(acc.game)) {
        alert("CS2 accounts are read-only and synced from Steam.");
        return;
      }

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

      // CS2 accounts are read-only
      if (isCS2Account(editGame)) {
        alert("CS2 accounts are read-only and cannot be edited manually.");
        setEditingAccountId(null);
        setSavingEdit(false);
        return;
      }

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
      const acc = gameAccounts.find((a) => a.id === accountId);
      if (acc && isCS2Account(acc.game)) {
        alert("CS2 accounts are read-only and cannot be deleted manually.");
        return;
      }

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

    // ✅ État de chargement explicite
    if (profileLoading) {
      return (
        <div style={{ padding: 30, textAlign: "center", color: "#ffffff" }}>
          <p style={{ opacity: 0.7 }}>Loading profile...</p>
        </div>
      );
    }

    // ✅ État d'erreur explicite
    if (profileError || !profile) {
      return (
        <div style={{ padding: 30, textAlign: "center" }}>
          <p style={{ color: "#f87171", marginBottom: "16px" }}>
            {profileError || "Profile not found"}
          </p>
          <button
            onClick={() => {
              setProfileError(null);
              setProfileLoading(true);
              loadProfile();
            }}
            style={{
              padding: "8px 16px",
              background: "rgba(30, 30, 30, 0.8)",
              border: "1px solid rgba(100, 100, 100, 0.3)",
              borderRadius: "6px",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }


    return (
      <>
      <style>{`
        .ghost-btn {
          background: rgba(30, 30, 30, 0.8);
          border-color: rgba(100, 100, 100, 0.3);
          color: #ffffff;
          box-shadow: 
            0 1px 3px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .ghost-btn:hover {
          background: rgba(40, 40, 40, 0.9);
          border-color: rgba(250, 204, 21, 0.5);
          color: #ffffff;
          box-shadow: 
            0 2px 8px rgba(250, 204, 21, 0.2),
            0 0 16px rgba(250, 204, 21, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          transform: translateY(-1px);
        }

        .ghost-btn:active {
          transform: translateY(0);
        }

        .danger-btn {
          background: rgba(30, 30, 30, 0.8);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
          box-shadow: 
            0 1px 3px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .danger-btn:hover {
          background: rgba(40, 40, 40, 0.9);
          border-color: rgba(239, 68, 68, 0.5);
          color: #fca5a5;
          box-shadow: 
            0 2px 8px rgba(239, 68, 68, 0.2),
            0 0 16px rgba(239, 68, 68, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          transform: translateY(-1px);
        }

        .danger-btn:active {
          transform: translateY(0);
        }

        /* Boutons sociaux avec accent jaune */
        .social-btn {
          background: rgba(30, 30, 30, 0.8);
          border-color: rgba(250, 204, 21, 0.25);
          color: #ffffff;
          box-shadow: 
            0 1px 3px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 0 8px rgba(250, 204, 21, 0.08);
        }

        .social-btn:hover {
          background: rgba(40, 40, 40, 0.9);
          border-color: rgba(250, 204, 21, 0.6);
          color: #ffffff;
          box-shadow: 
            0 2px 8px rgba(250, 204, 21, 0.3),
            0 0 20px rgba(250, 204, 21, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          transform: translateY(-1px);
        }

        .social-btn:active {
          transform: translateY(0);
          box-shadow: 
            0 1px 3px rgba(250, 204, 21, 0.4),
            inset 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        /* État actif (Following / Mate) */
        .social-btn.active {
          background: rgba(250, 204, 21, 0.12);
          border-color: rgba(250, 204, 21, 0.6);
          color: #facc15;
          box-shadow: 
            0 2px 8px rgba(250, 204, 21, 0.25),
            0 0 16px rgba(250, 204, 21, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .social-btn.active:hover {
          background: rgba(250, 204, 21, 0.18);
          border-color: rgba(250, 204, 21, 0.75);
          color: #fde047;
          box-shadow: 
            0 3px 12px rgba(250, 204, 21, 0.35),
            0 0 24px rgba(250, 204, 21, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
        }
      `}</style>
 
{selectedPost && (
  <>
    <style dangerouslySetInnerHTML={{__html: `
      .profile-modal-card::-webkit-scrollbar {
        display: none;
      }
      .profile-modal-card {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
    `}} />
    <div
      onClick={() => setSelectedPost(null)}
      className="modal-backdrop"
      style={{ overflow: "hidden" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card profile-modal-card"
        style={{
          width: "680px",
          maxWidth: "90vw",
          maxHeight: "85vh",
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
                "https://via.placeholder.com/44/333333/FFFFFF?text=?"
              }
              className="avatar"
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid rgba(100, 100, 100, 0.3)",
              }}
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
      <p className="post-content" style={{ marginTop: "14px", marginBottom: "0" }}>{selectedPost.content}</p>

      {/* Media */}
      {selectedPost.media_type === "image" && selectedPost.media_url && (
        <div className="post-media-wrapper" style={{ 
          width: "100%",
          marginTop: "16px",
          marginBottom: "0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "65vh",
          maxHeight: "65vh",
        }}>
          <img
            src={selectedPost.media_url}
            className="post-media post-media-image"
            alt="Post content"
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              maxHeight: "65vh",
              objectFit: "contain",
              objectPosition: "center",
            }}
          />
        </div>
      )}

      {selectedPost.media_type === "video" && selectedPost.media_url && (
        <div className="post-media-wrapper" style={{ 
          width: "100%",
          marginTop: "16px",
          marginBottom: "0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "65vh",
          maxHeight: "65vh",
        }}>
          <video
            src={selectedPost.media_url}
            controls
            autoPlay
            muted
            playsInline
            className="post-media post-media-video"
            preload="auto"
            style={{
              width: "100%",
              height: "100%",
              maxHeight: "65vh",
              objectFit: "contain",
              objectPosition: "center",
            }}
            onLoadedData={(e) => {
              // Tentative de play() explicite pour garantir l'autoplay
              const video = e.currentTarget;
              video.play().catch(() => {
                // Ignore les erreurs d'autoplay (restrictions navigateur)
              });
            }}
            onError={(e) => {
              // Gérer les erreurs de chargement silencieusement
              e.stopPropagation();
            }}
          ></video>
        </div>
      )}

      {/* Actions */}
      <div className="post-actions" style={{ marginTop: "16px", marginBottom: "0" }}>
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
          {(selectedPost as any).isLikedByMe ? (
            <HeartIconSolid className="like-icon" style={{ width: "20px", height: "20px" }} />
          ) : (
            <HeartIcon className="like-icon" style={{ width: "20px", height: "20px" }} />
          )}
          <span style={{ 
            fontSize: "0.95rem",
            fontWeight: "600",
            letterSpacing: "0.02em"
          }}>
            {localLikes}
          </span>
        </button>

        <button
          className="btn ghost-btn"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowComments(!showComments);
          }}
          type="button"
          style={{ marginLeft: "12px" }}
        >
          {showComments ? "Hide comments" : `Comments (${comments.length})`}
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
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
                <div className="comment-header-with-avatar">
                  <Link href={`/profile/${comment.user_id}`}>
                    <img
                      src={
                        comment.author_avatar ||
                        "https://via.placeholder.com/32/333333/FFFFFF?text=?"
                      }
                      className="comment-avatar"
                      alt={comment.author_pseudo || "Unknown"}
                    />
                  </Link>
                  <div className="comment-header-content">
                    <Link
                      href={`/profile/${comment.user_id}`}
                      className="comment-author clickable-author"
                    >
                      {comment.author_pseudo || "Unknown"}
                    </Link>
                  </div>
                </div>

                <div className="comment-content">
                  <span className="comment-text">{comment.content}</span>
                </div>

                <div className="comment-actions">
                  <div className="comment-actions-left">
                    <button
                      className="comment-reply-link"
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

                  <button
                    className={`comment-like-heart ${comment.isLikedByMe ? "liked" : ""}`}
                    onClick={() => handleToggleCommentLike(comment.id)}
                    type="button"
                  >
                    {comment.isLikedByMe ? (
                      <HeartIconSolid className="comment-heart-icon" />
                    ) : (
                      <HeartIcon className="comment-heart-icon" />
                    )}
                    <span className="comment-like-count">{comment.likes_count ?? 0}</span>
                  </button>
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
      )}
    </div>
  </div>
  </>
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
                width={80}
                height={80}
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  aspectRatio: "1/1",
                  border: "2px solid rgba(110,110,155,0.7)",
                  boxShadow: "0 0 18px rgba(90,110,255,0.55)",
                }}
              />
            ) : (
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  aspectRatio: "1/1",
                  background:
                    "radial-gradient(circle at 30% 0%, rgba(90,110,255,0.35), transparent 55%), #111",
                  border: "2px solid rgba(110,110,155,0.5)",
                  boxShadow: "0 0 18px rgba(90,110,255,0.4)",
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
                      className={`btn social-btn ${isFollowing ? "active" : ""}`}
                      type="button"
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>

                    <button
                      onClick={handleStartConversation}
                      className="btn"
                      type="button"
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
                    className="btn"
                    type="button"
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
      className="btn ghost-btn"
    >
      Performances
    </Link>

    <Link
      href={`/profile/${id}/events`}
      className="btn ghost-btn"
    >
      Events
    </Link>

    <button
      onClick={() => setShowAccountsCard(!showAccountsCard)}
      className="btn ghost-btn"
      type="button"
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
              border: isCS2Account(acc.game) ? "1px solid rgba(80,120,255,0.3)" : "1px solid rgba(255,255,255,0.10)",
              opacity: isCS2Account(acc.game) ? 0.9 : 1,
            }}
          >
            <p style={{ color: "#fff" }}>
              <b>Game:</b> {acc.game}
              {isCS2Account(acc.game) && (
                <span style={{ 
                  fontSize: 11, 
                  marginLeft: 8, 
                  color: "rgba(80, 200, 120, 0.9)",
                  fontWeight: 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}>
                  <span style={{ fontSize: 12 }}>✓</span>
                  <span>Verified • Official Steam Data</span>
                </span>
              )}
            </p>
            <p style={{ color: "#ddd" }}><b>Username:</b> {acc.username}</p>
            <p style={{ color: "#aaa" }}><b>Platform:</b> {acc.platform}</p>
            {!isCS2Account(acc.game) && (
              <p style={{ marginTop: 6, color: acc.verified ? "lightgreen" : "orange" }}>
                {acc.verified ? "✔ Verified" : "⚠ Not verified"}
              </p>
            )}
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