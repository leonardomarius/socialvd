"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Post = {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  game: string | null;
  likes: number;
  created_at: string;
};

type Props = {
  post: Post;
  myId: string | null;
  onDeleted?: () => void;
};

export default function PostCard({ post, myId, onDeleted }: Props) {
  const [likes, setLikes] = useState(post.likes ?? 0);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    setLikes(post.likes ?? 0);
  }, [post.id, post.likes]);

  const handleToggleLike = async () => {
    if (!myId || isLiking) return;

    setIsLiking(true);
    setLikes((prev) => prev + 1);

    const { error } = await supabase.rpc("toggle_like", {
      p_post_id: post.id,
      p_user_id: myId,
    });

    if (error) {
      setLikes((prev) => Math.max(prev - 1, 0));
      console.error(error);
    }

    setIsLiking(false);
  };

  const handleDelete = async () => {
    if (!myId || myId !== post.user_id) return;

    const ok = confirm("Delete this post?");
    if (!ok) return;

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id);

    if (!error && onDeleted) onDeleted();
  };

  return (
    <div
      style={{
        background: "rgba(20,20,30,0.9)",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <p style={{ marginBottom: 10 }}>{post.content}</p>

      {post.media_type === "image" && post.media_url && (
        <img
          src={post.media_url}
          style={{ width: "100%", borderRadius: 12 }}
        />
      )}

      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 14,
          alignItems: "center",
        }}
      >
        <button onClick={handleToggleLike}>
          👍 {likes}
        </button>

        {myId === post.user_id && (
          <button
            onClick={handleDelete}
            style={{ marginLeft: "auto", color: "red" }}
          >
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  );
}
