"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  EllipsisVerticalIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";

/* =====================
   TYPES (identiques feed)
===================== */

export type Post = {
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

export type Comment = {
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

type Props = {
  post: Post;
  comments?: Comment[];
  myId?: string | null;
  pseudo?: string;
  games?: { id: string; name: string; slug: string }[];
  onPostDeleted?: (postId: string) => void;
  variant?: "feed" | "grid";
  hasVotedThisWeek?: boolean;
  onVote?: (postId: string) => void;
};


/* =====================
   THREAD TYPES
===================== */

type CommentNode = Comment & {
  replies: CommentNode[];
};

/* =====================
   HELPERS
===================== */

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

function buildCommentTree(all: Comment[] = []) {
  const map: Record<string, CommentNode> = {};
  const roots: CommentNode[] = [];

  all.forEach((c) => {
    map[c.id] = { ...c, replies: [] };
  });


  all.forEach((c) => {
    if (c.parent_id && map[c.parent_id]) {
      map[c.parent_id].replies.push(map[c.id]);
    } else if (!c.parent_id) {
      roots.push(map[c.id]);
    }
  });

  return roots;
}

/* =====================
   COMPONENT
===================== */

export default function PostCard({
  post,
  comments = [],
  myId = null,
  pseudo = "",
  games = [],
  onPostDeleted,
  variant = "feed",
  hasVotedThisWeek = false,
  onVote,
}: Props) {

  const [openMenu, setOpenMenu] = useState(false);
  const [openComments, setOpenComments] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [localHasVoted, setLocalHasVoted] = useState(hasVotedThisWeek);

  const [localComments, setLocalComments] = useState<Comment[]>(comments);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const [likesCount, setLikesCount] = useState(post.likes_count ?? 0);
  const [isLiked, setIsLiked] = useState(!!post.isLikedByMe);

  // Sync local vote state with prop
  useEffect(() => {
    setLocalHasVoted(hasVotedThisWeek);
  }, [hasVotedThisWeek]);

  /* =====================
     POST ACTIONS
  ===================== */

  const toggleLike = async () => {
    if (!myId) return;

    const currentlyLiked = isLiked;

    setIsLiked(!currentlyLiked);
    setLikesCount((c) => Math.max(0, c + (currentlyLiked ? -1 : 1)));

    const { error } = currentlyLiked
      ? await supabase
          .from("likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", myId)
      : await supabase.from("likes").insert({
          post_id: post.id,
          user_id: myId,
        });

    if (error) {
      // rollback
      setIsLiked(currentlyLiked);
      setLikesCount((c) => Math.max(0, c + (currentlyLiked ? 1 : -1)));
      console.error(error);
    }
  };

  const deletePost = async () => {
    if (!myId || myId !== post.user_id) return;

    const ok = confirm("Delete this post?");
    if (!ok) return;

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", myId);

    if (!error && onPostDeleted) onPostDeleted(post.id);
  };

  /* =====================
     COMMENTS
  ===================== */

  const addComment = async () => {
    if (!myId || !newComment.trim()) return;

    const { error, data } = await supabase
      .from("comments")
      .insert({
        post_id: post.id,
        parent_id: replyTo,
        content: newComment,
        author_pseudo: pseudo,
        user_id: myId,
      })
      .select()
      .single();

    if (!error && data) {
      setLocalComments((c) => [...c, data]);
      setNewComment("");
      setReplyTo(null);
    }
  };

  const toggleCommentLike = async (comment: Comment) => {
    if (!myId) return;

    const liked = !!comment.isLikedByMe;

    setLocalComments((prev) =>
      prev.map((c) =>
        c.id !== comment.id
          ? c
          : {
              ...c,
              isLikedByMe: !liked,
              likes_count: (c.likes_count ?? 0) + (liked ? -1 : 1),
            }
      )
    );

    const { error } = liked
      ? await supabase
          .from("comment_likes")
          .delete()
          .eq("comment_id", comment.id)
          .eq("user_id", myId)
      : await supabase.from("comment_likes").insert({
          comment_id: comment.id,
          user_id: myId,
        });

    if (error) console.error(error);
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (!error) {
      setLocalComments((c) => c.filter((x) => x.id !== commentId));
    }
  };

  /* =====================
     VOTE FOR POST OF THE WEEK
  ===================== */

  const handleVoteClick = () => {
    if (localHasVoted || hasVotedThisWeek || !myId) return;
    setShowVoteModal(true);
  };

    const handleConfirmVote = async () => {
    if (!myId || localHasVoted || hasVotedThisWeek) return;

    // Get current week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday = 1
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("weekly_post_votes")
      .insert({
        user_id: myId,
        post_id: post.id,
        week_start: weekStart.toISOString().split('T')[0], // YYYY-MM-DD format
      })
      .select()
      .single();

    if (error) {
      // Check if error is due to unique constraint (already voted)
      if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
        // User already voted this week
        setLocalHasVoted(true);
        setShowVoteModal(false);
        // Note: PostCard doesn't have showNotification, so we rely on parent component
        return;
      }

      // Log full error details for debugging
      console.error("Error voting - Full response:", {
        error: JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        errorCode: error.code,
      });
      
      setShowVoteModal(false);
      // Note: PostCard doesn't have showNotification, so we rely on parent component
      // The error will be visible in console for debugging
      return;
    }

    // Immediately update local state to disable button
    setLocalHasVoted(true);
    setShowVoteModal(false);
    
    if (onVote) {
      onVote(post.id);
    }
  };

  /* =====================
     RENDER COMMENT
  ===================== */

  const renderComment = (c: CommentNode, depth = 0) => {
    const canDelete =
      (c.user_id && c.user_id === myId) || c.author_pseudo === pseudo;

    return (
      <div key={c.id}>
        <div className="glass-comment">
          <div className="comment-header-with-avatar">
            <Link href={`/profile/${c.user_id}`}>
              <img
                src={
                  c.avatar_url ||
                  "https://via.placeholder.com/32/333333/FFFFFF?text=?"
                }
                className="comment-avatar"
                alt={c.author_pseudo}
              />
            </Link>
            <div className="comment-header-content">
              <Link
                href={`/profile/${c.user_id}`}
                className="comment-author clickable-author"
              >
                {c.author_pseudo}
              </Link>
            </div>
          </div>
          <div className="comment-content">
            <span className="comment-text">{c.content}</span>
          </div>

          <div className="comment-actions">
            <div className="comment-actions-left">
              <button
                className="comment-reply-link"
                onClick={() => {
                  setReplyTo(c.id);
                  setNewComment(`@${c.author_pseudo} `);
                }}
                type="button"
              >
                Reply
              </button>

              {canDelete && (
                <button
                  className="btn danger-btn btn-small"
                  onClick={() => deleteComment(c.id)}
                  type="button"
                >
                  Delete
                </button>
              )}
            </div>

            <button
              className={`comment-like-heart ${c.isLikedByMe ? "liked" : ""}`}
              onClick={() => toggleCommentLike(c)}
              type="button"
            >
              {c.isLikedByMe ? (
                <HeartIconSolid className="comment-heart-icon" />
              ) : (
                <HeartIcon className="comment-heart-icon" />
              )}
              <span className="comment-like-count">{c.likes_count ?? 0}</span>
            </button>
          </div>

          {c.replies.length > 0 && (
            <div className="comment-replies-wrapper" style={{ marginLeft: 40 }}>
              {c.replies.map((r) => renderComment(r, depth + 1))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const tree = buildCommentTree(localComments);

  /* =====================
     RENDER
  ===================== */

  return (
    <div className="card post-card">
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
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid rgba(156, 163, 175, 0.2)",
              }}
            />
          </Link>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <Link
                href={`/profile/${post.user_id}`}
                className="post-author"
              >
                {post.author_pseudo}
              </Link>

              {post.games && (
                <Link
                  href={`/games/${post.games.slug}`}
                  className="game-link"
                  style={{ marginLeft: 10 }}
                >
                  {post.games.name}
                </Link>
              )}
            </div>
            <span className="post-date">
              {formatPostDate(post.created_at)}
            </span>
          </div>
        </div>

        {post.user_id === myId && (
          <button className="icon-button" onClick={() => setOpenMenu(!openMenu)}>
            <EllipsisVerticalIcon className="icon-20" />
          </button>
        )}

        {openMenu && (
          <div className="options-menu">
            <button className="options-menu-item danger" onClick={deletePost}>
              <TrashIcon className="icon-16" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <p className="post-content">{post.content}</p>

      {/* MEDIA */}
{post.media_url && (
  <div
    className={`post-media-wrapper ${variant}`}
  >
    {post.media_type === "image" && (
      <img src={post.media_url} className="post-media" />
    )}

    {post.media_type === "video" && (
      <video
        src={post.media_url}
        autoPlay
        muted
        controls
        playsInline
        preload="metadata"
        className="post-media"
      />
    )}
  </div>
)}


      {/* Actions */}
      <div className="post-actions">
        {/* LIKE BUTTON */}
        <button
          className={`like-button ${isLiked ? "liked" : ""}`}
          onClick={toggleLike}
          type="button"
          disabled={!myId}
        >
          {isLiked ? (
            <HeartIconSolid className="like-icon" />
          ) : (
            <HeartIcon className="like-icon" />
          )}
          <span>{likesCount}</span>
        </button>

        {/* VOTE BUTTON */}
        {myId && (
          <button
            className={`vote-button ${localHasVoted || hasVotedThisWeek ? "voted" : ""}`}
            onClick={handleVoteClick}
            type="button"
            disabled={localHasVoted || hasVotedThisWeek}
            title={localHasVoted || hasVotedThisWeek ? "You have already voted this week" : "Vote for Post of the Week"}
          >
            <ChartBarIcon className="vote-icon" />
          </button>
        )}
      </div>

      {/* Comment toggle button */}
      <button
        className="btn ghost-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpenComments(!openComments);
        }}
        type="button"
        style={{ marginTop: "12px" }}
      >
        {openComments ? "Hide comments" : `Show comments (${tree.length})`}
      </button>

      {/* Comments */}
      {openComments && (
        <div className="glass-card">
          {tree.map((c) => renderComment(c))}

          <div className="comment-input-row">
            <input
              className="input"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Comment..."
            />
            <button className="btn ghost-btn btn-small" onClick={addComment} type="button">
              Send
            </button>
          </div>
        </div>
      )}

      {/* Vote Confirmation Modal */}
      {showVoteModal && (
        <div className="vote-modal-backdrop" onClick={() => setShowVoteModal(false)}>
          <div className="vote-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Vote for Post of the Week</h3>
            <p>You only have one vote per week.</p>
            <p>Are you sure you want to use it for this post?</p>
            <div className="vote-modal-actions">
              <button
                className="btn primary-btn"
                onClick={handleConfirmVote}
                type="button"
              >
                Yes
              </button>
              <button
                className="btn ghost-btn"
                onClick={() => setShowVoteModal(false)}
                type="button"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
