"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import FeedView from "@/components/FeedView";

export default function GameFeedPage() {
  const { slug } = useParams<{ slug: string }>();
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    const loadGame = async () => {
      const { data, error } = await supabase
        .from("games")
        .select("id")
        .eq("slug", slug)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      setGameId(data?.id ?? null);
    };

    loadGame();
  }, [slug]);

  if (!gameId) {
    return <div style={{ padding: 30 }}>Loading…</div>;
  }

  return <FeedView forcedGameId={gameId} />;
}
