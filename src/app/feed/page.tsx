"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
  game: string | null;
  author_pseudo: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  user_id: string;
  avatar_url?: string | null;

  // 🔥 ajout pour les likes
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

export default function FeedPage() {
  const router = useRouter();

  const [myId, setMyId] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState<string>("");

  const [posts, setPosts] = useState<Post[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);

  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<Record<string, string | null>>({});
  const [newPost, setNewPost] = useState("");

  const [newGame, setNewGame] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  // Édition de post
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [editGame, setEditGame] = useState<string>("");

  // Menu ⋮ ouvert pour quel post
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

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
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      router.push("/login");
      return;
    }

    setMyId(data.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", data.user.id)
      .single();

    setPseudo(profile?.pseudo || "Utilisateur");
  };

  loadSession();
}, [router]);

// Charger les données seulement quand myId est défini
useEffect(() => {
  if (myId) {
    loadAllData();
  }
}, [myId]);

  // -----------------------------------------------------
  // Charger posts + commentaires (+ likes)
  // -----------------------------------------------------
  const loadAllData = async () => {
    const { data: postsData, error: postsError } = await supabase
  .from("posts")
  .select("*, likes(count)")
  .order("created_at", { ascending: false });

console.log("POSTS ERROR RAW:", postsError, postsData); // 👈 AJOUT

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
  .select("id, post_id, user_id, author_pseudo, content, created_at, parent_id")
  .order("created_at", { ascending: true });

console.log("COMMENTS ERROR RAW:", commentsError, commentsData); // 👈 AJOUT

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
    if (!myId || !newPost.trim()) return;

    const { url, type } = await uploadMedia();

    const { error } = await supabase.from("posts").insert({
      user_id: myId,
      content: newPost,
      game: newGame || null,
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
    setNewGame("");
    setMediaFile(null);

    showNotification("Post published!");
    loadAllData();
  };

  // -----------------------------------------------------
  // Add a comment + Notification
  // -----------------------------------------------------
  const handleAddComment = async (postId: string, parentId?: string) => {

    if (!myId) return;

    const content = newComments[postId];
    if (!content) return;

    const { error } = await supabase.from("comments").insert({
      post_id: postId,
parent_id: parentId ?? null,
content,
author_pseudo: pseudo,
user_id: myId,

    });

    if (error) {
      console.error(error);
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
    loadAllData();
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
    setEditGame(post.game || "");
    setOpenMenuPostId(null);
  };

  const handleCancelEditPost = () => {
    setEditingPostId(null);
    setEditContent("");
    setEditGame("");
  };

  const handleSaveEditPost = async () => {
    if (!editingPostId || !myId || !editContent.trim()) return;

    const { error } = await supabase
      .from("posts")
      .update({
        content: editContent,
        game: editGame || null,
      })
      .eq("id", editingPostId)
      .eq("user_id", myId);

    if (error) {
      console.error("Error editing post:", error);
      showNotification("Error editing post", "error");
      return;
    }

    setPosts((prev) =>
      prev.map((p) =>
        p.id === editingPostId
          ? { ...p, content: editContent, game: editGame || null }
          : p
      )
    );

    setEditingPostId(null);
    setEditContent("");
    setEditGame("");
    showNotification("Post updated");
  };

  // -----------------------------------------------------
  // LIKE / UNLIKE post
  // -----------------------------------------------------
  const handleToggleLike = async (postId: string) => {
    if (!myId) return;

    const targetPost = posts.find((p) => p.id === postId);
    const currentlyLiked = !!targetPost?.isLikedByMe;

    if (currentlyLiked) {
      // UNLIKE : on supprime uniquement le like de ce user
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", myId);

      if (error) {
        console.error("Error unliking:", error);
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
        // si jamais unique_violation (déjà liké), on ignore
        console.error("Error liking:", error);
        showNotification("Error while liking", "error");
        return;
      }
    }

    // Mise à jour optimiste locale
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
      style={{ paddingLeft: depth * 10 }}
    >
      <div className="comment-body glass-comment">
        <div className="comment-line">
          <Link
            href={`/profile/${comment.user_id}`}
            className="comment-author clickable-author"
          >
            {comment.author_pseudo}
          </Link>

          <span className="comment-separator">:</span>


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
            className="comment-action"
            onClick={() => handleToggleCommentLike(comment.id)}
          >
            ❤️ {comment.likes_count ?? 0}
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

        {/* Formulaire post */}
        <div className="card card-create">
          <h3 className="card-title">Create a post</h3>

          <input
            type="text"
            placeholder="Game (optional)"
            value={newGame}
            onChange={(e) => setNewGame(e.target.value)}
            className="input"
          />

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

                  <div>
                    <Link
                      href={`/profile/${post.user_id}`}
                      className="post-author username-display"
                    >
                      {post.author_pseudo}
                    </Link>
                    {post.game && (
                      <div className="post-game">{post.game}</div>
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
                  <input
                    type="text"
                    placeholder="Game (optional)"
                    value={editGame}
                    onChange={(e) => setEditGame(e.target.value)}
                    className="input"
                  />
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
                  onClick={() => handleToggleLike(post.id)}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={post.isLikedByMe ? "#ff6b81" : "none"}
                    stroke="#ffffff"
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
  onClick={() =>
    setOpenComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))
  }
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
        onClick={() =>
          handleAddComment(post.id, replyTo[post.id] ?? undefined)
        }
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
          color: #f4f5ff;
        }

        .feed-title {
          margin-bottom: 24px;
          font-size: 1.6rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-shadow: 0 0 4px rgba(140, 160, 255, 0.2);
        }

        .card {
          background: rgba(10, 10, 18, 0.65);
          border-radius: 18px;
          border: 1px solid rgba(95, 115, 200, 0.18);
          padding: 18px 22px;
          margin-bottom: 26px;
          backdrop-filter: blur(16px);
          box-shadow: 0 0 18px rgba(40, 80, 255, 0.12);
          transition: 0.22s ease;
        }

        .card:hover {
          border-color: rgba(130, 150, 255, 0.26);
          box-shadow: 0 0 26px rgba(90, 120, 255, 0.18);
          transform: translateY(-2px);
        }

        .card-create {
          background:
            radial-gradient(
              circle at top left,
              rgba(120, 140, 255, 0.22),
              transparent 55%
            ),
            rgba(10, 10, 18, 0.75);
        }

        .card-title {
          margin-bottom: 14px;
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: 0.03em;
        }

        .input,
        .textarea {
          width: 100%;
          background: rgba(18, 20, 32, 0.92);
          border-radius: 12px;
          border: 1px solid rgba(80, 90, 130, 0.7);
          color: #f4f6ff;
          padding: 10px 13px;
          font-size: 0.92rem;
          outline: none;
          transition: 0.18s ease;
        }

        .input::placeholder,
        .textarea::placeholder {
          color: #7a7f90;
        }

        .input:focus,
        .textarea:focus {
          border-color: rgba(150, 170, 255, 0.95);
          background: rgba(20, 22, 36, 0.94);
          box-shadow: 0 0 0 1px rgba(150, 170, 255, 0.3);
          transform: translateY(-1px);
        }

        .textarea {
          resize: vertical;
        }

        .file-label {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          margin: 12px 0;
          border-radius: 12px;
          border: 1px dashed rgba(110, 120, 170, 0.7);
          background: rgba(18, 20, 34, 0.95);
          color: #d6d9ff;
          font-size: 0.85rem;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .file-label:hover {
          border-color: rgba(160, 180, 255, 0.95);
          background: rgba(24, 26, 46, 0.98);
          transform: translateY(-1px);
        }

        .file-label input {
          display: none;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 20px;
          border-radius: 999px;
          border: 1px solid transparent;
          font-size: 0.88rem;
          cursor: pointer;
          transition: 0.16s ease;
        }

        .primary-btn {
          background: linear-gradient(
            135deg,
            rgba(130, 150, 255, 0.97),
            rgba(100, 170, 255, 0.97)
          );
          color: #050513;
          font-weight: 600;
          box-shadow: 0 10px 24px rgba(80, 120, 255, 0.45);
        }

        .primary-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 28px rgba(80, 120, 255, 0.55);
        }

        .ghost-btn {
          background: rgba(15, 16, 26, 0.92);
          border-color: rgba(90, 100, 140, 0.85);
          color: #e0e2ff;
        }

        .ghost-btn:hover {
          background: rgba(26, 28, 46, 0.96);
          border-color: rgba(150, 160, 255, 0.95);
        }

        .danger-btn {
          background: rgba(50, 14, 22, 0.98);
          border-color: rgba(220, 80, 110, 0.8);
          color: #ffdbe6;
        }

        .danger-btn:hover {
          background: rgba(70, 18, 30, 0.98);
          border-color: rgba(250, 110, 140, 0.95);
          box-shadow: 0 10px 22px rgba(255, 80, 110, 0.55);
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
          border: 1px solid rgba(130, 140, 200, 0.85);
          box-shadow: 0 0 8px rgba(45, 70, 130, 0.4);
        }

        .post-author {
          font-size: 0.95rem;
          font-weight: 600;
          text-decoration: none;
          color: #eff1ff;
        }

        .post-author:hover {
          text-decoration: none !important;
        }

        .post-game {
          margin-top: 1px;
          font-size: 0.78rem;
          opacity: 0.75;
          color: #b8baf2;
        }

        .post-content {
          margin-top: 12px;
          font-size: 0.95rem;
          line-height: 1.55;
          color: #e7e8ff;
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
          border-radius: 14px;
          border: 1px solid rgba(100, 110, 170, 0.75);
          box-shadow: 0 12px 26px rgba(0, 0, 0, 0.55);
        }

        .post-actions {
          margin-top: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
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
          background: rgba(40, 40, 70, 0.6);
          transform: translateY(-1px);
        }

        .icon-button.small {
          padding: 3px;
        }

        .icon-text-inline {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.82rem;
          color: #a8a9cc;
        }

        .subtle {
          opacity: 0.75;
        }

        .comment-count {
          font-size: 0.8rem;
          color: #b9bdf4;
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
          background: rgba(14, 14, 26, 0.96);
          border-radius: 14px;
          border: 1px solid rgba(90, 100, 150, 0.9);
          padding: 6px 0;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.7);
          animation: fadeInScale 0.15s ease-out;
          transform-origin: top right;
          backdrop-filter: blur(16px);
          z-index: 25;
        }

        .options-menu-item {
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          color: #e8e8ff;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .options-menu-item:hover {
          background: rgba(44, 44, 70, 0.88);
        }

        .options-menu-item.danger {
          color: #ffb4b4;
        }

        .options-menu-item.danger:hover {
          background: rgba(80, 24, 36, 0.92);
          color: #ffe5ed;
        }

        .notification {
          margin-bottom: 16px;
          padding: 9px 16px;
          border-radius: 999px;
          animation: fadeInUp 0.2s ease-out;
          border: 1px solid transparent;
          font-size: 0.85rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .notif-success {
          background: rgba(16, 48, 32, 0.96);
          border-color: rgba(50, 160, 110, 0.9);
          color: #d6ffe9;
        }

        .notif-error {
          background: rgba(55, 20, 28, 0.96);
          border-color: rgba(210, 80, 120, 0.9);
          color: #ffe2eb;
        }

        .modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);

  /* 🔥 Toujours au-dessus de tout */
  z-index: 9999;

  animation: fadeIn 0.18s ease-out;
}

.modal-card {
  background: rgba(10, 10, 18, 0.98);
  border-radius: 18px;
  padding: 20px;
  max-width: 360px;
  width: 90%;
  border: 1px solid rgba(80, 80, 130, 0.8);

  /* 🔥 Force la carte au-dessus du backdrop */
  z-index: 10000;

  animation: scaleIn 0.18s ease-out;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7);
}


        .modal-card {
          background: rgba(10, 10, 18, 0.98);
          border-radius: 18px;
          padding: 20px;
          max-width: 360px;
          width: 90%;
          border: 1px solid rgba(80, 80, 130, 0.8);
          animation: scaleIn 0.18s ease-out;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7);
        }

        .modal-card h3 {
          margin: 0 0 10px 0;
          font-size: 1.05rem;
          font-weight: 600;
        }

        .modal-text {
          font-size: 0.86rem;
          color: #c6c6dd;
          margin-bottom: 16px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        /* 🔥 Styles pour le bouton Like */
        .like-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 999px;
          background: rgba(20, 22, 34, 0.92);
          border: 1px solid rgba(95, 115, 180, 0.65);
          color: #ffffff;
          font-size: 0.85rem;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .like-button:hover {
          background: rgba(30, 32, 48, 0.96);
          border-color: rgba(120, 140, 255, 0.95);
          box-shadow: 0 0 14px rgba(130, 150, 255, 0.28);
          transform: translateY(-1px);
        }

        .like-button.liked {
          border-color: rgba(255, 120, 150, 0.95);
          box-shadow: 0 0 16px rgba(255, 120, 150, 0.45);
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
  gap: 10px;
  margin-bottom: 20px;
  padding-left: calc(26px * var(--depth));
}


.depth-0 { --depth: 0; }
.depth-1 { --depth: 1; }
.depth-2 { --depth: 2; }
.depth-3 { --depth: 3; }

/* Bulle de commentaire façon Instagram / verre */
.glass-comment {
  padding: 10px 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  backdrop-filter: blur(14px);
  flex: 1;
}

/* Ligne auteur + texte */
.comment-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.85rem;
}

