"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  EllipsisVerticalIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
} from "@heroicons/react/24/outline";

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
  comments: Comment[];
  myId: string | null;
  pseudo: string;
  games: { id: string; name: string; slug: string }[];
  onPostDeleted?: (postId: string) => void;
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

function buildCommentTree(all: Comment[]): CommentNode[] {
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
  comments,
  myId,
  pseudo,
  games,
  onPostDeleted,
}: Props) {
  const [openMenu, setOpenMenu] = useState(false);
  const [openComments, setOpenComments] = useState(false);

  const [localComments, setLocalComments] = useState<Comment[]>(comments);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const [likesCount, setLikesCount] = useState(post.likes_count ?? 0);
  const [isLiked, setIsLiked] = useState(!!post.isLikedByMe);

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
     RENDER COMMENT
  ===================== */

  const renderComment = (c: CommentNode, depth = 0) => {
    const canDelete =
      (c.user_id && c.user_id === myId) || c.author_pseudo === pseudo;

    return (
      <div key={c.id} style={{ paddingLeft: depth * 14 }}>
        <div className="glass-comment">
          <div className="comment-line">
            <Link
              href={`/profile/${c.user_id}`}
              className="comment-author clickable-author"
            >
              {c.author_pseudo}
            </Link>
            <span className="comment-text">{c.content}</span>
          </div>

          <div className="comment-actions">
            <button
              className="comment-action"
              onClick={() => {
                setReplyTo(c.id);
                setNewComment(`@${c.author_pseudo} `);
              }}
            >
              Reply
            </button>

            <button
              className="comment-action"
              onClick={() => toggleCommentLike(c)}
            >
              ❤️ {c.likes_count ?? 0}
            </button>

            {canDelete && (
              <button
                className="comment-action danger"
                onClick={() => deleteComment(c.id)}
              >
                Delete
              </button>
            )}
          </div>

          {c.replies.map((r) => renderComment(r, depth + 1))}
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
            />
          </Link>

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

      {post.media_type === "image" && post.media_url && (
        <img src={post.media_url} className="post-media" />
      )}

      {post.media_type === "video" && post.media_url && (
        <video src={post.media_url} controls className="post-media" />
      )}

      {/* Actions */}
      <div className="post-actions">
        <button
          className={`like-button ${isLiked ? "liked" : ""}`}
          onClick={toggleLike}
        >
          👍 {likesCount}
        </button>

        <button
          className="icon-text-inline"
          onClick={() => setOpenComments(!openComments)}
        >
          <ChatBubbleLeftIcon className="icon-18 subtle" />
          {localComments.length}
        </button>
      </div>

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
            <button className="btn ghost-btn" onClick={addComment}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
