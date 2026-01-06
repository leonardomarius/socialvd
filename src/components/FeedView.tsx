"use client";

import { useEffect, useState, useRef } from "react";
import PostCard, { Post as PostCardPost } from "@/components/PostCard";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// HeroIcons (outline)
import {
  EllipsisVerticalIcon,
  PencilSquareIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";

type Post = {
  id: string;
  content: string;
  game_id: string;
  games: {
    id: string;
    name: string;
    slug: string;
  } | null;
  author_pseudo: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  user_id: string;
  avatar_url?: string | null;
  likes_count?: number;
  isLikedByMe?: boolean;
};


type Comment = {
  id: string;
  post_id: string;
  author_pseudo: string;
  content: string;
  created_at: string;
  user_id?: string | null;
  likes_count?: number;
  isLikedByMe?: boolean;
  parent_id?: string | null;
  avatar_url?: string | null;
};


type Notification = {
  type: "success" | "error";
  message: string;
};

export default function FeedView({
  forcedGameId,
  forcedUserId,
}: {
  forcedGameId?: string;
  forcedUserId?: string;
}) {

  const router = useRouter();
const searchParams = useSearchParams();
const pathname = usePathname();



  const [myId, setMyId] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState<string>("");

  // ✅ ÉTATS EXPLICITES : loading / error / empty
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);

  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<Record<string, string | null>>({});
  const [newPost, setNewPost] = useState("");
  const [games, setGames] = useState<
  { id: string; name: string; slug: string }[]
>([]);

const [selectedGameId, setSelectedGameId] = useState<string>("");
const [mediaFiles, setMediaFiles] = useState<File[]>([]);
const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
const [mediaValidationError, setMediaValidationError] = useState<string | null>(null);
const [mediaDimensions, setMediaDimensions] = useState<{ width: number; height: number }[]>([]);
const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
const [showPreviewInfo, setShowPreviewInfo] = useState<Record<number, boolean>>({});
  const [postCarouselIndices, setPostCarouselIndices] = useState<Record<string, number>>({});
const [filterGameId, setFilterGameId] = useState<string>(
  forcedGameId ?? "all"
);
const [showCreatePost, setShowCreatePost] = useState<boolean>(false);

  // Weekly showcase
  const [weeklyPosts, setWeeklyPosts] = useState<Post[]>([]);
  const [weeklyCarouselIndex, setWeeklyCarouselIndex] = useState(0);
  const [weeklyAutoRotateTimer, setWeeklyAutoRotateTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedWeeklyPost, setSelectedWeeklyPost] = useState<Post | null>(null);
  const [hasVotedThisWeek, setHasVotedThisWeek] = useState(false);



  // Édition de post
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");

  // Menu ⋮ ouvert pour quel post
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);

useEffect(() => {
  return () => {
    isMountedRef.current = false;
  };
}, []);

  // Cleanup des object URLs
  useEffect(() => {
    return () => {
      mediaPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [mediaPreviews]);

  // Notifications
  const [notification, setNotification] = useState<Notification | null>(null);

  // Effacer le message d'erreur de jeu quand un jeu est sélectionné
  useEffect(() => {
    if (selectedGameId && selectedGameId.trim()) {
      // Si une notification d'erreur de jeu est affichée, l'effacer
      if (notification?.type === "error" && notification?.message === "Please select a game before publishing your post.") {
        setNotification(null);
      }
    }
  }, [selectedGameId, notification]);

const [openComments, setOpenComments] = useState<Record<string, boolean>>({});


  const showNotification = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Fermer le menu ⋮ si clic à l’extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuPostId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // -----------------------------------------------------
// Vérifier session - VERSION ROBUSTE
// -----------------------------------------------------
useEffect(() => {
  let mounted = true;

  const loadUser = async () => {
    try {
      // Méthode principale: getUser() (plus fiable)
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        // Fallback: getSession()
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !sessionData?.session?.user) {
          console.error("No authenticated user found");
          if (mounted) {
            router.push("/login");
          }
          return;
        }

        if (!mounted) return;
        const userId = sessionData.session.user.id;
        setMyId(userId);

        // Charger le pseudo
        const { data: profile } = await supabase
          .from("profiles")
          .select("pseudo")
          .eq("id", userId)
          .single();

        if (!mounted) return;
        setPseudo(profile?.pseudo || "Utilisateur");
        return;
      }

      // getUser() a réussi
      if (!mounted) return;
      const userId = userData.user.id;
      setMyId(userId);

      // Charger le pseudo
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("pseudo")
        .eq("id", userId)
        .single();

      if (profileError) {
        console.error("Profile error:", profileError);
      }

      if (!mounted) return;
      setPseudo(profile?.pseudo || "Utilisateur");
    } catch (err: any) {
      // navigation / hot reload / fetch interrompu
      if (
        err?.name === "AbortError" ||
        String(err?.message || err).includes("Failed to fetch")
      ) {
        return;
      }
      console.error("Error loading user:", err);
      if (mounted) {
        router.push("/login");
      }
    }
  };

  // Charger immédiatement
  loadUser();

  // Écouter les changements d'authentification
  const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (!mounted) return;

    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      if (session?.user) {
        setMyId(session.user.id);

        // Charger le pseudo
        const { data: profile } = await supabase
          .from("profiles")
          .select("pseudo")
          .eq("id", session.user.id)
          .single();

        if (!mounted) return;
        setPseudo(profile?.pseudo || "Utilisateur");
      }
    } else if (event === "SIGNED_OUT") {
      setMyId(null);
      setPseudo("");
      router.push("/login");
    }
  });

  return () => {
    mounted = false;
    authListener.subscription.unsubscribe();
  };
}, []); // Exécuter seulement au montage du composant

// Vérifier si myId n'est pas chargé après un délai (safety check)
useEffect(() => {
  const timer = setTimeout(() => {
    if (!myId) {
      // Vérifier une dernière fois avec getUser()
      supabase.auth.getUser().then(({ data, error }) => {
        if (!error && data?.user) {
          setMyId(data.user.id);
        } else {
          // Afficher une notification si vraiment pas de session
          showNotification("Your session could not be loaded. Please refresh the page.", "error");
        }
      });
    }
  }, 2000); // Attendre 2 secondes avant de vérifier

  return () => clearTimeout(timer);
}, [myId, showNotification]);

// ✅ Charger les données avec gestion d'erreur explicite
// On attend que filterGameId soit stable avant de charger
useEffect(() => {
  // Réinitialiser l'état à chaque changement de filtre
  setPostsLoading(true);
  setPostsError(null);
  
  // Charger les données (myId peut être null, on gère ça dans loadAllData)
  loadAllData().catch((err) => {
    console.error("Error in loadAllData:", err);
    setPostsError("Failed to load posts. Please refresh the page.");
    setPostsLoading(false);
  });
}, [filterGameId, pathname, forcedGameId, forcedUserId]); // ✅ Retirer myId des dépendances pour éviter les recharges inutiles