.comment-author {
  font-weight: 600;
  opacity: 0.75;
color: #c7cae0;   /* gris bleuté, plus sobre */
transition: 0.2s ease;
}

.comment-author:hover {
  opacity: 1;
  color: #e5e7ff;
}

.comment-separator {
  margin: 0 100px;
  opacity: 0.55;
}



.comment-text {
  font-size: 0.88rem;
  color: #f1f2ff;
  line-height: 1.45;
  opacity: 0.9;
}


/* Actions */

.comment-actions {
  margin-top: 6px;
  display: flex;
  gap: 10px;
}

.comment-action {
  font-weight: 500;
  color: #ebecff;
}


.comment-action {
  all: unset;
  cursor: pointer;
  font-size: 0.76rem;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  backdrop-filter: blur(6px);
  transition: 0.2s ease;
}

.comment-action:hover {
  background: rgba(255,255,255,0.15);
}

.comment-action.danger {
  color: #ff9b9b;
}

.comment-toggle-btn {
  all: unset;
  cursor: pointer;
  font-size: 0.86rem;
  color: #cfd3ff;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  backdrop-filter: blur(8px);
  margin-top: 10px;
  transition: 0.2s;
}

.comment-toggle-btn:hover {
  background: rgba(255,255,255,0.12);
}

.glass-card {
  margin-top: 12px;
  padding: 16px;
  border-radius: 14px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  backdrop-filter: blur(20px);
}


.comment-toggle-btn {
  all: unset;
  cursor: pointer;
  font-size: 0.86rem;
  color: #cfd3ff;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  backdrop-filter: blur(8px);
  margin-top: 10px;
  transition: 0.2s;
}

.comment-toggle-btn:hover {
  background: rgba(255,255,255,0.12);
}

.glass-card {
  margin-top: 12px;
  padding: 16px;
  border-radius: 14px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  backdrop-filter: blur(20px);
}


.clickable-author {
  color: #91a5ff;
  cursor: pointer;
}

.clickable-author:hover {
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
