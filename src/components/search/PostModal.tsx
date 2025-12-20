"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import PostCard from "@/components/PostCard";
import type { Post, Comment } from "@/components/PostCard";

type PostModalProps = {
  postId: string;
  initialPost?: Post;
  onClose: () => void;
  myId: string | null;
  pseudo: string;
};

export default function PostModal({
  postId,
  initialPost,
  onClose,
  myId,
  pseudo,
}: PostModalProps) {
  const [post, setPost] = useState<Post | null>(initialPost || null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(!initialPost);
  const [games, setGames] = useState<
    { id: string; name: string; slug: string }[]
  >([]);

  useEffect(() => {
    // Load post and comments
    const loadData = async () => {
      if (initialPost) {
        setPost(initialPost);
        setLoading(false);
      } else {
        // Load post from database
        const { data: postData, error: postError } = await supabase
          .from("posts")
          .select(
            `
            *,
            games (
              id,
              name,
              slug
            )
          `
          )
          .eq("id", postId)
          .single();

        if (postError || !postData) {
          console.error("Error loading post:", postError);
          onClose();
          return;
        }

        // Count likes manually
        const { count: likesCount } = await supabase
          .from("likes")
          .select("*", { count: "exact", head: true })
          .eq("post_id", postId);

        // Check if current user liked this post
        let isLikedByMe = false;
        if (myId) {
          const { data: myLike } = await supabase
            .from("likes")
            .select("id")
            .eq("post_id", postId)
            .eq("user_id", myId)
            .single();
          isLikedByMe = !!myLike;
        }

        // Get avatar
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", postData.user_id)
          .single();

        setPost({
          ...postData,
          avatar_url: profile?.avatar_url || null,
          likes_count: likesCount || 0,
          isLikedByMe,
        });
      }

      // Load comments
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select(`
          id,
          post_id,
          user_id,
          author_pseudo,
          content,
          created_at,
          parent_id
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (!commentsError && commentsData) {
        // Load comment likes counts
        const commentIds = commentsData.map((c) => c.id);
        const { data: commentLikesData } = await supabase
          .from("comment_likes")
          .select("comment_id")
          .in("comment_id", commentIds);

        // Count likes per comment
        const likesCountMap: Record<string, number> = {};
        commentLikesData?.forEach((like) => {
          likesCountMap[like.comment_id] = (likesCountMap[like.comment_id] || 0) + 1;
        });

        // Check which comments are liked by current user
        const myCommentLikesMap: Record<string, boolean> = {};
        if (myId && commentIds.length > 0) {
          const { data: myCommentLikes } = await supabase
            .from("comment_likes")
            .select("comment_id")
            .in("comment_id", commentIds)
            .eq("user_id", myId);

          myCommentLikes?.forEach((like) => {
            myCommentLikesMap[like.comment_id] = true;
          });
        }

        const formattedComments: Comment[] = commentsData.map((c: any) => ({
          ...c,
          likes_count: likesCountMap[c.id] || 0,
          isLikedByMe: !!myCommentLikesMap[c.id],
        }));

        // Get avatars for comments
        const userIds = [
          ...new Set(formattedComments.map((c) => c.user_id).filter(Boolean)),
        ];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, avatar_url")
            .in("id", userIds);

          const avatarMap: Record<string, string | null> = {};
          profiles?.forEach((p) => {
            avatarMap[p.id] = p.avatar_url;
          });

          formattedComments.forEach((c) => {
            if (c.user_id) {
              c.avatar_url = avatarMap[c.user_id] || null;
            }
          });
        }

        setComments(formattedComments);
      }

      // Load games for PostCard
      const { data: gamesData } = await supabase
        .from("games")
        .select("id, name, slug")
        .order("name");

      if (gamesData) {
        setGames(gamesData);
      }

      setLoading(false);
    };

    loadData();
  }, [postId, initialPost, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (loading || !post) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="search-modal-card" onClick={(e) => e.stopPropagation()}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="search-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="search-modal-close" onClick={onClose} type="button">
          ×
        </button>
        <PostCard
          post={post}
          comments={comments}
          myId={myId}
          pseudo={pseudo}
          games={games}
        />
      </div>
      <style jsx>{`
        .search-modal-card {
          width: 680px;
          max-width: 90vw;
          max-height: 85vh;
          overflow-y: auto;
          overflow-x: hidden;
          background: rgba(30, 30, 30, 0.95);
          backdrop-filter: blur(16px);
          border-radius: 12px;
          border: 1px solid rgba(100, 100, 100, 0.3);
          padding: 24px;
          position: relative;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
        }

        .search-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          background: rgba(30, 30, 30, 0.8);
          border: 1px solid rgba(100, 100, 100, 0.3);
          color: #ffffff;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 10;
        }

        .search-modal-close:hover {
          background: rgba(40, 40, 40, 0.9);
          border-color: rgba(250, 204, 21, 0.5);
          color: #facc15;
        }
      `}</style>
    </div>
  );
}

