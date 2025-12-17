"use client";

import { useEffect, useState, useRef } from "react";
import PostCard from "@/components/PostCard";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// HeroIcons (outline)
import {
  EllipsisVerticalIcon,
  PencilSquareIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
} from "@heroicons/react/24/outline";

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

  const [posts, setPosts] = useState<Post[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);

  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<Record<string, string | null>>({});
  const [newPost, setNewPost] = useState("");
  const [games, setGames] = useState<
  { id: string; name: string; slug: string }[]
>([]);

const [selectedGameId, setSelectedGameId] = useState<string>("");
const [mediaFile, setMediaFile] = useState<File | null>(null);
const [filterGameId, setFilterGameId] = useState<string>(
  forcedGameId ?? "all"
);



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


  // Notifications
  const [notification, setNotification] = useState<Notification | null>(null);

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
// Vérifier session
// -----------------------------------------------------
useEffect(() => {
  const loadSession = async () => {
  try {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      router.push("/login");
      return;
    }

    if (!isMountedRef.current) return;
    setMyId(data.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", data.user.id)
      .single();

    if (!isMountedRef.current) return;
    setPseudo(profile?.pseudo || "Utilisateur");
  } catch (err: any) {
    // navigation / hot reload / fetch interrompu
    if (
      err?.name === "AbortError" ||
      String(err?.message || err).includes("Failed to fetch")
    ) {
      return;
    }
    console.error(err);
  }
};


  loadSession();
}, [router]);

// Charger les données (même si myId n'est pas encore prêt)
// myId sert juste à marquer isLikedByMe, mais les posts doivent apparaître quoi qu'il arrive.
useEffect(() => {
  loadAllData();
}, [myId, filterGameId, pathname]);



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
      const { data: gamesData, error: gamesError } = await supabase
    .from("games")
    .select("id, name, slug")
    .order("name");

  if (gamesError) {
    console.error(gamesError);
  } else {
    setGames(gamesData || []);
  }

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


