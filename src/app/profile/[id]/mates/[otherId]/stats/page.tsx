"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function MateStatsPage() {
  const params = useParams();
  const myId = params.id as string;
  const otherId = params.otherId as string;

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [gamesStats, setGamesStats] = useState<
    { game: string; totalSeconds: number }[]
  >([]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);

    const { data, error } = await supabase
      .from("mate_sessions")
      .select("*")
      .or(
        `and(user1_id.eq.${myId},user2_id.eq.${otherId}),and(user1_id.eq.${otherId},user2_id.eq.${myId})`
      )
      .eq("status", "ended")
      .order("ended_at", { ascending: false });

    if (!data) {
      setLoading(false);
      return;
    }

    setSessions(data);

    // Total time
    const total = data.reduce(
      (acc: number, s: any) => acc + (s.duration_seconds || 0),
      0
    );
    setTotalSeconds(total);

    // Stats by game
    const byGame: { [key: string]: number } = {};
    data.forEach((s) => {
      const g = s.game || "Non spécifié";
      if (!byGame[g]) byGame[g] = 0;
      byGame[g] += s.duration_seconds || 0;
    });

    const gameList = Object.entries(byGame).map(([game, totalSeconds]) => ({
      game,
      totalSeconds,
    }));

    setGamesStats(gameList);

    setLoading(false);
  }

  // Helper
  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}min`;
  }

  if (loading) {
    return <p style={{ padding: 20 }}>Chargement...</p>;
  }

  return (
    <div style={{ maxWidth: 750, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>
        Statistiques avec ce mate 
      </h1>

      {/* ─────────── TOTAL TIME CARD ─────────── */}
      <div
        style={{
          background: "#111",
          padding: 16,
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <h2 style={{ marginBottom: 8 }}>Temps total joué ensemble</h2>
        <p style={{ fontSize: 22, fontWeight: "bold", color: "white" }}>
          {formatTime(totalSeconds)}
        </p>
      </div>

      {/* ─────────── GAME STATS ─────────── */}
      <div
        style={{
          background: "#111",
          padding: 16,
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <h2 style={{ marginBottom: 10 }}>Temps par jeu</h2>

        {gamesStats.length === 0 ? (
          <p style={{ color: "#888" }}>Aucune session enregistrée.</p>
        ) : (
          gamesStats.map((g) => (
            <div
              key={g.game}
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                paddingBottom: 6,
                borderBottom: "1px solid #222",
              }}
            >
              <span>{g.game}</span>
              <span style={{ fontWeight: "bold" }}>
                {formatTime(g.totalSeconds)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ─────────── SESSION LIST ─────────── */}
      <div
        style={{
          background: "#111",
          padding: 16,
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <h2 style={{ marginBottom: 10 }}>Sessions terminées</h2>

        {sessions.length === 0 ? (
          <p style={{ color: "#888" }}>Aucune session pour l’instant.</p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              style={{
                marginBottom: 14,
                padding: 10,
                background: "#181818",
                borderRadius: 6,
              }}
            >
              <p>
                <b>Jeu : </b>
                {s.game || "Non spécifié"}
              </p>
              <p>
                <b>Durée : </b> {formatTime(s.duration_seconds)}
              </p>
              <p style={{ fontSize: 12, color: "#888" }}>
                {s.ended_at
                  ? "Session du " +
                    new Date(s.ended_at).toLocaleDateString() +
                    " à " +
                    new Date(s.ended_at).toLocaleTimeString()
                  : ""}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
