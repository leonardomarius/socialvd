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
  HandThumbUpIcon,
  ChatBubbleLeftIcon,
} from "@heroicons/react/24/outline";

type Post = {
  id: string;
  content: string;
  game: string | null;
  author_pseudo: string | null;
  likes: number;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  user_id: string;
  avatar_url?: string | null;
};

type Comment = {
  id: string;
  post_id: string;
  author_pseudo: string;
  content: string;
  created_at: string;
  user_id?: string | null;
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
  const [newPost, setNewPost] = useState("");
  const [newGame, setNewGame] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  // Édition de post
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [editGame, setEditGame] = useState<string>("");

  // Menu ⋮ ouvert pour quel post
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

  // Modal de confirmation de suppression de post
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Notifications
  const [notification, setNotification] = useState<Notification | null>(null);

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
      loadAllData();
    };

    loadSession();
  }, []);

  // -----------------------------------------------------
  // Charger posts + commentaires
  // -----------------------------------------------------
  const loadAllData = async () => {
    const { data: postsData } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, avatar_url");

    const avatarMap: Record<string, string | null> = {};
    profiles?.forEach((p) => {
      avatarMap[p.id] = p.avatar_url;
    });

    const postsFormatted =
      postsData?.map((p: any) => ({
        ...p,
        avatar_url: avatarMap[p.user_id] || null,
      })) || [];

    setPosts(postsFormatted);

    const { data: commentsData } = await supabase
      .from("comments")
      .select("*")
      .order("created_at", { ascending: true });

    setComments(commentsData || []);
  };

  // -----------------------------------------------------
  // Upload media
  // -----------------------------------------------------
  const uploadMedia = async (): Promise<{ url: string | null; type: string | null }> => {
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
const handleAddComment = async (postId: string) => {
  const content = newComments[postId];
  if (!content) return;

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    content,
    author_pseudo: pseudo,
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
  showNotification("Comment added");
  loadAllData();
};


// -----------------------------------------------------
// Like via RPC + Notification
// -----------------------------------------------------
const handleLike = async (postId: string) => {
  const { error } = await supabase.rpc("toggle_like", { p_post_id: postId });

  if (error) {
    console.error(error);
    showNotification("Error while liking", "error");
    return;
  }

  // 🔍 Find liked post
  const post = posts.find((p) => p.id === postId);

  // 🛑 Do not notify yourself
  if (post && post.user_id !== myId) {
    await supabase.from("notifications").insert({
      user_id: post.user_id,     // recipient
      from_user_id: myId,        // you
      type: "like",
      post_id: postId,
      message: `${pseudo} liked your post`,
    });
  }

  loadAllData();
};


// -----------------------------------------------------
// Delete comment
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
// Ask delete confirmation for post
// -----------------------------------------------------
const requestDeletePost = (postId: string) => {
  setConfirmDeletePostId(postId);
  setOpenMenuPostId(null);
};


// -----------------------------------------------------
// Confirm delete post
// -----------------------------------------------------
const handleConfirmDeletePost = async () => {
  if (!confirmDeletePostId || !myId) return;

  const post = posts.find((p) => p.id === confirmDeletePostId);
  const mediaUrl = post?.media_url || null;

  if (mediaUrl) {
    await deleteMediaFile(mediaUrl);
  }

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", confirmDeletePostId)
    .eq("user_id", myId);

  if (error) {
    console.error("Error deleting post:", error);
    showNotification("Error deleting post", "error");
    return;
  }

  setPosts((prev) => prev.filter((p) => p.id !== confirmDeletePostId));
  setConfirmDeletePostId(null);
  showNotification("Post deleted");
};

const handleCancelDeletePost = () => {
  setConfirmDeletePostId(null);
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
                      className="post-author"
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
                          className="options-menu-item"
                          onClick={() => handleStartEditPost(post)}
                        >
                          <PencilSquareIcon className="icon-16" />
                          <span>Edit</span>
                        </button>
                        <button
                          className="options-menu-item danger"
                          onClick={() => requestDeletePost(post.id)}
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
                <button
                  className="icon-text-button"
                  onClick={() => handleLike(post.id)}
                >
                  <HandThumbUpIcon className="icon-18" />
                  <span>{post.likes}</span>
                </button>

                <div className="icon-text-inline">
                  <ChatBubbleLeftIcon className="icon-18 subtle" />
                  <span className="comment-count">
                    {postComments.length} comments
                  </span>
                </div>
              </div>

              {/* Commentaires */}
              <div className="comments-block">
                {postComments.map((c) => {
                  const canDelete =
                    (c.user_id && c.user_id === myId) ||
                    c.author_pseudo === pseudo;

                  return (
                    <div key={c.id} className="comment-row">
                      <p className="comment-text">
                        <strong>{c.author_pseudo} :</strong> {c.content}
                      </p>
                      {canDelete && (
                        <button
                          className="icon-button small danger-text"
                          onClick={() => handleDeleteComment(c.id)}
                        >
                          <TrashIcon className="icon-14" />
                        </button>
                      )}
                    </div>
                  );
                })}

                <div className="comment-input-row">
                  <input
                    type="text"
                    placeholder="Comment..."
                    value={newComments[post.id] || ""}
                    onChange={(e) =>
                      setNewComments((prev) => ({
                        ...prev,
                        [post.id]: e.target.value,
                      }))
                    }
                    className="input"
                  />
                  <button
                    className="btn ghost-btn"
                    onClick={() => handleAddComment(post.id)}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

     {/* DELETE POST MODAL */}
{confirmDeletePostId && (
  <div className="modal-backdrop">
    <div className="modal-card">
      <h3>Delete this post?</h3>
      <p className="modal-text">
        This action is permanent. The attached media will also be removed.
      </p>
      <div className="modal-actions">
        <button
          className="btn ghost-btn"
          onClick={handleCancelDeletePost}
        >
          Cancel
        </button>
        <button
          className="btn danger-btn"
          onClick={handleConfirmDeletePost}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
)}


      {/* STYLES */}
      <style jsx>{`
        .feed-container {
          padding: 24px;
          max-width: 720px;
          margin: 0 auto;
          color: #f5f5f5;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
            sans-serif;
        }

        .feed-title {
          margin-bottom: 20px;
          font-size: 1.5rem;
          font-weight: 600;
          letter-spacing: 0.03em;
        }

        .card {
          background: rgba(10, 10, 12, 0.9);
          border-radius: 18px;
          border: 1px solid rgba(120, 120, 140, 0.28);
          padding: 16px 18px;
          margin-bottom: 18px;
          backdrop-filter: blur(12px);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
        }

        .card-create {
          background: radial-gradient(
              circle at top left,
              rgba(120, 120, 255, 0.18),
              transparent 55%
            ),
            rgba(10, 10, 14, 0.95);
        }

        .card-title {
          margin-bottom: 10px;
          font-size: 1rem;
          font-weight: 500;
        }

        .input,
        .textarea {
          width: 100%;
          background: rgba(20, 20, 30, 0.9);
          border-radius: 10px;
          border: 1px solid rgba(80, 80, 110, 0.6);
          color: #f3f3f3;
          padding: 8px 10px;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.16s ease, background 0.16s ease,
            box-shadow 0.16s ease, transform 0.08s ease;
        }

        .input:focus,
        .textarea:focus {
          border-color: rgba(140, 140, 255, 0.9);
          box-shadow: 0 0 0 1px rgba(140, 140, 255, 0.3);
          background: rgba(24, 24, 40, 0.95);
          transform: translateY(-0.5px);
        }

        .textarea {
          resize: vertical;
        }

        .file-label {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding: 8px 10px;
          font-size: 0.85rem;
          border-radius: 10px;
          background: rgba(22, 22, 32, 0.9);
          border: 1px dashed rgba(90, 90, 120, 0.7);
          color: #c7c7d8;
          cursor: pointer;
          transition: border-color 0.16s ease, background 0.16s ease,
            transform 0.08s ease;
        }

        .file-label:hover {
          border-color: rgba(150, 150, 255, 0.9);
          background: rgba(26, 26, 40, 0.95);
          transform: translateY(-0.5px);
        }

        .file-label input {
          display: none;
        }

        .btn {
          border-radius: 999px;
          border: 1px solid transparent;
          padding: 7px 16px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.16s ease, transform 0.08s ease,
            box-shadow 0.16s ease, border-color 0.16s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .primary-btn {
          background: linear-gradient(
            135deg,
            rgba(130, 130, 255, 0.95),
            rgba(100, 170, 255, 0.95)
          );
          color: #050509;
          font-weight: 500;
          box-shadow: 0 8px 20px rgba(80, 120, 255, 0.45);
        }

        .primary-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 30px rgba(80, 120, 255, 0.6);
        }

        .ghost-btn {
          background: transparent;
          border-color: rgba(110, 110, 135, 0.7);
          color: #d0d0e0;
        }

        .ghost-btn:hover {
          background: rgba(24, 24, 36, 0.95);
          border-color: rgba(140, 140, 255, 0.9);
        }

        .danger-btn {
          background: radial-gradient(
              circle at top left,
              rgba(255, 120, 120, 0.19),
              transparent 50%
            ),
            rgba(70, 16, 24, 0.98);
          border-color: rgba(235, 80, 90, 0.9);
          color: #ffe9ef;
        }

        .danger-btn:hover {
          box-shadow: 0 10px 22px rgba(255, 80, 110, 0.6);
          transform: translateY(-1px);
        }

        .post-card {
          position: relative;
        }

        .post-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .post-user {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 999px;
          object-fit: cover;
          border: 1px solid rgba(140, 140, 180, 0.7);
        }

        .post-author {
          font-size: 0.95rem;
          font-weight: 500;
          color: #f3f3ff;
          text-decoration: none;
        }

        .post-author:hover {
          text-decoration: underline;
        }

        .post-game {
          font-size: 0.75rem;
          color: #9a9ab8;
        }

        .post-content {
          margin-top: 10px;
          font-size: 0.95rem;
          line-height: 1.5;
          color: #e2e2f2;
        }

        .post-edit-block {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .edit-actions {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .post-media {
          width: 100%;
          border-radius: 14px;
          margin-top: 10px;
          border: 1px solid rgba(80, 80, 110, 0.7);
        }

        .post-actions {
          margin-top: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .icon-button {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          transition: background 0.12s ease, transform 0.08s ease;
        }

        .icon-button:hover {
          background: rgba(50, 50, 70, 0.6);
          transform: translateY(-0.5px);
        }

        .icon-button.small {
          padding: 3px;
        }

        .icon-20 {
          width: 20px;
          height: 20px;
        }

        .icon-18 {
          width: 18px;
          height: 18px;
        }

        .icon-16 {
          width: 16px;
          height: 16px;
        }

        .icon-14 {
          width: 14px;
          height: 14px;
        }

        .icon-text-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(24, 24, 36, 0.9);
          border: 1px solid rgba(70, 70, 110, 0.7);
          color: #dadaf5;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.16s ease, border-color 0.16s ease,
            transform 0.08s ease;
        }

        .icon-text-button:hover {
          background: rgba(34, 34, 50, 0.95);
          border-color: rgba(140, 140, 255, 0.9);
          transform: translateY(-0.5px);
        }

        .icon-text-inline {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.8rem;
          color: #8b8ba5;
        }

        .subtle {
          opacity: 0.7;
        }

        .comment-count {
          font-size: 0.8rem;
        }

        .comments-block {
          margin-top: 14px;
          border-top: 1px solid rgba(60, 60, 90, 0.7);
          padding-top: 10px;
        }

        .comment-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
        }

        .comment-text {
          font-size: 0.8rem;
          color: #d4d4ea;
          margin: 0;
        }

        .danger-text {
          color: #ff7777;
        }

        .comment-input-row {
          margin-top: 8px;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        /* Menu options ⋮ */

        .post-menu-wrapper {
          position: relative;
        }

        .options-menu {
          position: absolute;
          right: 0;
          top: 32px;
          min-width: 150px;
          background: rgba(18, 18, 28, 0.98);
          border-radius: 14px;
          border: 1px solid rgba(80, 80, 110, 0.8);
          padding: 6px 0;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.7);
          animation: fadeInScale 0.14s ease-out;
          transform-origin: top right;
          backdrop-filter: blur(16px);
          z-index: 20;
        }

        .options-menu-item {
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          color: #e5e5f5;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.14s ease, color 0.14s ease;
        }

        .options-menu-item:hover {
          background: rgba(44, 44, 70, 0.9);
        }

        .options-menu-item.danger {
          color: #ff9a9a;
        }

        .options-menu-item.danger:hover {
          background: rgba(70, 20, 30, 0.9);
          color: #ffe5ea;
        }

        /* Notifications */

        .notification {
          padding: 10px 14px;
          border-radius: 999px;
          font-size: 0.85rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 16px;
          border: 1px solid transparent;
          animation: fadeInUp 0.2s ease-out;
        }

        .notif-success {
          background: rgba(22, 50, 36, 0.95);
          border-color: rgba(60, 170, 110, 0.9);
          color: #d2ffea;
        }

        .notif-error {
          background: rgba(60, 24, 34, 0.96);
          border-color: rgba(230, 90, 120, 0.9);
          color: #ffe0ea;
        }

        /* Modal */

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 40;
          backdrop-filter: blur(8px);
          animation: fadeIn 0.18s ease-out;
        }

        .modal-card {
          background: rgba(10, 10, 18, 0.98);
          border-radius: 18px;
          padding: 18px 20px;
          max-width: 360px;
          width: 90%;
          border: 1px solid rgba(90, 90, 130, 0.8);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8);
          animation: scaleIn 0.18s ease-out;
        }

        .modal-card h3 {
          margin: 0 0 8px 0;
          font-size: 1.05rem;
          font-weight: 500;
        }

        .modal-text {
          font-size: 0.85rem;
          color: #c5c5dd;
          margin-bottom: 14px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        /* Animations */

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

        .subtle {
          opacity: 0.8;
        }

        .danger-text {
          color: #ff8888;
        }

        @media (max-width: 600px) {
          .feed-container {
            padding: 16px;
          }
          .card {
            padding: 14px 14px;
          }
        }
      `}</style>
    </>
  );
}
