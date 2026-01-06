"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import FeedView from "@/components/FeedView";

export default function GameFeedPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Invalid game slug");
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadGame = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("games")
          .select("id")
          .eq("slug", slug)
          .single();

        if (!mounted) return;

        if (fetchError) {
          console.error("Game fetch error:", fetchError);
          // ✅ Distinguer "not found" de "erreur réseau"
          if (fetchError.code === "PGRST116") {
            setError("Game not found");
          } else {
            setError("Failed to load game. Please try again.");
          }
          setLoading(false);
          return;
        }

        if (!data?.id) {
          setError("Game not found");
          setLoading(false);
          return;
        }

        setGameId(data.id);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        console.error("Exception in loadGame:", err);
        setError("An unexpected error occurred. Please refresh the page.");
        setLoading(false);
      }
    };

    loadGame();

    return () => {
      mounted = false;
    };
  }, [slug]);

  // ✅ État de chargement explicite
  if (loading) {
    return (
      <div style={{ padding: 30, textAlign: "center", color: "#ffffff" }}>
        Loading game...
      </div>
    );
  }

  // ✅ État d'erreur explicite
  if (error || !gameId) {
    return (
      <div style={{ padding: 30, textAlign: "center" }}>
        <p style={{ color: "#f87171", marginBottom: "16px" }}>
          {error || "Game not found"}
        </p>
        <button
          onClick={() => router.push("/feed")}
          style={{
            padding: "8px 16px",
            background: "rgba(30, 30, 30, 0.8)",
            border: "1px solid rgba(100, 100, 100, 0.3)",
            borderRadius: "6px",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          Back to Feed
        </button>
      </div>
    );
  }

  return <FeedView forcedGameId={gameId} />;
}
