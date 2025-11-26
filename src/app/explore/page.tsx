"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Post = {
  id: string;
  content: string;
  user_id: string;
  author_pseudo: string | null;
  game: string | null;
  likes: number;
  created_at: string;
};

export default function ExplorePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setPosts(data);

    setLoading(false);
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Explore</h1>

      {posts.length === 0 && <p>No posts yet.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {posts.map((post) => (
          <article
            key={post.id}
            style={{
              padding: 16,
              borderRadius: 8,
              border: "1px solid #333",
              background: "#111",
            }}
          >
            <Link
              href={`/profile/${post.user_id}`}
              style={{
                fontWeight: "bold",
                color: "#4aa3ff",
                textDecoration: "none",
              }}
            >
              {post.author_pseudo || "User"}
            </Link>

            <p style={{ marginTop: 8 }}>{post.content}</p>

            <p
              style={{
                color: "#777",
                fontSize: 12,
                marginTop: 10,
              }}
            >
              {new Date(post.created_at).toLocaleString("en-US")}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