useEffect(() => {
  // 1) Forced (ex: page /games/[slug])
  if (forcedGameId) {
    setFilterGameId(forcedGameId);
    return;
  }

  // 2) URL param ?game=
  const gameFromUrl = searchParams.get("game");
  if (gameFromUrl) {
    setFilterGameId(gameFromUrl);
    return;
  }

  // 3) Retour sur /feed sans param → reset propre
  if (pathname === "/feed") {
    setFilterGameId("all");
  }
}, [pathname, searchParams, forcedGameId]);


  // -----------------------------------------------------
  // Charger posts + commentaires (+ likes)
  // -----------------------------------------------------
  const loadAllData = async () => {
    try {
      // ✅ Charger les jeux d'abord (non-bloquant)
      const { data: gamesData, error: gamesError } = await supabase
        .from("games")
        .select("id, name, slug")
        .order("name");

      if (gamesError) {
        console.error("Games error:", gamesError);
      } else {
        setGames(gamesData || []);
      }

      // ✅ Charger les posts avec gestion d'erreur explicite
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
        .order("created_at", { ascending: false });

      if (forcedGameId && forcedGameId !== "all") {
        postsQuery = postsQuery.eq("game_id", forcedGameId);
      }

      if (forcedUserId) {
        postsQuery = postsQuery.eq("user_id", forcedUserId);
      }

      if (filterGameId !== "all") {
        postsQuery = postsQuery.eq("game_id", filterGameId);
      }

      const { data: postsData, error: postsError } = await postsQuery;

      // ✅ Gestion d'erreur explicite
      if (postsError) {
        console.error("Posts error:", postsError);
        setPostsError("Failed to load posts. Please try again.");
        setPostsLoading(false);
        showNotification("Error loading posts", "error");
        return;
      }

      // ✅ Si pas d'erreur mais pas de données, c'est un état vide valide
      if (!postsData) {
        setPosts([]);
        setPostsLoading(false);
        setPostsError(null);
        return;
      }


    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, avatar_url");

    if (profilesError) {
      console.error(profilesError);
    }

    const avatarMap: Record<string, string | null> = {};
    profiles?.forEach((p) => {
      avatarMap[p.id] = p.avatar_url;
    });

    // 🔥 Récupérer les likes de l'utilisateur connecté (pour isLikedByMe)
    let myLikesMap: Record<string, boolean> = {};
    if (myId) {
      const { data: myLikes, error: myLikesError } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", myId);

      if (myLikesError) {
        console.error(myLikesError);
      } else if (myLikes) {
        myLikesMap = myLikes.reduce((acc: Record<string, boolean>, row: any) => {
          acc[row.post_id] = true;
          return acc;
        }, {});
      }
    }

      // ✅ Formater les posts (même si myId est null, on peut afficher les posts)
      const postsFormatted: Post[] =
        postsData.map((p: any) => {
          const likesArray = p.likes || [];
          const likesCount =
            Array.isArray(likesArray) && likesArray[0]?.count
              ? likesArray[0].count
              : 0;

          return {
            ...p,
            avatar_url: avatarMap[p.user_id] || null,
            likes_count: likesCount,
            isLikedByMe: !!myLikesMap[p.id], // ✅ myId peut être null, isLikedByMe sera false
          };
        });

      setPosts(postsFormatted);
      setPostsLoading(false);
      setPostsError(null);

      // ✅ Charger les commentaires (non-bloquant pour l'affichage des posts)
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select(`
          id,
          post_id,
          user_id,
          author_pseudo,
          content,
          created_at,
          parent_id,
          comment_likes(count)
        `)
        .order("created_at", { ascending: true });

      // ✅ Erreur de commentaires n'empêche pas l'affichage des posts
      if (commentsError) {
        console.error("Comments error:", commentsError);
        // On continue quand même, les commentaires seront vides
      }


    // Formater les commentaires avec le compteur de likes
    const baseComments: Comment[] =
      commentsData?.map((c: any) => {
        const likesArray = c.comment_likes || [];
        const likesCount =
          Array.isArray(likesArray) && likesArray[0]?.count
            ? likesArray[0].count
            : 0;

        return {
          ...c,
          likes_count: likesCount,
          isLikedByMe: false, // sera ajusté juste après
        };
      }) || [];

    // Récupérer les likes de commentaires de l'utilisateur connecté
    let myCommentLikesMap: Record<string, boolean> = {};
    if (myId) {
      const { data: myCommentLikes, error: myCommentLikesError } =
        await supabase
          .from("comment_likes")
          .select("comment_id")
          .eq("user_id", myId);

      if (myCommentLikesError) {
        console.error(myCommentLikesError);
      } else if (myCommentLikes) {
        myCommentLikesMap = myCommentLikes.reduce(
          (acc: Record<string, boolean>, row: any) => {
            acc[row.comment_id] = true;
            return acc;
          },
          {}
        );
      }
    }

      const commentsWithFlags = (commentsData || []).map((c: any) => {
        const likesArray = c.comment_likes || [];
        const likesCount =
          Array.isArray(likesArray) && likesArray[0]?.count
            ? likesArray[0].count
            : 0;

        return {
          ...c,
          likes_count: likesCount,
          isLikedByMe: !!myCommentLikesMap[c.id], // ✅ myId peut être null
          avatar_url: avatarMap[c.user_id ?? ""] || null,
        };
      });

      setComments(commentsWithFlags);
    } catch (err) {
      // ✅ Gestion d'erreur globale
      console.error("Error in loadAllData:", err);
      setPostsError("An unexpected error occurred. Please refresh the page.");
      setPostsLoading(false);
    }
  };

  // -----------------------------------------------------
  // Helper: Calculate current week start (Monday)
  // -----------------------------------------------------
  const getCurrentWeekStart = (): string => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday = 1
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  // -----------------------------------------------------
  // Load weekly posts (top 3 by votes)
  // -----------------------------------------------------
  const loadWeeklyPosts = async () => {
    const weekStartStr = getCurrentWeekStart();

    // Get top 3 posts by weekly votes from Supabase
    const { data: votesData, error: votesError } = await supabase
      .from("weekly_post_votes")
      .select("post_id")
      .eq("week_start", weekStartStr);

    // If error or no votes, don't display any posts (no fallback)
    if (votesError) {
      console.error("Error loading weekly votes:", votesError);
      setWeeklyPosts([]);
      return;
    }

    if (!votesData || votesData.length === 0) {
      // No votes for this week: don't display any posts
      setWeeklyPosts([]);
      return;
    }

    // Count votes per post
    const voteCounts: Record<string, number> = {};
    votesData.forEach((v: any) => {
      voteCounts[v.post_id] = (voteCounts[v.post_id] || 0) + 1;
    });

    // Get top 3 post IDs
    const topPostIds = Object.entries(voteCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => id);

    if (topPostIds.length === 0) {
      setWeeklyPosts([]);
      return;
    }

    // Fetch the posts
    const { data: postsData } = await supabase
      .from("posts")
      .select(`
        *,
        games (id, name, slug),
        likes(count)
      `)
      .in("id", topPostIds);

    if (!postsData) {
      setWeeklyPosts([]);
      return;
    }

    // Get avatars
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, avatar_url");

    const avatarMap: Record<string, string | null> = {};
    profiles?.forEach((p) => {
      avatarMap[p.id] = p.avatar_url;
    });

    // Get user likes
    let myLikesMap: Record<string, boolean> = {};
    if (myId) {
      const { data: myLikes } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", myId)
        .in("post_id", topPostIds);

      if (myLikes) {
        myLikesMap = myLikes.reduce((acc: Record<string, boolean>, row: any) => {
          acc[row.post_id] = true;
          return acc;
        }, {});
      }
    }

    // Format posts maintaining order
    const formatted = topPostIds
      .map((id) => {
        const p = postsData.find((post: any) => post.id === id);
        if (!p) return null;

        const likesArray = p.likes || [];
        const likesCount = Array.isArray(likesArray) && likesArray[0]?.count ? likesArray[0].count : 0;

        return {
          ...p,
          avatar_url: avatarMap[p.user_id] || null,
          likes_count: likesCount,
          isLikedByMe: !!myLikesMap[p.id],
        };
      })
      .filter((p): p is Post => p !== null);

    setWeeklyPosts(formatted);
  };

  // Check if user has voted this week
  // Reads from Supabase with localStorage fallback
  const checkVoteStatus = async () => {
    if (!myId) {
      setHasVotedThisWeek(false);
      return;
    }

    const weekStartStr = getCurrentWeekStart();

    try {
      // Try to read from Supabase first
      const { data, error } = await supabase
        .from("weekly_post_votes")
        .select("id")
        .eq("user_id", myId)
        .eq("week_start", weekStartStr)
        .limit(1);

      if (error) {
        // If Supabase error, fallback to localStorage
        console.warn("Error reading vote status from Supabase, using localStorage fallback:", error);
        const storageKey = `weekly_vote_${myId}_${weekStartStr}`;
        const hasVoted = localStorage.getItem(storageKey) === 'true';
        setHasVotedThisWeek(hasVoted);
        return;
      }

      // Success: check if vote exists
      setHasVotedThisWeek(!!data && Array.isArray(data) && data.length > 0);
    } catch (err) {
      // Handle unexpected exceptions, fallback to localStorage
      console.error("Exception in checkVoteStatus, using localStorage fallback:", err);
      try {
        const storageKey = `weekly_vote_${myId}_${weekStartStr}`;
        const hasVoted = localStorage.getItem(storageKey) === 'true';
        setHasVotedThisWeek(hasVoted);
      } catch (localStorageErr) {
        // If localStorage also fails, assume user hasn't voted
        setHasVotedThisWeek(false);
      }
    }
  };

  // Load weekly posts on mount and when myId changes
  useEffect(() => {
    if (!forcedGameId && !forcedUserId) {
      loadWeeklyPosts();
      checkVoteStatus(); // checkVoteStatus is async but we don't need to await here
    }
  }, [myId, forcedGameId, forcedUserId]);

  // Auto-rotate weekly carousel every 8 seconds
  useEffect(() => {
    if (weeklyPosts.length === 0 || weeklyPosts.length <= 1) return;

    const timer = setInterval(() => {
      setWeeklyCarouselIndex((prev) => (prev + 1) % weeklyPosts.length);
    }, 8000);

    setWeeklyAutoRotateTimer(timer);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [weeklyPosts.length]);

  // Reset auto-rotate timer on manual navigation
  const handleWeeklyNav = (direction: "prev" | "next") => {
    if (weeklyAutoRotateTimer) {
      clearInterval(weeklyAutoRotateTimer);
      setWeeklyAutoRotateTimer(null);
    }

    if (direction === "prev") {
      setWeeklyCarouselIndex((prev) => (prev - 1 + weeklyPosts.length) % weeklyPosts.length);
    } else {
      setWeeklyCarouselIndex((prev) => (prev + 1) % weeklyPosts.length);
    }

    // Restart timer after 8 seconds
    setTimeout(() => {
      const timer = setInterval(() => {
        setWeeklyCarouselIndex((prev) => (prev + 1) % weeklyPosts.length);
      }, 8000);
      setWeeklyAutoRotateTimer(timer);
    }, 8000);
  };

  // Handle vote
  // Saves to Supabase with localStorage fallback
  const handleVote = async (postId: string) => {
    if (!myId) return;

    const weekStartStr = getCurrentWeekStart();

    try {
      // Try to insert into Supabase first
      const { data, error } = await supabase
        .from("weekly_post_votes")
        .insert({
          user_id: myId,
          post_id: postId,
          week_start: weekStartStr,
        })
        .select()
        .single();

      if (error) {
        // Check if error is due to unique constraint (already voted)
        if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
          // User already voted this week
          setHasVotedThisWeek(true);
          showNotification("You have already voted this week.", "error");
          await checkVoteStatus(); // Sync state
          return;
        }

        // Other error: fallback to localStorage
        console.warn("Error saving vote to Supabase, using localStorage fallback:", error);
        try {
          const storageKey = `weekly_vote_${myId}_${weekStartStr}`;
          localStorage.setItem(storageKey, 'true');
          setHasVotedThisWeek(true);
          showNotification("Vote recorded (local storage)!", "success");
        } catch (localStorageErr) {
          console.error("Error saving vote to localStorage:", localStorageErr);
          showNotification("Failed to record vote. Please try again.", "error");
          return;
        }
      } else {
        // Success: vote saved to Supabase
        setHasVotedThisWeek(true);
        showNotification("Vote recorded!", "success");
        
        // Also save to localStorage as backup
        try {
          const storageKey = `weekly_vote_${myId}_${weekStartStr}`;
          localStorage.setItem(storageKey, 'true');
        } catch (localStorageErr) {
          // Ignore localStorage errors if Supabase succeeded
        }
      }

      await loadWeeklyPosts();
      await checkVoteStatus();
    } catch (err) {
      // Handle unexpected exceptions
      console.error("Exception in handleVote:", err);
      showNotification("Failed to record vote. Please try again.", "error");
    }
  };


  // -----------------------------------------------------
  // Validate media dimensions and aspect ratio
  // -----------------------------------------------------
  const validateMedia = (file: File): Promise<{
    isValid: boolean;
    errorMessage: string | null;
    width: number;
    height: number;
  }> => {
    return new Promise((resolve) => {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");

      if (!isImage && !isVideo) {
        resolve({
          isValid: false,
          errorMessage: "Format non supporté. Utilisez une image ou une vidéo.",
          width: 0,
          height: 0,
        });
        return;
      }

      if (isImage) {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const width = img.width;
          const height = img.height;

          // Vérifier dimensions minimales (720px minimum)
          if (width < 720 || height < 720) {
            resolve({
              isValid: false,
              errorMessage: "Dimensions insuffisantes",
              width,
              height,
            });
            return;
          }

          // Calculer le ratio
          const ratio = width / height;

          // Rejeter les formats ultra-verticaux (ratio < 0.75)
          // Rejeter les formats ultra-larges (ratio > 2.2)
          if (ratio < 0.75 || ratio > 2.2) {
            resolve({
              isValid: false,
              errorMessage: "Ratio non autorisé",
              width,
              height,
            });
            return;
          }

          resolve({
            isValid: true,
            errorMessage: null,
            width,
            height,
          });
        };

        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve({
            isValid: false,
            errorMessage: "Impossible de charger l'image. Vérifiez le format du fichier.",
            width: 0,
            height: 0,
          });
        };

        img.src = objectUrl;
      } else if (isVideo) {
        const video = document.createElement("video");
        const objectUrl = URL.createObjectURL(file);

        video.onloadedmetadata = () => {
          URL.revokeObjectURL(objectUrl);
          const width = video.videoWidth;
          const height = video.videoHeight;

          // Vérifier dimensions minimales (720px minimum)
          if (width < 720 || height < 720) {
            resolve({
              isValid: false,
              errorMessage: "Dimensions insuffisantes",
              width,
              height,
            });
            return;
          }

          // Calculer le ratio
          const ratio = width / height;

          // Rejeter les formats ultra-verticaux (ratio < 0.75)
          // Rejeter les formats ultra-larges (ratio > 2.2)
          if (ratio < 0.75 || ratio > 2.2) {
            resolve({
              isValid: false,
              errorMessage: "Ratio non autorisé",
              width,
              height,
            });
            return;
          }

          resolve({
            isValid: true,
            errorMessage: null,
            width,
            height,
          });
        };

        video.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve({
            isValid: false,
            errorMessage: "Impossible de charger la vidéo. Vérifiez le format du fichier.",
            width: 0,
            height: 0,
          });
        };

        video.src = objectUrl;
        video.load();
      }
    });
  };

  // -----------------------------------------------------
  // Upload media (supports multiple photos) - VERSION BEST-EFFORT
  // -----------------------------------------------------
  const uploadMedia = async (): Promise<{
    urls: string[];
    type: string | null;
    skippedCount: number;
  }> => {
    // Si aucun fichier, retourner vide (post sans média)
    if (mediaFiles.length === 0) {
      return { urls: [], type: null, skippedCount: 0 };
    }

    const uploadedUrls: string[] = [];
    const baseTimestamp = Date.now();
    let skippedCount = 0;

    // Uploader chaque fichier individuellement - continuer même si un échoue
    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i];
      const ext = file.name.split(".").pop() || "bin";
      // Utiliser un timestamp unique par fichier pour éviter les conflits
      const path = `${baseTimestamp}-${i}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

      try {
        const { error } = await supabase.storage
          .from("posts-media")
          .upload(path, file);

        if (error) {
          console.error(`Upload error for file ${i + 1}:`, error);
          skippedCount++;
          // Continuer avec les autres fichiers au lieu de tout abandonner
          continue;
        }

        const { data } = supabase.storage
          .from("posts-media")
          .getPublicUrl(path);

        if (!data?.publicUrl) {
          console.error(`Failed to get public URL for file ${i + 1}`);
          skippedCount++;
          // Nettoyer le fichier uploadé mais sans URL
          try {
            await supabase.storage.from("posts-media").remove([path]);
          } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr);
          }
          continue;
        }

        uploadedUrls.push(data.publicUrl);
      } catch (err) {
        console.error(`Exception during upload for file ${i + 1}:`, err);
        skippedCount++;
        // Continuer avec les autres fichiers
        continue;
      }
    }

    // Déterminer le type (tous les fichiers doivent être du même type)
    const type = mediaFiles[0].type.startsWith("image/")
      ? "image"
      : mediaFiles[0].type.startsWith("video/")
      ? "video"
      : null;

    console.log(`Successfully uploaded ${uploadedUrls.length} file(s), skipped ${skippedCount}, type: ${type}`);
    return { urls: uploadedUrls, type, skippedCount };
  };

  // -----------------------------------------------------
  // Supprimer un fichier dans Storage
  // -----------------------------------------------------
  const deleteMediaFile = async (mediaUrl: string | null) => {
    if (!mediaUrl) return;

    const parts = mediaUrl.split("/posts-media/");
    if (parts.length < 2) return;

    const path = parts[1];

    const { error } = await supabase.storage
      .from("posts-media")
      .remove([path]);

    if (error) {
      console.error("Erreur suppression Storage :", error);
    }
  };

  // -----------------------------------------------------
  // Create a post - VERSION CORRIGÉE ET COHÉRENTE
  // -----------------------------------------------------
  const handleCreatePost = async () => {
    // ============================================
    // VALIDATION INITIALE
    // ============================================
    if (!myId) {
      showNotification("Vous devez être connecté pour publier", "error");
      return;
    }

    const hasText = newPost.trim().length > 0;
    const hasMedia = mediaFiles.length > 0;

    if (!hasText && !hasMedia) {
      showNotification("Le post doit contenir du texte ou au moins un média (photo/vidéo)", "error");
      return;
    }

    // Validation: un jeu doit être sélectionné
    if (!selectedGameId || !selectedGameId.trim()) {
      showNotification("Please select a game before publishing your post.", "error");
      return;
    }

    // Note: mediaValidationError n'est défini que si TOUS les fichiers sont invalides
    // Si certains sont valides, ils sont gardés et mediaValidationError n'est pas défini
    if (hasMedia && mediaValidationError && mediaFiles.length > 0) {
      // Vérifier si on a au moins un fichier valide (dimensions définies = fichiers validés)
      if (mediaDimensions.length === 0) {
        // Aucun fichier valide, bloquer
        showNotification("Veuillez corriger les erreurs de validation avant de publier", "error");
        return;
      }
      // Sinon, on a des fichiers valides, continuer (les invalides ont déjà été filtrés)
    }

    // ============================================
    // UPLOAD DES MÉDIAS (BEST-EFFORT)
    // ============================================
    let uploadedUrls: string[] = [];
    let mediaType: string | null = null;
    let skippedCount = 0;

    if (hasMedia) {
      const uploadResult = await uploadMedia();
      uploadedUrls = uploadResult.urls;
      mediaType = uploadResult.type;
      skippedCount = uploadResult.skippedCount;

      // Vérification de cohérence pour vidéo
      if (mediaType === "video" && uploadedUrls.length > 1) {
        console.error("Inconsistency: video type but multiple URLs");
        showNotification("Erreur: une vidéo ne peut pas avoir plusieurs URLs", "error");
        return;
      }

      // Bloquer seulement si TOUTES les photos ont échoué ET pas de texte
      if (uploadedUrls.length === 0 && !hasText) {
        if (skippedCount > 0) {
          showNotification("All files failed to upload. Please try again or add text content.", "error");
        } else {
          showNotification("Erreur lors de l'upload des médias. Le post n'a pas été créé.", "error");
        }
        return;
      }

      // Afficher un avertissement si certaines photos ont été ignorées
      if (skippedCount > 0 && uploadedUrls.length > 0) {
        const skippedMessage = skippedCount === 1
          ? "1 file was skipped because it was invalid or failed to upload."
          : `${skippedCount} files were skipped because they were invalid or failed to upload.`;
        // Afficher comme notification d'avertissement (non-bloquante)
        showNotification(skippedMessage, "error");
      }
    }

    // ============================================
    // CONSTRUCTION DU PAYLOAD SUPABASE
    // ============================================
    const authorPseudo = pseudo || "Utilisateur";
    const postContent = newPost.trim() || ""; // Toujours une string, jamais null

    // Construction du payload - TOUS les champs explicitement définis (null si non utilisé)
    const postData: {
      user_id: string;
      content: string;
      author_pseudo: string;
      game_id: string | null;
      media_url: string | null;
      media_type: string | null;
    } = {
      user_id: myId,
      content: postContent,
      author_pseudo: authorPseudo,
      game_id: (selectedGameId && selectedGameId.trim()) ? selectedGameId : null,
      media_url: null,
      media_type: null,
    };

    // Ajouter les médias de manière cohérente (même si certains ont été ignorés)
    if (hasMedia && uploadedUrls.length > 0 && mediaType) {
      // Format: string simple si 1 média, JSON array si plusieurs photos
      if (uploadedUrls.length === 1) {
        postData.media_url = uploadedUrls[0];
      } else {
        // Plusieurs photos: JSON array stringifié
        postData.media_url = JSON.stringify(uploadedUrls);
      }
      postData.media_type = mediaType;
    } else if (hasMedia && uploadedUrls.length === 0) {
      // Si on avait des médias mais aucun n'a été uploadé avec succès
      // Et qu'on a du texte, on peut quand même publier sans média
      // (déjà géré par la validation ci-dessus qui bloque si pas de texte)
    }

    // Validation finale - s'assurer qu'aucun champ n'est undefined
    const cleanPostData: Record<string, any> = {};
    for (const [key, value] of Object.entries(postData)) {
      // Convertir undefined en null explicitement
      cleanPostData[key] = value === undefined ? null : value;
    }

    console.log("Post data to insert:", JSON.stringify(cleanPostData, null, 2));

    // ============================================
    // INSERTION DANS SUPABASE
    // ============================================
    try {
      const { data, error } = await supabase.from("posts").insert(cleanPostData);

      if (error) {
        console.error("Supabase insert error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error,
        });
        
        const errorMessage = error.message || error.details || error.hint || error.code || "Erreur inconnue lors de la création du post";
        showNotification(`Erreur: ${errorMessage}`, "error");
        return;
      }

      console.log("Post created successfully:", data);

      // ============================================
      // RESET DU FORMULAIRE
      // ============================================
      setNewPost("");
      setSelectedGameId("");
      mediaPreviews.forEach(url => URL.revokeObjectURL(url));
      setMediaFiles([]);
      setMediaPreviews([]);
      setMediaValidationError(null);
      setMediaDimensions([]);
      setCurrentPreviewIndex(0);
      setShowPreviewInfo({});
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      showNotification("Post published!");
      await loadAllData();
    } catch (err) {
      console.error("Exception in handleCreatePost:", err);
      showNotification("Erreur inattendue lors de la création du post", "error");
    }
  };

  // -----------------------------------------------------
  // Add a comment + Notification
  // -----------------------------------------------------
  const handleAddComment = async (postId: string, parentId?: string) => {
    if (!myId) {
      console.error("handleAddComment: myId is null");
      return;
    }

    const content = newComments[postId];
    if (!content || !content.trim()) {
      console.error("handleAddComment: content is empty");
      return;
    }

    try {
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        parent_id: parentId ?? null,
        content: content.trim(),
        author_pseudo: pseudo,
        user_id: myId,
      });

      if (error) {
        console.error("Error adding comment:", error);
        showNotification("Error adding comment", "error");
        return;
      }

      // 🔍 Get post author
      const post = posts.find((p) => p.id === postId);

      // 🛑 Do not notify yourself
      if (post && post.user_id !== myId) {
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          from_user_id: myId,
          type: "comment",
          post_id: postId,
          message: `${pseudo} commented on your post`,
        });
      }

      setNewComments((prev) => ({ ...prev, [postId]: "" }));
      setReplyTo((prev) => ({ ...prev, [postId]: null }));
      showNotification("Comment added");
      await loadAllData();
    } catch (err) {
      console.error("Exception in handleAddComment:", err);
      showNotification("Error adding comment", "error");
    }
  };


  // -----------------------------------------------------
  // DELETE comment
  // -----------------------------------------------------
  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      console.error(error);
      showNotification("Error deleting comment", "error");
      return;
    }

    setComments((prev) => prev.filter((c) => c.id !== commentId));
    showNotification("Comment deleted");
  };

  // -----------------------------------------------------
  // Delete post (with browser confirm)
  // -----------------------------------------------------
  const handleDeletePost = async (postId: string) => {
    if (!myId) return;

    const confirmed = window.confirm(
      "Delete this post? This action is permanent. The attached media will also be removed."
    );
    if (!confirmed) return;

    const post = posts.find((p) => p.id === postId);
    const mediaUrl = post?.media_url || null;

    if (mediaUrl) {
      await deleteMediaFile(mediaUrl);
    }

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", myId);

    if (error) {
      console.error("Error deleting post:", error);
      showNotification("Error deleting post", "error");
      return;
    }

    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showNotification("Post deleted");
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


  // -----------------------------------------------------
  // Edit post
  // -----------------------------------------------------
  const handleStartEditPost = (post: Post) => {
  setEditingPostId(post.id);
  setEditContent(post.content);
  setSelectedGameId(post.game_id);
  setOpenMenuPostId(null);
};

  const handleCancelEditPost = () => {
  setEditingPostId(null);
  setEditContent("");
  setSelectedGameId("");
  // Note: mediaFiles n'est pas réinitialisé ici car on ne modifie pas les médias lors de l'édition
};


  const handleSaveEditPost = async () => {
  if (!editingPostId || !myId || !editContent.trim() || !selectedGameId) return;

  const { error } = await supabase
    .from("posts")
    .update({
      content: editContent,
      game_id: selectedGameId,
    })
    .eq("id", editingPostId)
    .eq("user_id", myId);

  if (error) {
    console.error("Error editing post:", error);
    showNotification("Error editing post", "error");
    return;
  }

  // Reload propre pour récupérer la jointure games
  await loadAllData();

  setEditingPostId(null);
  setEditContent("");
  setSelectedGameId("");
  showNotification("Post updated");
};


  // -----------------------------------------------------
  // LIKE / UNLIKE post
  // -----------------------------------------------------
  const handleToggleLike = async (postId: string) => {
    if (!myId) {
      console.error("handleToggleLike: myId is null");
      return;
    }

    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) {
      console.error("handleToggleLike: post not found", postId);
      return;
    }

    const currentlyLiked = !!targetPost?.isLikedByMe;

    // Mise à jour optimiste locale IMMÉDIATE
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const delta = currentlyLiked ? -1 : 1;
        const currentCount = p.likes_count ?? 0;
        return {
          ...p,
          likes_count: Math.max(0, currentCount + delta),
          isLikedByMe: !currentlyLiked,
        };
      })
    );

    try {
      if (currentlyLiked) {
        // UNLIKE : on supprime uniquement le like de ce user
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", myId);

        if (error) {
          console.error("Error unliking:", error);
          // Rollback optimiste
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id !== postId) return p;
              return {
                ...p,
                likes_count: targetPost.likes_count ?? 0,
                isLikedByMe: currentlyLiked,
              };
            })
          );
          showNotification("Error while unliking", "error");
          return;
        }
      } else {
        // LIKE : on insère le like
        const { error } = await supabase.from("likes").insert({
          post_id: postId,
          user_id: myId,
        });

        if (error) {
          console.error("Error liking:", error);
          // Rollback optimiste
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id !== postId) return p;
              return {
                ...p,
                likes_count: targetPost.likes_count ?? 0,
                isLikedByMe: currentlyLiked,
              };
            })
          );
          showNotification("Error while liking", "error");
          return;
        }
      }
    } catch (err) {
      console.error("Exception in handleToggleLike:", err);
      // Rollback optimiste
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            likes_count: targetPost.likes_count ?? 0,
            isLikedByMe: currentlyLiked,
          };
        })
      );
      showNotification("Error while toggling like", "error");
    }
  };

// ---------------------
// TYPES POUR THREADS
// ---------------------
type CommentNode = Comment & {
  parent_id?: string | null;
  replies: CommentNode[];
};

// ---------------------
// BUILD COMMENT TREE
// ---------------------
function buildCommentTree(allComments: Comment[]): CommentNode[] {
  const map: Record<string, CommentNode> = {};
  const tree: CommentNode[] = [];

  allComments.forEach((c: any) => {
    map[c.id] = { ...c, replies: [], parent_id: c.parent_id || null };
  });

  allComments.forEach((c: any) => {
    if (c.parent_id && map[c.parent_id]) {
      map[c.parent_id].replies.push(map[c.id]);
    } else if (!c.parent_id) {
      tree.push(map[c.id]);
    }
  });

  return tree;
}

// ---------------------
// RENDER THREADED COMMENT (Instagram / TikTok style)
// ---------------------
function renderThreadedComment(comment: CommentNode, depth: number, post: Post) {
  const canDelete =
    (comment.user_id && comment.user_id === myId) ||
    comment.author_pseudo === pseudo;

  return (
    <div
      key={comment.id}
      className="comment-wrapper"
    >
      <div className="comment-body glass-comment">
        <div className="comment-header-with-avatar">
          <Link href={`/profile/${comment.user_id}`}>
            <img
              src={
                comment.avatar_url ||
                "https://via.placeholder.com/32/333333/FFFFFF?text=?"
              }
              className="comment-avatar"
              alt={comment.author_pseudo}
            />
          </Link>
          <div className="comment-header-content">
            <Link
              href={`/profile/${comment.user_id}`}
              className="comment-author clickable-author"
            >
              {comment.author_pseudo}
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
                setNewComments(prev => ({
                  ...prev,
                  [post.id]: `@${comment.author_pseudo} `
                }));
                setReplyTo(prev => ({ ...prev, [post.id]: comment.id }));
              }}
              type="button"
            >
              Reply
            </button>

            {canDelete && (
              <button
                className="btn danger-btn"
                onClick={() => handleDeleteComment(comment.id)}
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

        {comment.replies.length > 0 && (
          <div className="comment-replies-wrapper" style={{ marginLeft: 40 }}>
            {comment.replies.map(child =>
              renderThreadedComment(child, depth + 1, post)
            )}
          </div>
        )}
      </div>
    </div>
  );
}




    // -----------------------------------------------------
  // RENDER
  // -----------------------------------------------------
  return (
    <>
      <div className="feed-container">
        {/* Notification */}
        {notification && (
          <div
            className={`notification ${
              notification.type === "success" ? "notif-success" : "notif-error"
            }`}
          >
            {notification.message}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h1 className="feed-title" style={{ marginBottom: 0, marginTop: 0 }}>News Feed</h1>
          <button
            className="create-post-toggle-btn"
            onClick={() => setShowCreatePost(!showCreatePost)}
            type="button"
            aria-label={showCreatePost ? "Hide create post form" : "Show create post form"}
          >
            {showCreatePost ? "−" : "+"}
          </button>
        </div>

<select
  className="input"
  value={filterGameId}
  onChange={(e) => {
  const value = e.target.value;

  // 🔁 All games → feed global
  if (value === "all") {
    router.push("/feed");
    return;
  }

  // 🔁 Jeu spécifique → page /games/[slug]
  const game = games.find((g) => g.id === value);
  if (game) {
    router.push(`/games/${game.slug}`);
  }
}}

  style={{ maxWidth: 220, marginBottom: 20 }}
>
  <option value="all">All games</option>
  {games.map((game) => (
    <option key={game.id} value={game.id}>
      {game.name}
    </option>
  ))}
</select>

        {/* Weekly Showcase - Only show on main feed */}
        {!forcedGameId && !forcedUserId && weeklyPosts.length > 0 && (
          <div className="weekly-showcase">
            <h2 className="weekly-showcase-title">Posts of the Week</h2>
            <div className="weekly-carousel-wrapper">
              <button
                className="weekly-carousel-nav weekly-carousel-nav-left"
                onClick={() => handleWeeklyNav("prev")}
                type="button"
                aria-label="Previous post"
              >
                <ChevronLeftIcon className="icon-24" />
              </button>

              <div className="weekly-carousel">
                <div
                  className="weekly-carousel-slider"
                  style={{ transform: `translateX(-${weeklyCarouselIndex * 100}%)` }}
                >
                  {weeklyPosts.map((post, index) => {
                    // Parse media URLs (can be single string or JSON array)
                    let imageUrls: string[] = [];
                    if (post.media_type === "image" && post.media_url) {
                      try {
                        const parsed = JSON.parse(post.media_url);
                        if (Array.isArray(parsed)) {
                          imageUrls = parsed;
                        } else {
                          imageUrls = [post.media_url];
                        }
                      } catch {
                        imageUrls = [post.media_url];
                      }
                    }

                    return (
                      <div
                        key={post.id}
                        className="weekly-carousel-slide"
                        onClick={() => setSelectedWeeklyPost(post)}
                      >
                        <div className="weekly-post-card">
                          {/* Media */}
                          {post.media_type === "image" && imageUrls.length > 0 && (
                            <div className="weekly-post-media">
                              <img
                                src={imageUrls[0]}
                                alt="Post content"
                                className="weekly-post-image"
                              />
                            </div>
                          )}
                          {post.media_type === "video" && post.media_url && (
                            <div className="weekly-post-media">
                              <video
                                src={post.media_url}
                                muted
                                loop
                                playsInline
                                preload="metadata"
                                className="weekly-post-video"
                                autoPlay={index === weeklyCarouselIndex}
                                onTimeUpdate={(e) => {
                                  // Limit video playback to 8 seconds
                                  if (e.currentTarget.currentTime >= 8) {
                                    e.currentTarget.pause();
                                  }
                                }}
                              />
                            </div>
                          )}

                          {/* Overlay with post info */}
                          <div className="weekly-post-overlay">
                            <div className="weekly-post-info">
                              <Link
                                href={`/profile/${post.user_id}`}
                                className="weekly-post-author"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {post.author_pseudo}
                              </Link>
                              {post.games && (
                                <Link
                                  href={`/games/${post.games.slug}`}
                                  className="weekly-post-game"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {post.games.name}
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                className="weekly-carousel-nav weekly-carousel-nav-right"
                onClick={() => handleWeeklyNav("next")}
                type="button"
                aria-label="Next post"
              >
                <ChevronRightIcon className="icon-24" />
              </button>

              {/* Dots indicator */}
              {weeklyPosts.length > 1 && (
                <div className="weekly-carousel-dots">
                  {weeklyPosts.map((_, idx) => (
                    <button
                      key={idx}
                      className={`weekly-carousel-dot ${idx === weeklyCarouselIndex ? "active" : ""}`}
                      onClick={() => {
                        if (weeklyAutoRotateTimer) {
                          clearInterval(weeklyAutoRotateTimer);
                          setWeeklyAutoRotateTimer(null);
                        }
                        setWeeklyCarouselIndex(idx);
                        setTimeout(() => {
                          const timer = setInterval(() => {
                            setWeeklyCarouselIndex((prev) => (prev + 1) % weeklyPosts.length);
                          }, 8000);
                          setWeeklyAutoRotateTimer(timer);
                        }, 8000);
                      }}
                      type="button"
                      aria-label={`Go to post ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Weekly Post Modal */}
        {selectedWeeklyPost && (
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
              className="modal-backdrop"
              onClick={() => setSelectedWeeklyPost(null)}
            >
              <div
                className="card profile-modal-card"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "680px",
                  maxWidth: "90vw",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  overflowX: "hidden",
                  margin: "auto",
                  position: "relative",
                  zIndex: 10000,
                  padding: "18px 22px",
                }}
              >
              <button
                onClick={() => setSelectedWeeklyPost(null)}
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
                }}
              >
                ×
              </button>

              <PostCard
                post={selectedWeeklyPost}
                comments={comments.filter((c) => c.post_id === selectedWeeklyPost.id)}
                myId={myId}
                pseudo={pseudo}
                games={games}
                hasVotedThisWeek={hasVotedThisWeek}
                onVote={handleVote}
              />
              </div>
            </div>
          </>
        )}

        {/* Formulaire post */}
        {showCreatePost && (
        <div className="card card-create">
          <h3 className="card-title">Create a post</h3>

          <select
  className="input"
  value={selectedGameId}
  onChange={(e) => setSelectedGameId(e.target.value)}
>
  <option value="">Select a game</option>
  {games.map((game) => (
    <option key={game.id} value={game.id}>
      {game.name}
    </option>
  ))}
</select>


          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="Write something..."
            rows={3}
            className="textarea"
          />

          <label className="file-label">
            <span>
              {mediaFiles.length === 0 
                ? "Add photos / video (max 7 photos)"
                : `Add more photos (${mediaFiles.length}/7 selected)`
              }
            </span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={async (e) => {
                const newFiles = Array.from(e.target.files || []);
                if (newFiles.length === 0) {
                  return;
                }

                // Calculer le total avec les fichiers existants
                const totalFiles = mediaFiles.length + newFiles.length;

                // Vérifier la limite de 7 photos au total
                if (totalFiles > 7) {
                  setMediaValidationError(`Maximum 7 photos allowed. You already have ${mediaFiles.length} photo(s).`);
                  // Reset file input
                  e.target.value = "";
                  return;
                }

                // Vérifier le type des fichiers existants
                const existingHasImage = mediaFiles.some(f => f.type.startsWith("image/"));
                const existingHasVideo = mediaFiles.some(f => f.type.startsWith("video/"));

                // Vérifier le type des nouveaux fichiers
                const newHasImage = newFiles.some(f => f.type.startsWith("image/"));
                const newHasVideo = newFiles.some(f => f.type.startsWith("video/"));

                // Si on a déjà une vidéo, on ne peut pas ajouter d'autres fichiers
                if (existingHasVideo) {
                  setMediaValidationError("Cannot add more files when a video is already selected.");
                  e.target.value = "";
                  return;
                }

                // Si on essaie d'ajouter une vidéo alors qu'on a déjà des photos
                if (existingHasImage && newHasVideo) {
                  setMediaValidationError("Cannot mix photos and videos. Use only photos or only one video.");
                  e.target.value = "";
                  return;
                }

                // Si on essaie d'ajouter des photos alors qu'on a déjà une vidéo (déjà vérifié ci-dessus, mais sécurité)
                if (existingHasVideo && newHasImage) {
                  setMediaValidationError("Cannot add photos when a video is already selected.");
                  e.target.value = "";
                  return;
                }

                // Vérifier qu'on ne mélange pas photos et vidéos dans les nouveaux fichiers
                if (newHasImage && newHasVideo) {
                  setMediaValidationError("Cannot mix photos and videos. Use only photos or only one video.");
                  e.target.value = "";
                  return;
                }

                // Si c'est une vidéo, elle doit être seule (pas de fichiers existants)
                if (newHasVideo && (mediaFiles.length > 0 || newFiles.length > 1)) {
                  setMediaValidationError("Only one video allowed per post, and it must be the only media.");
                  e.target.value = "";
                  return;
                }

                // Valider chaque fichier individuellement - garder seulement les valides
                const validFiles: File[] = [];
                const validPreviews: string[] = [];
                const validDimensions: { width: number; height: number }[] = [];
                const invalidCount: number[] = [];

                for (let i = 0; i < newFiles.length; i++) {
                  const file = newFiles[i];
                  const validation = await validateMedia(file);
                  
                  if (validation.isValid) {
                    validFiles.push(file);
                    validPreviews.push(URL.createObjectURL(file));
                    validDimensions.push({ width: validation.width, height: validation.height });
                  } else {
                    invalidCount.push(i + 1);
                  }
                }

                // Si aucun fichier n'est valide, bloquer seulement si c'est la seule source de contenu
                if (validFiles.length === 0) {
                  if (newFiles.length > 0) {
                    setMediaValidationError("All selected files are invalid. Please check the requirements.");
                    e.target.value = "";
                    return;
                  }
                }

                // Si certains fichiers sont invalides, afficher un avertissement mais continuer
                if (invalidCount.length > 0 && validFiles.length > 0) {
                  const skippedMessage = invalidCount.length === 1 
                    ? "1 file was skipped because it was invalid or failed validation."
                    : `${invalidCount.length} files were skipped because they were invalid or failed validation.`;
                  // Afficher comme notification d'avertissement (pas d'erreur bloquante)
                  showNotification(skippedMessage, "error");
                }

                // APPEND seulement les fichiers valides aux existants
                if (validFiles.length > 0) {
                  const updatedFiles = [...mediaFiles, ...validFiles];
                  const updatedPreviews = [...mediaPreviews, ...validPreviews];
                  const updatedDimensions = [...mediaDimensions, ...validDimensions];

                  setMediaFiles(updatedFiles);
                  setMediaPreviews(updatedPreviews);
                  setMediaDimensions(updatedDimensions);
                  setMediaValidationError(null);
                  
                  // Garder l'index actuel ou aller à la première nouvelle photo
                  if (mediaFiles.length === 0) {
                    setCurrentPreviewIndex(0);
                  }
                }
                
                // Reset file input
                e.target.value = "";
              }}
            />
          </label>

          {/* Aperçu et validation - Carousel pour plusieurs photos */}
          {mediaPreviews.length > 0 && mediaDimensions.length > 0 && (() => {
            // Handler pour le swipe dans le preview
            const handlePreviewTouchStart = (e: React.TouchEvent) => {
              const touch = e.touches[0];
              (e.currentTarget as any).touchStartX = touch.clientX;
            };

            const handlePreviewTouchMove = (e: React.TouchEvent) => {
              const touch = e.touches[0];
              (e.currentTarget as any).touchCurrentX = touch.clientX;
            };

            const handlePreviewTouchEnd = (e: React.TouchEvent) => {
              const startX = (e.currentTarget as any).touchStartX;
              const currentX = (e.currentTarget as any).touchCurrentX;
              const diff = startX - currentX;
              const threshold = 50;

              if (Math.abs(diff) > threshold) {
                if (diff > 0 && currentPreviewIndex < mediaPreviews.length - 1) {
                  // Swipe gauche -> photo suivante
                  setCurrentPreviewIndex(prev => Math.min(mediaPreviews.length - 1, prev + 1));
                } else if (diff < 0 && currentPreviewIndex > 0) {
                  // Swipe droite -> photo précédente
                  setCurrentPreviewIndex(prev => Math.max(0, prev - 1));
                }
              }
            };

            return (
              <div className="media-preview-container">
                <div 
                  className="media-preview-carousel"
                  onTouchStart={handlePreviewTouchStart}
                  onTouchMove={handlePreviewTouchMove}
                  onTouchEnd={handlePreviewTouchEnd}
                >
                  {/* Navigation gauche */}
                  {mediaPreviews.length > 1 && currentPreviewIndex > 0 && (
                    <button
                      type="button"
                      className="carousel-nav carousel-nav-left"
                      onClick={() => setCurrentPreviewIndex(prev => Math.max(0, prev - 1))}
                      aria-label="Previous photo"
                    >
                      ‹
                    </button>
                  )}

                  {/* Conteneur des médias */}
                  <div className="media-preview-slider" style={{ transform: `translateX(-${currentPreviewIndex * 100}%)` }}>
                  {mediaPreviews.map((preview, index) => (
                    <div key={index} className="media-preview-slide">
                      <div className="media-preview-wrapper">
                        {mediaFiles[index].type.startsWith("image/") ? (
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="media-preview-image"
                          />
                        ) : (
                          <video
                            src={preview}
                            className="media-preview-image"
                            muted
                            playsInline
                          />
                        )}
                        <div className="media-preview-overlay">
                          {/* Infos techniques - affichées seulement si showPreviewInfo[index] est true */}
                          {showPreviewInfo[index] && (
                            <div className="media-preview-info">
                              <span className="media-dimensions">
                                {mediaDimensions[index].width} × {mediaDimensions[index].height}px
                              </span>
                              <span className="media-ratio">
                                Ratio: {(mediaDimensions[index].width / mediaDimensions[index].height).toFixed(2)}
                              </span>
                            </div>
                          )}
                          
                          {/* Bouton "ⓘ" pour afficher/masquer les infos techniques */}
                          <button
                            type="button"
                            className="media-preview-info-toggle"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowPreviewInfo(prev => ({
                                ...prev,
                                [index]: !prev[index]
                              }));
                            }}
                            aria-label={showPreviewInfo[index] ? "Hide technical info" : "Show technical info"}
                          >
                            ⓘ
                          </button>

                          {/* Bouton pour supprimer cette photo individuellement */}
                          {mediaPreviews.length > 1 && (
                            <button
                              type="button"
                              className="media-preview-remove-single"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Cleanup de l'URL de cette photo
                                URL.revokeObjectURL(mediaPreviews[index]);
                                // Supprimer cette photo des arrays
                                const updatedFiles = mediaFiles.filter((_, i) => i !== index);
                                const updatedPreviews = mediaPreviews.filter((_, i) => i !== index);
                                const updatedDimensions = mediaDimensions.filter((_, i) => i !== index);
                                
                                setMediaFiles(updatedFiles);
                                setMediaPreviews(updatedPreviews);
                                setMediaDimensions(updatedDimensions);
                                
                                // Nettoyer le state d'affichage des infos pour cet index
                                const updatedShowInfo: Record<number, boolean> = {};
                                Object.entries(showPreviewInfo).forEach(([key, value]) => {
                                  const keyNum = parseInt(key);
                                  if (keyNum < index) {
                                    updatedShowInfo[keyNum] = value;
                                  } else if (keyNum > index) {
                                    updatedShowInfo[keyNum - 1] = value;
                                  }
                                });
                                setShowPreviewInfo(updatedShowInfo);
                                
                                // Ajuster l'index si nécessaire
                                if (currentPreviewIndex >= updatedPreviews.length) {
                                  setCurrentPreviewIndex(Math.max(0, updatedPreviews.length - 1));
                                }
                              }}
                              aria-label={`Remove photo ${index + 1}`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Navigation droite */}
                {mediaPreviews.length > 1 && currentPreviewIndex < mediaPreviews.length - 1 && (
                  <button
                    type="button"
                    className="carousel-nav carousel-nav-right"
                    onClick={() => setCurrentPreviewIndex(prev => Math.min(mediaPreviews.length - 1, prev + 1))}
                    aria-label="Next photo"
                  >
                    ›
                  </button>
                )}

                {/* Dots de navigation */}
                {mediaPreviews.length > 1 && (
                  <div className="carousel-dots">
                    {mediaPreviews.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        className={`carousel-dot ${index === currentPreviewIndex ? "active" : ""}`}
                        onClick={() => setCurrentPreviewIndex(index)}
                        aria-label={`Go to photo ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn danger-btn btn-small"
                onClick={() => {
                  // Cleanup all previews
                  mediaPreviews.forEach(url => URL.revokeObjectURL(url));
                  setMediaFiles([]);
                  setMediaPreviews([]);
                  setMediaValidationError(null);
                  setMediaDimensions([]);
                  setCurrentPreviewIndex(0);
                  setShowPreviewInfo({});
                  // Reset file input
                  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                  if (fileInput) fileInput.value = "";
                }}
                style={{ marginTop: "8px" }}
              >
                Remove all
              </button>
            </div>
            );
          })()}

          {/* Message d'erreur de validation - affiché uniquement en cas d'erreur */}
          {mediaValidationError && (
            <div className="media-validation-error" role="alert">
              <strong>⚠️ Attention:</strong>
              <p>This media is poorly framed and cannot be uploaded.</p>
              <div className="media-requirements">
                <ul>
                  <li>Minimum size: 720 × 720 px</li>
                  <li>Avoid ultra-vertical or ultra-wide formats</li>
                  <li>Screenshots and standard images are supported</li>
                </ul>
              </div>
            </div>
          )}

          <button className="btn primary-btn" onClick={handleCreatePost}>
            Publish
          </button>
        </div>
        )}

        {/* ✅ État de chargement explicite */}
        {postsLoading && (
          <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ color: "#ffffff", opacity: 0.7 }}>Loading posts...</p>
          </div>
        )}

        {/* ✅ État d'erreur explicite */}
        {postsError && !postsLoading && (
          <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ color: "#f87171", marginBottom: "12px" }}>{postsError}</p>
            <button
              className="btn primary-btn"
              onClick={() => {
                setPostsLoading(true);
                setPostsError(null);
                loadAllData().catch((err) => {
                  console.error("Error retrying loadAllData:", err);
                  setPostsError("Failed to load posts. Please refresh the page.");
                  setPostsLoading(false);
                });
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ✅ État vide explicite */}
        {!postsLoading && !postsError && posts.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ color: "#ffffff", opacity: 0.7 }}>No posts found.</p>
          </div>
        )}

        {/* Posts */}
        {!postsLoading && !postsError && posts.map((post) => {
          const postComments = comments.filter((c) => c.post_id === post.id);
          const isEditing = editingPostId === post.id;
          const isMenuOpen = openMenuPostId === post.id;

          return (
            <div key={post.id} className="card post-card">
              {/* Header */}
              <div className="post-header">
                <div className="post-user">
                  <Link href={`/profile/${post.user_id}`}>
                    <img
                      src={
                        post.avatar_url ||
                        "https://via.placeholder.com/40/333333/FFFFFF?text=?"
                      }
                      className="avatar"
                    />
                  </Link>

                  <div style={{ display: "flex", alignItems: "center" }}>
                    <Link
                      href={`/profile/${post.user_id}`}
                      className="post-author username-display"
                    >
                      {post.author_pseudo}
                    </Link>

                    {post.games && (
                      <Link
                        href={`/games/${post.games.slug}`}
                        className="game-link"
                        style={{ marginLeft: "10px" }}
                      >
                        {post.games.name}
                      </Link>
                    )}
                  </div>

                </div>

                {/* Menu ⋮ */}
                {post.user_id === myId && !isEditing && (
                  <div className="post-menu-wrapper">
                    <button
                      className="icon-button"
                      onClick={() =>
                        setOpenMenuPostId(isMenuOpen ? null : post.id)
                      }
                      aria-label="Options du post"
                    >
                      <EllipsisVerticalIcon className="icon-20" />
                    </button>

                    {isMenuOpen && (
                      <div ref={menuRef} className="options-menu">
                        <button
                          className="options-menu-item danger"
                          onClick={() => {
                            setOpenMenuPostId(null);
                            handleDeletePost(post.id);
                          }}
                        >
                          <TrashIcon className="icon-16" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>



              {/* Contenu / Édition */}
              {!isEditing ? (
                <p className="post-content">{post.content}</p>
              ) : (
                <div className="post-edit-block">
                  <select
  className="input"
  value={selectedGameId}
  onChange={(e) => setSelectedGameId(e.target.value)}
>
  <option value="">Select a game</option>
  {games.map((game) => (
    <option key={game.id} value={game.id}>
      {game.name}
    </option>
  ))}
</select>

                  <textarea
                    rows={3}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="textarea"
                  />
                  <div className="edit-actions">
                    <button
                      className="btn primary-btn"
                      onClick={handleSaveEditPost}
                    >
                      Save
                    </button>
                    <button
                      className="btn ghost-btn"
                      onClick={handleCancelEditPost}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Media - Support multi-photos avec carousel */}
              {post.media_type === "image" && post.media_url && (() => {
                // Parser les URLs : peut être une string simple ou un JSON array
                let imageUrls: string[] = [];
                try {
                  const parsed = JSON.parse(post.media_url);
                  if (Array.isArray(parsed)) {
                    imageUrls = parsed;
                  } else {
                    imageUrls = [post.media_url];
                  }
                } catch {
                  // Si ce n'est pas du JSON, c'est une string simple (backward compatibility)
                  imageUrls = [post.media_url];
                }

                const currentIndex = postCarouselIndices[post.id] || 0;
                const hasMultiple = imageUrls.length > 1;

                // Handler pour le swipe
                const handleTouchStart = (e: React.TouchEvent) => {
                  const touch = e.touches[0];
                  (e.currentTarget as any).touchStartX = touch.clientX;
                };

                const handleTouchMove = (e: React.TouchEvent) => {
                  const touch = e.touches[0];
                  (e.currentTarget as any).touchCurrentX = touch.clientX;
                };

                const handleTouchEnd = (e: React.TouchEvent) => {
                  const startX = (e.currentTarget as any).touchStartX;
                  const currentX = (e.currentTarget as any).touchCurrentX;
                  const diff = startX - currentX;
                  const threshold = 50;

                  if (Math.abs(diff) > threshold) {
                    if (diff > 0 && currentIndex < imageUrls.length - 1) {
                      // Swipe gauche -> photo suivante
                      setPostCarouselIndices(prev => ({ ...prev, [post.id]: currentIndex + 1 }));
                    } else if (diff < 0 && currentIndex > 0) {
                      // Swipe droite -> photo précédente
                      setPostCarouselIndices(prev => ({ ...prev, [post.id]: currentIndex - 1 }));
                    }
                  }
                };

                return (
                  <div className="post-media-wrapper">
                    <div 
                      className="post-media-carousel"
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      {/* Navigation gauche */}
                      {hasMultiple && currentIndex > 0 && (
                        <button
                          type="button"
                          className="carousel-nav carousel-nav-left"
                          onClick={() => setPostCarouselIndices(prev => ({ ...prev, [post.id]: currentIndex - 1 }))}
                          aria-label="Previous photo"
                        >
                          ‹
                        </button>
                      )}

                      {/* Slider */}
                      <div className="post-media-slider" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                        {imageUrls.map((url, index) => (
                          <div key={index} className="post-media-slide">
                            <img 
                              src={url} 
                              className="post-media post-media-image"
                              alt={`Post content ${index + 1}`}
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Navigation droite */}
                      {hasMultiple && currentIndex < imageUrls.length - 1 && (
                        <button
                          type="button"
                          className="carousel-nav carousel-nav-right"
                          onClick={() => setPostCarouselIndices(prev => ({ ...prev, [post.id]: currentIndex + 1 }))}
                          aria-label="Next photo"
                        >
                          ›
                        </button>
                      )}

                      {/* Dots de navigation */}
                      {hasMultiple && (
                        <div className="carousel-dots">
                          {imageUrls.map((_, index) => (
                            <button
                              key={index}
                              type="button"
                              className={`carousel-dot ${index === currentIndex ? "active" : ""}`}
                              onClick={() => setPostCarouselIndices(prev => ({ ...prev, [post.id]: index }))}
                              aria-label={`Go to photo ${index + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {post.media_type === "video" && post.media_url && (
                <div className="post-media-wrapper">
                  <video
                    src={post.media_url}
                    controls
                    className="post-media post-media-video"
                    preload="metadata"
                  ></video>
                </div>
              )}

              {/* Actions */}
              <div className="post-actions">
                {/* LIKE BUTTON */}
                <button
                  className={`like-button ${
                    post.isLikedByMe ? "liked" : ""
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleToggleLike(post.id);
                  }}
                  type="button"
                >
                  {post.isLikedByMe ? (
                    <HeartIconSolid className="like-icon" />
                  ) : (
                    <HeartIcon className="like-icon" />
                  )}
                  <span>{post.likes_count ?? 0}</span>
                </button>

                {/* VOTE BUTTON */}
                {myId && (
                  <button
                    className={`vote-button ${hasVotedThisWeek ? "voted" : ""}`}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (hasVotedThisWeek) return;

                      // Get current week start
                      const now = new Date();
                      const dayOfWeek = now.getDay();
                      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                      const weekStart = new Date(now);
                      weekStart.setDate(now.getDate() + diff);
                      weekStart.setHours(0, 0, 0, 0);

                      const confirmed = window.confirm(
                        "You only have one vote per week.\nAre you sure you want to use it for this post?"
                      );

                      if (!confirmed) return;

                      const weekStartStr = weekStart.toISOString().split('T')[0];

                      try {
                        // Try to insert into Supabase first
                        const { data, error } = await supabase
                          .from("weekly_post_votes")
                          .insert({
                            user_id: myId,
                            post_id: post.id,
                            week_start: weekStartStr,
                          })
                          .select()
                          .single();

                        if (error) {
                          // Check if error is due to unique constraint (already voted)
                          if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
                            setHasVotedThisWeek(true);
                            showNotification("You have already voted this week.", "error");
                            await checkVoteStatus();
                            return;
                          }

                          // Other error: fallback to localStorage
                          console.warn("Error saving vote to Supabase, using localStorage fallback:", error);
                          try {
                            const storageKey = `weekly_vote_${myId}_${weekStartStr}`;
                            localStorage.setItem(storageKey, 'true');
                            setHasVotedThisWeek(true);
                            showNotification("Vote recorded (local storage)!", "success");
                          } catch (localStorageErr) {
                            console.error("Error saving vote to localStorage:", localStorageErr);
                            showNotification("Failed to record vote. Please try again.", "error");
                            return;
                          }
                        } else {
                          // Success: vote saved to Supabase
                          setHasVotedThisWeek(true);
                          showNotification("Vote recorded!", "success");
                          
                          // Also save to localStorage as backup
                          try {
                            const storageKey = `weekly_vote_${myId}_${weekStartStr}`;
                            localStorage.setItem(storageKey, 'true');
                          } catch (localStorageErr) {
                            // Ignore localStorage errors if Supabase succeeded
                          }
                        }

                        await loadWeeklyPosts();
                        await checkVoteStatus();
                      } catch (err) {
                        // Handle unexpected exceptions
                        console.error("Exception in vote button onClick:", err);
                        showNotification("Failed to record vote. Please try again.", "error");
                      }
                    }}
                    type="button"
                    disabled={hasVotedThisWeek}
                    title={hasVotedThisWeek ? "You have already voted this week" : "Vote for Post of the Week"}
                  >
                    <ChartBarIcon className="vote-icon" />
                  </button>
                )}

                {/* COMMENT COUNT */}
                <div className="icon-text-inline">
                  <ChatBubbleLeftIcon className="icon-18 subtle" />
                  <span className="comment-count">
                    {postComments.length} comments
                  </span>
                </div>
              </div>

              {/* Comment toggle button */}
<button
  className="btn ghost-btn"
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenComments(prev => ({ ...prev, [post.id]: !prev[post.id] }));
  }}
  type="button"
  style={{ marginTop: "12px" }}
>
  {openComments[post.id] ? "Hide comments" : `Show comments (${postComments.length})`}
</button>

{/* Comment drawer */}
{openComments[post.id] && (
  <div className="comments-card glass-card">
    {buildCommentTree(postComments).map(c =>
      renderThreadedComment(c, 0, post)
    )}

    <div className="comment-input-row">
      <input
        type="text"
        placeholder="Comment..."
        value={newComments[post.id] || ""}
        onChange={(e) =>
          setNewComments((prev) => ({ ...prev, [post.id]: e.target.value }))
        }
        className="input"
      />
      <button
        className="btn ghost-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleAddComment(post.id, replyTo[post.id] ?? undefined);
        }}
        type="button"
      >
        Send
      </button>
    </div>
  </div>
)}


            </div>
          );
        })}
      </div>

      {/* STYLES */}
      <style jsx>{`
        .feed-container {
          padding: 20px 24px;
          max-width: 720px;
          margin: 0 auto;
          color: #ffffff;
        }

        .feed-title {
          margin-bottom: 20px;
          margin-top: 0;
          font-size: 1.75rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #ffffff;
          text-shadow: 0 0 20px rgba(250, 204, 21, 0.2);
        }

        .create-post-toggle-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(30, 30, 30, 0.8);
          border: 1px solid rgba(100, 100, 100, 0.3);
          border-radius: 6px;
          color: #ffffff;
          font-size: 1.25rem;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 
            0 1px 3px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          padding: 0;
          line-height: 1;
          user-select: none;
        }

        .create-post-toggle-btn:hover {
          background: rgba(40, 40, 40, 0.9);
          border-color: rgba(250, 204, 21, 0.5);
          color: #facc15;
          box-shadow: 
            0 2px 8px rgba(250, 204, 21, 0.2),
            0 0 16px rgba(250, 204, 21, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          transform: translateY(-1px);
        }

        .create-post-toggle-btn:active {
          transform: translateY(0);
          box-shadow: 
            0 1px 3px rgba(250, 204, 21, 0.3),
            inset 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .card {
          background: rgba(30, 30, 30, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 12px;
          border: 1px solid rgba(100, 100, 100, 0.2);
          padding: 18px 22px;
          margin-bottom: 20px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          isolation: isolate;
          box-shadow: 
            0 4px 6px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }

        .card:hover {
          border-color: rgba(250, 204, 21, 0.3);
          box-shadow: 
            0 8px 16px rgba(0, 0, 0, 0.5),
            0 0 24px rgba(250, 204, 21, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          transform: translateY(-2px);
        }

        .card-create {
          background: rgba(30, 30, 30, 0.9);
          margin-bottom: 20px;
        }

        .post-media-wrapper {
          width: 100%;
          margin-top: 16px;
          margin-bottom: 0;
          border-radius: 8px;
          background: rgba(20, 20, 20, 0.5);
          /* Pas de overflow ici - laisse les images s'afficher en entier */
        }

        .post-media-image {
          width: 100%;
          max-width: 100%;
          height: auto;
          max-height: 600px;
          object-fit: contain !important; /* JAMAIS de cropping */
          object-position: center !important;
          display: block;
          margin: 0 auto;
        }

        .post-media-video {
          width: 100%;
          max-width: 100%;
          height: auto;
          max-height: 600px;
          min-height: 200px;
          object-fit: contain;
          object-position: center;
          display: block;
        }

        @media (max-width: 768px) {
          .post-media-image,
          .post-media-video {
            max-height: 400px;
          }
        }

        @media (max-width: 480px) {
          .post-media-image,
          .post-media-video {
            max-height: 300px;
          }
        }

        .card-title {
          margin-bottom: 14px;
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #ffffff;
        }

        .input,
        .textarea {
          width: 100%;
          background: rgba(30, 30, 30, 0.8);
          border-radius: 8px;
          border: 1px solid rgba(100, 100, 100, 0.3);
          color: #ffffff;
          padding: 10px 14px;
          font-size: 0.9rem;
          outline: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 
            inset 0 1px 2px rgba(0, 0, 0, 0.3),
            0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .input::placeholder,
        .textarea::placeholder {
          color: rgba(180, 180, 180, 0.6);
        }

        .input:focus,
        .textarea:focus {
          border-color: rgba(250, 204, 21, 0.6);
          background: rgba(35, 35, 35, 0.9);
          box-shadow: 
            0 0 0 3px rgba(250, 204, 21, 0.15),
            inset 0 1px 2px rgba(0, 0, 0, 0.3),
            0 0 16px rgba(250, 204, 21, 0.12);
        }

        .textarea {
          resize: vertical;
        }

        .file-label {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          margin: 12px 0;
          border-radius: 8px;
          border: 1px dashed rgba(100, 100, 100, 0.4);
          background: rgba(30, 30, 30, 0.8);
          color: #ffffff;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .file-label:hover {
          border-color: rgba(250, 204, 21, 0.5);
          background: rgba(40, 40, 40, 0.9);
          color: #ffffff;
          box-shadow: 
            0 0 12px rgba(250, 204, 21, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .file-label input {
          display: none;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 6px;
          border: 1px solid;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          z-index: 10;
          pointer-events: auto;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          text-decoration: none;
          outline: none;
          user-select: none;
        }

        .primary-btn {
          background: rgba(30, 30, 30, 0.8);
          border-color: rgba(250, 204, 21, 0.4);
          color: #ffffff;
          box-shadow: 
            0 1px 3px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .primary-btn:hover {
          background: rgba(40, 40, 40, 0.9);
          border-color: rgba(250, 204, 21, 0.6);
          color: #ffffff;
          box-shadow: 
            0 2px 8px rgba(250, 204, 21, 0.2),
            0 0 16px rgba(250, 204, 21, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          transform: translateY(-1px);
        }

        .primary-btn:active {
          transform: translateY(0);
          box-shadow: 
            0 1px 3px rgba(250, 204, 21, 0.3),
            inset 0 1px 2px rgba(0, 0, 0, 0.3);
        }

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

        .ghost-btn.liked,
        .primary-btn.liked,
        .btn.liked {
          border-color: rgba(250, 204, 21, 0.7);
          color: #facc15;
          background: rgba(250, 204, 21, 0.1);
          box-shadow: 
            0 2px 8px rgba(250, 204, 21, 0.25),
            0 0 20px rgba(250, 204, 21, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
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

        .post-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 0;
        }

        .post-user {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .avatar {
          width: 46px;
          height: 46px;
          object-fit: cover;
          border-radius: 999px;
          border: 1px solid rgba(156, 163, 175, 0.2);
        }

        .post-author {
          font-size: 0.95rem;
          font-weight: 600;
          text-decoration: none;
          color: #ffffff;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .post-author:hover {
          text-decoration: none !important;
          color: #facc15;
          text-shadow: 0 0 8px rgba(250, 204, 21, 0.4);
        }

        .post-game {
          margin-top: 1px;
          font-size: 0.78rem;
          color: #9ca3af;
        }

        .post-content {
          margin-top: 14px;
          margin-bottom: 0;
          font-size: 0.95rem;
          line-height: 1.6;
          color: #ffffff;
        }

        .post-edit-block {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 12px;
        }

        .edit-actions {
          display: flex;
          gap: 8px;
          margin-top: 5px;
        }

        .post-media {
          width: 100%;
          max-width: 100%;
          height: auto;
          max-height: 600px;
          margin-top: 16px;
          border-radius: 8px;
          border: 1px solid rgba(100, 100, 100, 0.2);
          object-fit: contain;
          object-position: center;
          display: block;
          background: rgba(20, 20, 20, 0.5);
        }

        .post-media[src=""],
        .post-media:not([src]) {
          display: none;
        }

        .post-actions {
          margin-top: 16px;
          margin-bottom: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          z-index: 20;
          isolation: isolate;
        }

        .icon-button {
          background: transparent;
          border: none;
          padding: 5px;
          border-radius: 999px;
          cursor: pointer;
          transition: 0.12s ease;
        }

        .icon-button:hover {
          background: #1f2937;
        }

        .icon-button.small {
          padding: 3px;
        }

        .icon-text-inline {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.82rem;
          color: #ffffff;
        }

        .subtle {
          opacity: 0.7;
        }

        .comment-count {
          font-size: 0.8rem;
          color: #ffffff;
        }

        .comments-block {
          margin-top: 14px;
          padding-top: 10px;
          border-top: 1px solid rgba(65, 65, 100, 0.65);
        }


        .comment-text {
          font-size: 0.82rem;
          color: #d8daff;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .comment-separator {
          opacity: 0.6;
        }

        .danger-text {
          color: #ff8b8b;
        }

        .comment-input-row {
          margin-top: 10px;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .post-menu-wrapper {
          position: relative;
        }

        .options-menu {
          position: absolute;
          right: 0;
          top: 34px;
          min-width: 155px;
          background: rgba(30, 30, 30, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 8px;
          border: 1px solid rgba(100, 100, 100, 0.3);
          padding: 6px 0;
          box-shadow: 
            0 8px 16px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          animation: fadeInScale 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: top right;
          z-index: 25;
        }

        .options-menu-item {
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .options-menu-item:hover {
          background: rgba(40, 40, 40, 0.8);
          border-left: 2px solid rgba(250, 204, 21, 0.5);
        }

        .options-menu-item.danger {
          color: #f87171;
        }

        .options-menu-item.danger:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          border-left: 2px solid rgba(239, 68, 68, 0.4);
        }

        .notification {
          margin-bottom: 16px;
          padding: 10px 18px;
          border-radius: 8px;
          animation: fadeInUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid;
          font-size: 0.875rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 
            0 4px 6px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .notif-success {
          background: rgba(30, 30, 30, 0.9);
          border-color: rgba(250, 204, 21, 0.5);
          color: #facc15;
        }

        .notif-error {
          background: rgba(15, 23, 42, 0.6);
          border-color: rgba(239, 68, 68, 0.4);
          color: #f87171;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(11, 15, 20, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.12s ease-out;
        }

        .modal-card {
          background: #1b1f26;
          border-radius: 8px;
          padding: 20px;
          max-width: 360px;
          width: 90%;
          border: 1px solid rgba(156, 163, 175, 0.2);
          z-index: 10000;
          animation: scaleIn 0.12s ease-out;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .modal-card h3 {
          margin: 0 0 10px 0;
          font-size: 1.05rem;
          font-weight: 600;
          color: #e5e7eb;
        }

        .modal-text {
          font-size: 0.86rem;
          color: #9ca3af;
          margin-bottom: 16px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .like-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 6px;
          background: rgba(30, 30, 30, 0.8);
          border: 1px solid rgba(100, 100, 100, 0.3);
          color: #ffffff;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          z-index: 30;
          pointer-events: auto;
          isolation: isolate;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 
            0 1px 3px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .like-button:hover {
          background: rgba(40, 40, 40, 0.9);
          border-color: rgba(250, 204, 21, 0.5);
          color: #facc15;
          box-shadow: 
            0 2px 8px rgba(250, 204, 21, 0.2),
            0 0 16px rgba(250, 204, 21, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          transform: translateY(-1px);
        }

        .like-button:active {
          transform: translateY(0);
        }

        .like-button.liked {
          border-color: rgba(250, 204, 21, 0.7);
          color: #facc15;
          background: rgba(250, 204, 21, 0.1);
          box-shadow: 
            0 2px 8px rgba(250, 204, 21, 0.25),
            0 0 20px rgba(250, 204, 21, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
        }

        .like-icon {
          width: 18px;
          height: 18px;
          color: inherit;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .like-button:active .like-icon {
          transform: scale(1.3);
        }

        .like-button.liked .like-icon {
          color: #facc15;
        }

        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-2px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.94) translateY(4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

/* Neutralise le style global des boutons pour les commentaires */
.unstyled-btn {
  all: unset;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}


/* ======================================
   COMMENTAIRES — VERSION PROPRE VERRE
====================================== */

.comment-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  position: relative;
  isolation: isolate;
}



.depth-0 { --depth: 0; }
.depth-1 { --depth: 1; }
.depth-2 { --depth: 2; }
.depth-3 { --depth: 3; }

.glass-comment {
  padding: 12px 16px;
  background: rgba(30, 30, 30, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(100, 100, 100, 0.2);
  border-radius: 8px;
  flex: 1;
  position: relative;
  isolation: isolate;
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.comment-header-with-avatar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
}

.comment-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(156, 163, 175, 0.2);
  flex-shrink: 0;
}

.comment-header {
  margin-bottom: 6px;
}

.comment-header-content {
  flex: 1;
  min-width: 0;
}

.comment-content {
  margin-bottom: 8px;
  margin-left: 42px;
}

.comment-author {
  font-weight: 600;
  font-size: 0.95rem;
  color: #ffffff;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-block;
}

.comment-author:hover {
  color: #facc15;
  text-shadow: 0 0 6px rgba(250, 204, 21, 0.3);
}

.comment-separator {
  margin: 0 4px;
  opacity: 0.5;
  color: #ffffff;
}

.comment-text {
  font-size: 0.88rem;
  color: #ffffff;
  line-height: 1.55;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
}


/* Les boutons de commentaires utilisent maintenant les classes .btn standard */

.glass-card {
  margin-top: 12px;
  padding: 18px;
  border-radius: 10px;
  background: rgba(30, 30, 30, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(100, 100, 100, 0.2);
  position: relative;
  isolation: isolate;
  box-shadow: 
    0 4px 6px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.clickable-author {
  color: #e5e7eb;
  cursor: pointer;
  transition: color 0.12s ease;
}

.clickable-author:hover {
  color: #06b6d4;
  text-decoration: underline;
}


        /* ======================================
           MEDIA PREVIEW & VALIDATION
        ====================================== */
        .media-preview-container {
          margin-top: 12px;
          margin-bottom: 12px;
        }

        .media-preview-wrapper {
          position: relative;
          width: 100%;
          max-width: 400px;
          aspect-ratio: 1 / 1;
          border-radius: 8px;
          overflow: visible; /* Permettre aux boutons de sortir du wrapper */
          border: 2px solid rgba(250, 204, 21, 0.4);
          background: rgba(20, 20, 20, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .media-preview-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .media-preview-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          top: 0; /* Étendre l'overlay sur toute la hauteur pour permettre le positionnement absolu */
          background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
          padding: 12px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          min-height: 60px;
          pointer-events: none; /* Permettre les clics à travers l'overlay sauf sur les boutons */
        }
        
        /* Réactiver les pointer-events sur les éléments interactifs */
        .media-preview-overlay button,
        .media-preview-overlay .media-preview-info {
          pointer-events: auto;
        }

        .media-preview-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: #ffffff;
          font-size: 0.8rem;
          flex: 1;
        }

        .media-dimensions {
          font-weight: 600;
          color: #facc15;
        }

        .media-ratio {
          font-size: 0.75rem;
          opacity: 0.8;
        }

        .media-preview-info-toggle {
          position: absolute;
          bottom: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          font-size: 16px;
          font-weight: normal;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          z-index: 15;
          line-height: 1;
          padding: 0;
        }

        .media-preview-info-toggle:hover {
          background: rgba(0, 0, 0, 0.8);
          border-color: rgba(250, 204, 21, 0.5);
          color: #facc15;
          transform: scale(1.1);
        }

        .media-preview-remove-single {
          position: absolute;
          top: 8px; /* Positionné en haut à droite du preview (overlay couvre maintenant toute la hauteur) */
          right: 8px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.9);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          font-size: 20px;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          z-index: 25; /* Plus élevé que l'info button pour être au-dessus */
          line-height: 1;
        }

        .media-preview-remove-single:hover {
          background: rgba(239, 68, 68, 1);
          transform: scale(1.1);
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
        }

        .media-validation-error {
          margin-top: 12px;
          padding: 14px 16px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: 8px;
          color: #fca5a5;
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .media-validation-error strong {
          display: block;
          margin-bottom: 8px;
          color: #f87171;
          font-size: 0.9rem;
        }

        .media-validation-error p {
          margin: 0 0 12px 0;
          color: #fca5a5;
        }

        .media-requirements {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(239, 68, 68, 0.3);
        }

        .media-requirements p {
          margin: 0 0 8px 0;
          font-weight: 600;
          color: #f87171;
        }

        .media-requirements ul {
          margin: 0;
          padding-left: 20px;
          list-style-type: disc;
        }

        .media-requirements li {
          margin: 4px 0;
          color: #fca5a5;
        }

        .media-upload-info {
          margin-top: 12px;
          padding: 12px 14px;
          background: rgba(30, 30, 30, 0.6);
          border: 1px solid rgba(100, 100, 100, 0.3);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.8rem;
          line-height: 1.6;
        }

        .media-upload-info p {
          margin: 0 0 8px 0;
          font-weight: 600;
          color: #ffffff;
        }

        .media-upload-info ul {
          margin: 0;
          padding-left: 20px;
          list-style-type: disc;
        }

        .media-upload-info li {
          margin: 4px 0;
          color: rgba(255, 255, 255, 0.7);
        }

        .media-upload-info strong {
          color: #facc15;
        }

        /* ======================================
           CAROUSEL STYLES (Preview & Posts) - VERSION CORRIGÉE
        ====================================== */
        /* ======================================
           CAROUSEL - VERSION CORRIGÉE SANS CROPPING
        ====================================== */
        .media-preview-carousel,
        .post-media-carousel {
          position: relative;
          width: 100%;
          overflow: hidden; /* Nécessaire pour cacher les slides adjacentes */
          border-radius: 8px;
          background: rgba(20, 20, 20, 0.5);
          /* La hauteur s'adapte automatiquement au contenu grâce au slider */
        }

        .media-preview-slider,
        .post-media-slider {
          display: flex;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          will-change: transform;
          width: 100%;
          /* Hauteur s'adapte à la slide la plus haute visible */
          /* IMPORTANT: Les slides ont toutes la même structure, donc même hauteur max */
        }

        .media-preview-slide,
        .post-media-slide {
          min-width: 100%;
          width: 100%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(20, 20, 20, 0.5);
          padding: 0;
          margin: 0;
          /* Hauteur s'adapte au contenu de l'image */
          /* Toutes les slides ont la même hauteur max grâce à max-height sur les images */
        }

        /* Images dans le carousel - JAMAIS de cropping - FORCE contain */
        .post-media-slide .post-media-image,
        .media-preview-slide .media-preview-image {
          width: 100%;
          max-width: 100%;
          height: auto;
          max-height: 600px; /* Toutes les images respectent cette limite */
          min-height: 0;
          object-fit: contain !important; /* FORCE contain - JAMAIS de cropping */
          object-position: center !important;
          display: block;
          margin: 0 auto;
          /* Avec object-fit: contain, l'image s'adapte proportionnellement */
          /* Si l'image est plus haute que 600px, elle sera réduite mais jamais coupée */
        }

        /* Pour les vidéos dans le carousel (si nécessaire) */
        .post-media-slide .post-media-video,
        .media-preview-slide video {
          width: 100%;
          max-width: 100%;
          height: auto;
          max-height: 600px;
          min-height: 200px;
          object-fit: contain !important;
          object-position: center !important;
          display: block;
        }

        .carousel-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 10;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          font-size: 24px;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          user-select: none;
        }

        .carousel-nav:hover {
          background: rgba(0, 0, 0, 0.8);
          border-color: rgba(250, 204, 21, 0.5);
          color: #facc15;
        }

        .carousel-nav-left {
          left: 12px;
        }

        .carousel-nav-right {
          right: 12px;
        }

        .carousel-dots {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 6px;
          z-index: 10;
        }

        .carousel-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 0;
        }

        .carousel-dot:hover {
          background: rgba(255, 255, 255, 0.6);
          transform: scale(1.2);
        }

        .carousel-dot.active {
          background: #facc15;
          width: 24px;
          border-radius: 4px;
        }

        /* Touch swipe support for mobile */
        .post-media-carousel {
          touch-action: pan-y pinch-zoom;
        }

        @media (max-width: 650px) {
          .feed-container {
            padding: 18px;
          }
          .card {
            padding: 16px;
          }
          .media-preview-wrapper {
            max-width: 100%;
          }
        }


      `}</style>
    </>
  );
}
