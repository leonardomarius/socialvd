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
  likes?: number;
  parent_id?: string | null;
  is_liked_by_me?: boolean;
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
  const [replyToComment, setReplyToComment] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState<string>("");

  const [newPost, setNewPost] = useState("");
  const [newGame, setNewGame] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  // Edition
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [editGame, setEditGame] = useState<string>("");

  // Post menu ⋮
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [notification, setNotification] = useState<Notification | null>(null);

  const showNotification = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Close menu if clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuPostId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // -----------------------------------------
  // LOAD SESSION
  // -----------------------------------------
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
  }, [router]);

  // -----------------------------------------
  // LOAD POSTS + COMMENTS
  // -----------------------------------------
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
      .select("*, user_id")
      .order("created_at", { ascending: true });

    const { data: myLikes } = await supabase
      .from("comment_likes")
      .select("comment_id")
      .eq("user_id", myId);

    const likedSet = new Set(myLikes?.map((l) => l.comment_id) || []);

    const commentsFormatted =
      commentsData?.map((c: any) => ({
        ...c,
        is_liked_by_me: likedSet.has(c.id),
      })) || [];

    setComments(commentsFormatted);
  };
  // -----------------------------------------
  // UPLOAD MEDIA
  // -----------------------------------------
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

  // -----------------------------------------
  // DELETE MEDIA FROM STORAGE
  // -----------------------------------------
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

  // -----------------------------------------
  // CREATE POST
  // -----------------------------------------
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

  // -----------------------------------------
  // ADD COMMENT
  // -----------------------------------------
  if (myId === null) {
  return <div style={{ padding: "20px", color: "white" }}>Loading...</div>;
}


  const handleAddComment = async (postId: string) => {
    const content = newComments[postId];
    if (!content) return;

    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      content,
      author_pseudo: pseudo,
      user_id: myId,
    });

    if (error) {
      console.error(error);
      showNotification("Error adding comment", "error");
      return;
    }

    const post = posts.find((p) => p.id === postId);

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

  // -----------------------------------------
  // REPLY TO COMMENT
  // -----------------------------------------
  const handleReply = async (commentId: string) => {
    if (!replyContent.trim() || !myId) return;

    const parentComment = comments.find((c) => c.id === commentId);
    if (!parentComment) return;

    const { error } = await supabase.from("comments").insert({
      post_id: parentComment.post_id,
      content: replyContent,
      author_pseudo: pseudo,
      user_id: myId,
      parent_id: commentId,
    });

    if (error) {
      console.error(error);
      showNotification("Error replying", "error");
      return;
    }

    if (parentComment.user_id && parentComment.user_id !== myId) {
      await supabase.from("notifications").insert({
        user_id: parentComment.user_id,
        from_user_id: myId,
        type: "reply",
        post_id: parentComment.post_id,
        message: `${pseudo} replied to your comment`,
      });
    }

    setReplyContent("");
    setReplyToComment(null);
    loadAllData();
  };

  // -----------------------------------------
