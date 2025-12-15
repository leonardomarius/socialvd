"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Game = {
  id: string;
  name: string;
  slug: string;
};

type Post = {
  id: string;
  content: string;
  created_at: string;
  author_pseudo: string | null;
  user_id: string;
  media_url: string | null;
  media_type: string | null;
  games: Game[]; // 👈 Supabase retourne un tableau
};

export default function GameFeedPage() {
  const { slug } = useParams<{ slug: string }>();

  const [game, setGame] = useState<Game | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    const loadGameAndPosts = async () => {
      setLoading(true);

      // 1️⃣ Charger le jeu
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("id, name, slug")
        .eq("slug", slug)
        .single();

      if (gameError || !gameData) {
        console.error(gameError);
        setLoading(false);
        return;
      }

      setGame(gameData);

      // 2️⃣ Charger les posts du jeu
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(
          `
          id,
          content,
          created_at,
          author_pseudo,
          user_id,
          media_url,
          media_type,
          games (
            id,
            name,
            slug
          )
        `
        )
        .eq("game_id", gameData.id)
        .order("created_at", { ascending: false });

      if (postsError) {
        console.error(postsError);
      } else {
        setPosts(postsData || []);
      }

      setLoading(false);
    };

    loadGameAndPosts();
  }, [slug]);

  if (loading) {
    return <div style={{ padding: 30 }}>Loading…</div>;
  }

  if (!game) {
    return <div style={{ padding: 30 }}>Game not found</div>;
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: 8 }}>{game.name}</h1>
      <Link
  href={`/feed?game=${game.id}`}
  className="btn primary-btn"
  style={{ marginBottom: 18 }}
>
  Post about {game.name}
</Link>
      <p style={{ opacity: 0.7, marginTop: 12, marginBottom: 24 }}>
  Posts related to this game
</p>


      {posts.length === 0 && (
        <p style={{ opacity: 0.6 }}>No posts yet for this game.</p>
      )}

      {posts.map((post) => (
        <div
          key={post.id}
          style={{
            padding: 16,
            marginBottom: 16,
            borderRadius: 14,
            background: "rgba(20,20,40,0.6)",
          }}
        >
          <Link
            href={`/profile/${post.user_id}`}
            style={{ fontWeight: 600 }}
          >
            {post.author_pseudo}
          </Link>

          <p style={{ marginTop: 8 }}>{post.content}</p>

          {post.media_type === "image" && post.media_url && (
            <img
              src={post.media_url}
              style={{ width: "100%", marginTop: 10, borderRadius: 12 }}
            />
          )}

          {post.media_type === "video" && post.media_url && (
            <video
              src={post.media_url}
              controls
              style={{ width: "100%", marginTop: 10, borderRadius: 12 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