if (postsError) {
  console.error(postsError);
  showNotification("Error loading posts", "error");
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

    const postsFormatted: Post[] =
      postsData?.map((p: any) => {
        const likesArray = p.likes || [];
        const likesCount =
          Array.isArray(likesArray) && likesArray[0]?.count
            ? likesArray[0].count
            : 0;

        return {
          ...p,
          avatar_url: avatarMap[p.user_id] || null,
          likes_count: likesCount,
          isLikedByMe: !!myLikesMap[p.id],
        };
      }) || [];

    setPosts(postsFormatted);

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


if (commentsError) {
  console.error(commentsError);
  showNotification("Error loading comments", "error");
  return;
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

    const commentsWithFlags = baseComments.map((c) => ({
  ...c,
  isLikedByMe: !!myCommentLikesMap[c.id],
  avatar_url: avatarMap[c.user_id ?? ""] || null,   // ✅ AJOUT
}));


    setComments(commentsWithFlags);
  };


  // -----------------------------------------------------
  // Upload media
  // -----------------------------------------------------
  const uploadMedia = async (): Promise<{
    url: string | null;
    type: string | null;
  }> => {
    if (!mediaFile) return { url: null, type: null };

    const ext = mediaFile.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("posts-media")
      .upload(path, mediaFile);

    if (error) {
      console.error(error);
      showNotification("Erreur lors de l'upload du fichier", "error");
      return { url: null, type: null };
    }

    const url = supabase.storage
      .from("posts-media")
      .getPublicUrl(path).data.publicUrl;

    const type = mediaFile.type.startsWith("image/")
      ? "image"
      : mediaFile.type.startsWith("video/")
      ? "video"
      : null;

    return { url, type };
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
  // Create a post
  // -----------------------------------------------------
  const handleCreatePost = async () => {
  if (!myId || !newPost.trim() || !selectedGameId) return;

    const { url, type } = await uploadMedia();

    const { error } = await supabase.from("posts").insert({
  user_id: myId,
  content: newPost,
  game_id: selectedGameId,
  author_pseudo: pseudo,
  media_url: url,
  media_type: type,
});


    if (error) {
      console.error(error);
      showNotification("Error creating post", "error");
      return;
    }

    setNewPost("");
    setSelectedGameId("");
    setMediaFile(null);

    showNotification("Post published!");
    loadAllData();
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
  setMediaFile(null);
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
      style={{ paddingLeft: depth * 15 }}
    >
      <div className="comment-body glass-comment">
        <div className="comment-header">
          <Link
            href={`/profile/${comment.user_id}`}
            className="comment-author clickable-author"
          >
            {comment.author_pseudo}
          </Link>
        </div>
        
        <div className="comment-content">
          <span className="comment-text">{comment.content}</span>
        </div>

        <div className="comment-actions">
          <button
            className="comment-action"
            onClick={() => {
              setNewComments(prev => ({
                ...prev,
                [post.id]: `@${comment.author_pseudo} `
              }));
              setReplyTo(prev => ({ ...prev, [post.id]: comment.id }));
            }}
          >
            Reply
          </button>

          {canDelete && (
            <button
              className="comment-action danger"
              onClick={() => handleDeleteComment(comment.id)}
            >
              Delete
            </button>
          )}

          <button
            className={`comment-action ${comment.isLikedByMe ? "liked" : ""}`}
            onClick={() => handleToggleCommentLike(comment.id)}
          >
            Like {comment.likes_count ?? 0}
          </button>
        </div>

        {comment.replies.map(child =>
          renderThreadedComment(child, depth + 1, post)
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

        <h1 className="feed-title">News Feed</h1>

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

        {/* Formulaire post */}
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
            <span>Add an image / video</span>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
            />
          </label>

          <button className="btn primary-btn" onClick={handleCreatePost}>
            Publish
          </button>
        </div>

        {/* Posts */}
        {posts.map((post) => {
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

              {/* Media */}
              {post.media_type === "image" && post.media_url && (
                <img src={post.media_url} className="post-media" />
              )}

              {post.media_type === "video" && post.media_url && (
                <video
                  src={post.media_url}
                  controls
                  className="post-media"
                ></video>
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
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={post.isLikedByMe ? "#06b6d4" : "none"}
                    stroke={post.isLikedByMe ? "#06b6d4" : "#e5e7eb"}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 9V5a3 3 0 0 0-6 0v4" />
                    <path d="M5 15V11a2 2 0 0 1 2-2h11l-1 8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2" />
                  </svg>
                  <span>{post.likes_count ?? 0}</span>
                </button>

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
  className="comment-toggle-btn"
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenComments(prev => ({ ...prev, [post.id]: !prev[post.id] }));
  }}
  type="button"
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
          padding: 26px;
          max-width: 720px;
          margin: 0 auto;
          color: #e2e8f0;
        }

        .feed-title {
          margin-bottom: 28px;
          font-size: 1.75rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #f1f5f9;
          text-shadow: 0 0 20px rgba(6, 230, 230, 0.15);
        }

        .card {
          background: rgba(15, 23, 42, 0.35);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 12px;
          border: 1px solid rgba(100, 116, 139, 0.15);
          padding: 20px 24px;
          margin-bottom: 24px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          isolation: isolate;
          box-shadow: 
            0 4px 6px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .card:hover {
          border-color: rgba(6, 230, 230, 0.25);
          box-shadow: 
            0 8px 16px rgba(0, 0, 0, 0.3),
            0 0 24px rgba(6, 230, 230, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          transform: translateY(-2px);
        }

        .card-create {
          background: rgba(15, 23, 42, 0.4);
        }

        .card-title {
          margin-bottom: 14px;
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #e5e7eb;
        }

        .input,
        .textarea {
          width: 100%;
          background: rgba(15, 23, 42, 0.5);
          border-radius: 8px;
          border: 1px solid rgba(100, 116, 139, 0.25);
          color: #e2e8f0;
          padding: 10px 14px;
          font-size: 0.9rem;
          outline: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 
            inset 0 1px 2px rgba(0, 0, 0, 0.2),
            0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .input::placeholder,
        .textarea::placeholder {
          color: rgba(148, 163, 184, 0.6);
        }

        .input:focus,
        .textarea:focus {
          border-color: rgba(6, 230, 230, 0.5);
          background: rgba(15, 23, 42, 0.7);
          box-shadow: 
            0 0 0 3px rgba(6, 230, 230, 0.1),
            inset 0 1px 2px rgba(0, 0, 0, 0.2),
            0 0 12px rgba(6, 230, 230, 0.08);
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
          border: 1px dashed rgba(100, 116, 139, 0.3);
          background: rgba(15, 23, 42, 0.4);
          color: #94a3b8;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .file-label:hover {
          border-color: rgba(6, 230, 230, 0.5);
          background: rgba(15, 23, 42, 0.6);
          color: #e2e8f0;
          box-shadow: 
            0 0 12px rgba(6, 230, 230, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
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
          background: rgba(15, 23, 42, 0.4);
          border-color: rgba(6, 230, 230, 0.3);
          color: #e2e8f0;
          box-shadow: 
            0 1px 2px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .primary-btn:hover {
          background: rgba(15, 23, 42, 0.6);
          border-color: rgba(6, 230, 230, 0.5);
          color: #ffffff;
          box-shadow: 
            0 2px 8px rgba(6, 230, 230, 0.15),
            0 0 12px rgba(6, 230, 230, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .primary-btn:active {
          transform: translateY(0);
          box-shadow: 
            0 1px 3px rgba(6, 230, 230, 0.2),
            inset 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .ghost-btn {
          background: rgba(15, 23, 42, 0.4);
          border-color: rgba(100, 116, 139, 0.2);
          color: #94a3b8;
          box-shadow: 
            0 1px 2px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .ghost-btn:hover {
          background: rgba(15, 23, 42, 0.6);
          border-color: rgba(6, 230, 230, 0.4);
          color: #e2e8f0;
          box-shadow: 
            0 2px 8px rgba(6, 230, 230, 0.15),
            0 0 12px rgba(6, 230, 230, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .ghost-btn:active {
          transform: translateY(0);
        }

        .danger-btn {
          background: rgba(15, 23, 42, 0.4);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
          box-shadow: 
            0 1px 2px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .danger-btn:hover {
          background: rgba(15, 23, 42, 0.6);
          border-color: rgba(239, 68, 68, 0.5);
          color: #fca5a5;
          box-shadow: 
            0 2px 8px rgba(239, 68, 68, 0.15),
            0 0 12px rgba(239, 68, 68, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .post-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
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
          color: #e2e8f0;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .post-author:hover {
          text-decoration: none !important;
          color: #06e6e6;
          text-shadow: 0 0 8px rgba(6, 230, 230, 0.3);
        }

        .post-game {
          margin-top: 1px;
          font-size: 0.78rem;
          color: #9ca3af;
        }

        .post-content {
          margin-top: 12px;
          font-size: 0.95rem;
          line-height: 1.6;
          color: #e2e8f0;
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
          margin-top: 12px;
          border-radius: 8px;
          border: 1px solid rgba(156, 163, 175, 0.1);
        }

        .post-actions {
          margin-top: 14px;
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
          color: #9ca3af;
        }

        .subtle {
          opacity: 0.7;
        }

        .comment-count {
          font-size: 0.8rem;
          color: #9ca3af;
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
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 8px;
          border: 1px solid rgba(100, 116, 139, 0.2);
          padding: 6px 0;
          box-shadow: 
            0 8px 16px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          animation: fadeInScale 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: top right;
          z-index: 25;
        }

        .options-menu-item {
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          color: #e5e7eb;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .options-menu-item:hover {
          background: rgba(15, 23, 42, 0.6);
          border-left: 2px solid rgba(6, 230, 230, 0.4);
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
          background: rgba(15, 23, 42, 0.6);
          border-color: rgba(6, 230, 230, 0.4);
          color: #06e6e6;
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
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(6, 230, 230, 0.3);
          color: #e2e8f0;
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
            0 1px 2px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .like-button:hover {
          background: rgba(15, 23, 42, 0.6);
          border-color: rgba(6, 230, 230, 0.5);
          color: #06e6e6;
          box-shadow: 
            0 2px 8px rgba(6, 230, 230, 0.15),
            0 0 12px rgba(6, 230, 230, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .like-button:active {
          transform: translateY(0);
        }

        .like-button.liked {
          border-color: rgba(6, 230, 230, 0.6);
          color: #06e6e6;
          background: rgba(6, 230, 230, 0.08);
          box-shadow: 
            0 2px 8px rgba(6, 230, 230, 0.2),
            0 0 16px rgba(6, 230, 230, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
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
  padding-left: calc(24px * var(--depth));
  position: relative;
  isolation: isolate;
}


.depth-0 { --depth: 0; }
.depth-1 { --depth: 1; }
.depth-2 { --depth: 2; }
.depth-3 { --depth: 3; }

.glass-comment {
  padding: 12px 16px;
  background: rgba(15, 23, 42, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(100, 116, 139, 0.15);
  border-radius: 8px;
  flex: 1;
  position: relative;
  isolation: isolate;
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.comment-header {
  margin-bottom: 6px;
}

.comment-content {
  margin-bottom: 8px;
}

        .comment-author {
          font-weight: 600;
          font-size: 0.9rem;
          color: #e2e8f0;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .comment-author:hover {
          color: #06e6e6;
          text-shadow: 0 0 6px rgba(6, 230, 230, 0.25);
        }

.comment-separator {
  margin: 0 4px;
  opacity: 0.5;
  color: #9ca3af;
}

        .comment-text {
          font-size: 0.88rem;
          color: #e2e8f0;
          line-height: 1.55;
          word-wrap: break-word;
        }

.comment-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  position: relative;
  z-index: 30;
  isolation: isolate;
}

.comment-action {
  all: unset;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(6, 230, 230, 0.3);
  color: #94a3b8;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 30;
  pointer-events: auto;
  display: inline-block;
  isolation: isolate;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.comment-action:hover {
  background: rgba(15, 23, 42, 0.6);
  border-color: rgba(6, 230, 230, 0.5);
  color: #06e6e6;
  box-shadow: 
    0 2px 8px rgba(6, 230, 230, 0.15),
    0 0 12px rgba(6, 230, 230, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.comment-action:active {
  transform: translateY(0);
}

.comment-action.danger {
  border-color: rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.comment-action.danger:hover {
  border-color: rgba(239, 68, 68, 0.5);
  color: #fca5a5;
  box-shadow: 
    0 2px 8px rgba(239, 68, 68, 0.15),
    0 0 12px rgba(239, 68, 68, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.comment-action.liked {
  border-color: rgba(6, 230, 230, 0.6);
  color: #06e6e6;
  background: rgba(6, 230, 230, 0.08);
  box-shadow: 
    0 2px 8px rgba(6, 230, 230, 0.2),
    0 0 16px rgba(6, 230, 230, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.comment-toggle-btn {
  all: unset;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: #94a3b8;
  padding: 8px 16px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(6, 230, 230, 0.3);
  margin-top: 12px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 30;
  pointer-events: auto;
  display: inline-block;
  isolation: isolate;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.comment-toggle-btn:hover {
  background: rgba(15, 23, 42, 0.6);
  border-color: rgba(6, 230, 230, 0.5);
  color: #06e6e6;
  box-shadow: 
    0 2px 8px rgba(6, 230, 230, 0.15),
    0 0 12px rgba(6, 230, 230, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.comment-toggle-btn:active {
  transform: translateY(0);
}

.glass-card {
  margin-top: 12px;
  padding: 18px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(100, 116, 139, 0.15);
  position: relative;
  isolation: isolate;
  box-shadow: 
    0 4px 6px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
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


        @media (max-width: 650px) {
          .feed-container {
            padding: 18px;
          }
          .card {
            padding: 16px;
          }
        }


      `}</style>
    </>
  );
}