// DELETE POST (simple confirm)
// -----------------------------------------
const handleDeletePost = async (postId: string) => {
  if (!myId) return;

  const ok = window.confirm("Delete this post permanently?");
  if (!ok) return;

  const post = posts.find((p) => p.id === postId);
  const mediaUrl = post?.media_url || null;

  if (mediaUrl) await deleteMediaFile(mediaUrl);

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", myId);

  if (error) {
    console.error(error);
    showNotification("Error deleting post", "error");
    return;
  }

  setPosts((prev) => prev.filter((p) => p.id !== postId));

  showNotification("Post deleted");
};


  // -----------------------------------------
  // LIKE POST USING RPC
  // -----------------------------------------
  const handleLike = async (postId: string) => {
    const { error } = await supabase.rpc("toggle_like", { p_post_id: postId });

    if (error) {
      console.error(error);
      showNotification("Error while liking", "error");
      return;
    }



    const post = posts.find((p) => p.id === postId);

    if (post && post.user_id !== myId) {
      await supabase.from("notifications").insert({
        user_id: post.user_id,
        from_user_id: myId,
        type: "like",
        post_id: postId,
        message: `${pseudo} liked your post`,
      });
    }

    loadAllData();
  };

  // -----------------------------------------
  // DELETE COMMENT
  // -----------------------------------------
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

  // -----------------------------------------
  // LIKE COMMENT
  // -----------------------------------------
  const handleLikeComment = async (commentId: string) => {
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;

    const { error } = await supabase.rpc("toggle_comment_like", {
      p_comment_id: commentId,
    });

    if (error) {
      console.error(error);
      showNotification("Error while liking comment", "error");
      return;
    }

    if (comment.user_id && comment.user_id !== myId) {
      await supabase.from("notifications").insert({
        user_id: comment.user_id,
        from_user_id: myId,
        type: "comment_like",
        post_id: comment.post_id,
        message: `${pseudo} liked your comment`,
      });
    }

    loadAllData();
  };

  // -----------------------------------------
  // EDIT POST
  // -----------------------------------------
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

    // -----------------------------------------
  // RENDER
  // -----------------------------------------
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

        {/* Create Post Form */}
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
          const postComments = comments.filter(
            (c) => c.post_id === post.id && !c.parent_id
          );
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

                {/* --- FIXED CLEAN ⋮ MENU --- */}
                {post.user_id === myId && !isEditing && (
                  <div className="post-menu-wrapper">
                    <button
                      className="menu-trigger"
                      onClick={() =>
                        setOpenMenuPostId(isMenuOpen ? null : post.id)
                      }
                    >
                      <EllipsisVerticalIcon className="menu-icon" />
                    </button>

                    {isMenuOpen && (
                      <div ref={menuRef} className="post-menu-panel">
                      <button
  type="button"
  className="menu-item edit-item"
  onClick={() => handleStartEditPost(post)}
>
  ✏️ Edit
</button>

<button
  type="button"
  className="menu-item delete-item"
  onClick={() => handleDeletePost(post.id)}
>
  🗑️ Delete
</button>


                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Content or Editing */}
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
  type="button"
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
                <video src={post.media_url} controls className="post-media" />
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

              {/* Comments */}
              <div className="comments-block">
                {postComments.map((c) => {
                  const canDelete =
                    (c.user_id && c.user_id === myId) ||
                    c.author_pseudo === pseudo;

                  return (
                    <div key={c.id}>
                      {/* MAIN COMMENT */}
                      <div className="comment-row">
                        <p className="comment-text">
                          {c.user_id ? (
                            <Link
                              href={`/profile/${c.user_id}`}
                              className="comment-author username-small"
                              style={{ textDecoration: "none" }}
                            >
                              {c.author_pseudo}
                            </Link>
                          ) : (
                            <span className="comment-author username-small">
                              {c.author_pseudo}
                            </span>
                          )}

                          <span className="comment-separator"> · </span>
                          <span>{c.content}</span>

                          <button
                            className="icon-button small"
                            onClick={() => setReplyToComment(c.id)}
                            style={{
                              fontSize: "0.7rem",
                              opacity: 0.8,
                              marginLeft: "6px",
                            }}
                          >
                            Reply
                          </button>
                        </p>

                        {/* Like comment */}
                        <button
                          className={`comment-like-button ${
                            c.is_liked_by_me ? "liked" : ""
                          }`}
                          onClick={() => handleLikeComment(c.id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          <HandThumbUpIcon className="icon-16" />
                          <span className="comment-like-count">
                            {c.likes || 0}
                          </span>
                        </button>

                        {/* Delete comment */}
                        {canDelete && (
                          <button
  type="button"
  className="icon-button small danger-text"
  onClick={() => handleDeleteComment(c.id)}
>
  <TrashIcon className="icon-14" />
</button>

                        )}
                      </div>

                      {/* Reply field */}
                      {replyToComment === c.id && (
                        <div
                          className="comment-input-row"
                          style={{ marginLeft: "40px", marginTop: "4px" }}
                        >
                          <input
                            type="text"
                            placeholder="Reply..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            className="input"
                          />
                          <button
                            className="btn ghost-btn"
                            onClick={() => handleReply(c.id)}
                          >
                            Send
                          </button>
                        </div>
                      )}

                      {/* Replies */}
                      {comments
                        .filter((r) => r.parent_id === c.id)
                        .map((r) => (
                          <div
                            key={r.id}
                            className="comment-row"
                            style={{
                              marginLeft: "40px",
                              marginTop: "4px",
                              background: "rgba(10, 10, 20, 0.6)",
                            }}
                          >
                            <p className="comment-text">
                              {r.user_id ? (
                                <Link
                                  href={`/profile/${r.user_id}`}
                                  className="comment-author username-small"
                                  style={{ textDecoration: "none" }}
                                >
                                  {r.author_pseudo}
                                </Link>
                              ) : (
                                <span className="comment-author username-small">
                                  {r.author_pseudo}
                                </span>
                              )}

                              <span className="comment-separator"> · </span>
                              <span>{r.content}</span>

                              <button
                                className={`comment-like-button ${
                                  r.is_liked_by_me ? "liked" : ""
                                }`}
                                onClick={() => handleLikeComment(r.id)}
                              >
                                <HandThumbUpIcon className="icon-16" />
                                <span className="comment-like-count">
                                  {r.likes || 0}
                                </span>
                              </button>
                            </p>
                          </div>
                        ))}
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

      {/* STYLES */}
      <style jsx>{`
        /********************************************
         * FEED CONTAINER
         ********************************************/
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

        /********************************************
         * CARD BASE  –  style « Neon Soft Hybrid »
         ********************************************/
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

        /********************************************
         * INPUTS
         ********************************************/
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

        /********************************************
         * FILE UPLOAD LABEL
         ********************************************/
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

        /********************************************
         * BUTTONS
         ********************************************/
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

        /********************************************
         * AVATAR & HEADER
         ********************************************/
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

        .post-game {
          margin-top: 1px;
          font-size: 0.78rem;
          opacity: 0.75;
          color: #b8baf2;
        }

        /********************************************
         * POST CONTENT / MEDIA
         ********************************************/
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

        /********************************************
         * POST ACTIONS
         ********************************************/
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

        .icon-20 {
          width: 20px;
          height: 20px;
          color: #f4f5ff;
          flex-shrink: 0;
        }

        .icon-18 {
          width: 18px;
          height: 18px;
          color: #f4f5ff;
          flex-shrink: 0;
        }

        .icon-16 {
          width: 16px;
          height: 16px;
          color: #f4f5ff;
          flex-shrink: 0;
        }

        .icon-14 {
          width: 14px;
          height: 14px;
          color: #ff8b8b;
          flex-shrink: 0;
        }

        .icon-text-button {
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

        .icon-text-button:hover {
          background: rgba(30, 32, 48, 0.96);
          border-color: rgba(120, 140, 255, 0.95);
          box-shadow: 0 0 14px rgba(130, 150, 255, 0.28);
          transform: translateY(-1px);
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

        /********************************************
         * COMMENTS
         ********************************************/
        .comments-block {
          margin-top: 14px;
          padding-top: 10px;
          border-top: 1px solid rgba(65, 65, 100, 0.65);
        }

        .comment-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 7px;
          padding: 7px 11px;
          border-radius: 10px;
          background: rgba(18, 18, 30, 0.72);
          border: 1px solid rgba(75, 80, 130, 0.6);
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

        /* COMMENT LIKE BUTTON */
        .comment-like-button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(28, 30, 50, 0.75);
          border: 1px solid rgba(110, 130, 255, 0.28);
          padding: 6px 10px;
          border-radius: 12px;
          cursor: pointer;
          transition: 0.18s ease;
          color: #e6e8ff;
        }

        .comment-like-button:hover {
          background: rgba(45, 48, 78, 0.9);
          border-color: rgba(150, 170, 255, 0.95);
          transform: translateY(-1px);
        }

        .comment-like-button.liked {
          background: rgba(70, 90, 255, 0.32);
          border-color: rgba(120, 140, 255, 0.95);
          box-shadow: 0 0 12px rgba(120, 140, 255, 0.55);
        }

        .comment-like-count {
          font-size: 0.75rem;
          font-weight: 600;
          color: #dfe1ff;
        }

        /********************************************
         * FIXED ⋮ MENU (new version)
         ********************************************/
        .post-menu-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;   /* 🔥 LA CLÉ : espace garanti pour l’icône */
}


        .menu-trigger {
  background: rgba(40, 40, 70, 0.45);      /* ✔ bouton visible */
  border: 1px solid rgba(120, 130, 200, 0.6);
  padding: 8px;                             /* ✔ plus large */
  border-radius: 10px;
  cursor: pointer;
  transition: 0.15s ease;
}

.menu-trigger:hover {
  background: rgba(70, 80, 140, 0.65);
  border-color: rgba(150, 160, 255, 0.95);
}

.menu-icon {
  width: 22px;
  height: 22px;
  color: #ffffff;                           /* ✔ TRÈS visible maintenant */
}


        .post-menu-panel {
          position: absolute;
          right: 0;
          top: 32px;
          min-width: 145px;
          background: rgba(14, 14, 26, 0.96);
          border-radius: 14px;
          border: 1px solid rgba(90, 100, 150, 0.9);
          padding: 6px 0;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.7);
          animation: fadeInScale 0.15s ease-out;
          transform-origin: top right;
          backdrop-filter: blur(16px);
          z-index: 50;
        }

        .menu-item {
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          color: #e8e8ff;
          display: flex;
          gap: 8px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .menu-item:hover {
          background: rgba(35, 35, 60, 0.88);
        }

        .delete-item {
          color: #ffb4b4;
        }

        .delete-item:hover {
          background: rgba(80, 24, 36, 0.92);
          color: #ffe5ed;
        }

        /********************************************
         * ANIMATIONS
         ********************************************/
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

        /********************************************
         * RESPONSIVE
         ********************************************/
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
