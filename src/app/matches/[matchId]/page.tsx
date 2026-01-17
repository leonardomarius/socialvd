"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/* =====================
   TYPES
===================== */

type Player = {
  id: string;
  user_id: string;
  pseudo: string | null;
  status: "ready" | "pending";
  created_at: string;
};

type MatchDetails = {
  id: string;
  game_name: string;
  format: string;
  level_min: string | null;
  level_max: string | null;
  level_display: string;
  buy_in: number;
  players_current: number;
  max_players: number;
  start_time: string;
  start_time_formatted: string;
  prize_pool: number;
  match_type: string;
  status: string;
  description?: string;
  players: Player[];
};

/* =====================
   COMPONENT
===================== */

export default function MatchDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params?.matchId as string;

  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) {
      setError("Invalid match ID");
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadMatch = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Load match with game name
        const { data: matchData, error: matchError } = await supabase
          .from("matches")
          .select(`
            id,
            format,
            level_min,
            level_max,
            buy_in,
            max_players,
            start_time,
            prize_pool,
            match_type,
            status,
            games (
              name
            )
          `)
          .eq("id", matchId)
          .single();

        if (!mounted) return;

        if (matchError || !matchData) {
          console.error("Error loading match:", matchError);
          setError("Match not found");
          setLoading(false);
          return;
        }

        // 2. Count participants
        const { count, error: countError } = await supabase
          .from("game_participants")
          .select("*", { count: "exact", head: true })
          .eq("match_id", matchId);

        if (countError) {
          console.error("Error counting participants:", countError);
        }

        const playersCount = count || 0;

        // 3. Load participants with user info
        const { data: participantsData, error: participantsError } = await supabase
          .from("game_participants")
          .select(`
            id,
            user_id,
            status,
            created_at,
            profiles (
              pseudo
            )
          `)
          .eq("match_id", matchId)
          .order("created_at", { ascending: true });

        if (participantsError) {
          console.error("Error loading participants:", participantsError);
        }

        // 4. Format level display
        const levelDisplay =
          matchData.level_min && matchData.level_max
            ? `${matchData.level_min}+`
            : matchData.level_min
            ? `${matchData.level_min}+`
            : matchData.level_max
            ? `≤${matchData.level_max}`
            : "Any";

        // 5. Format start time
        const startDate = matchData.start_time ? new Date(matchData.start_time) : null;
        const startTimeFormatted = startDate
          ? `${startDate.getHours().toString().padStart(2, "0")}:${startDate.getMinutes().toString().padStart(2, "0")}`
          : "—";

        // 6. Format participants
        const players: Player[] = (participantsData || []).map((p: any, index: number) => ({
          id: p.id,
          user_id: p.user_id,
          pseudo: p.profiles?.pseudo || `User ${index + 1}`,
          status: (p.status as "ready" | "pending") || "pending",
          created_at: p.created_at,
        }));

        if (!mounted) return;

        setMatch({
          id: matchData.id,
          game_name: (matchData.games as any)?.name || "Unknown Game",
          format: matchData.format || "—",
          level_min: matchData.level_min,
          level_max: matchData.level_max,
          level_display: levelDisplay,
          buy_in: matchData.buy_in || 0,
          players_current: playersCount,
          max_players: matchData.max_players || 0,
          start_time: matchData.start_time,
          start_time_formatted: startTimeFormatted,
          prize_pool: matchData.prize_pool || 0,
          match_type: matchData.match_type || "—",
          status: matchData.status || "open",
          players,
        });
      } catch (err) {
        console.error("Unexpected error loading match:", err);
        if (mounted) {
          setError("An unexpected error occurred. Please refresh the page.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadMatch();

    return () => {
      mounted = false;
    };
  }, [matchId]);

  if (loading) {
    return (
      <div className="game-details-container">
        <div className="game-details-loading">Loading match details...</div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="game-details-container">
        <div className="game-details-error">
          <h2>{error || "Match not found"}</h2>
          <Link href="/feed" className="btn primary-btn">
            Back to Lobby
          </Link>
        </div>
      </div>
    );
  }

  const canJoin = match.status === "open" && match.players_current < match.max_players;

  return (
    <div className="game-details-container">
      {/* Back button */}
      <div className="game-details-back">
        <Link href="/feed" className="game-details-back-link">
          ← Back to Lobby
        </Link>
      </div>

      {/* Header */}
      <div className="game-details-header">
        <div className="game-details-header-main">
          <h1 className="game-details-title">{match.game_name}</h1>
          <div className="game-details-header-meta">
            <span className="game-details-format">{match.format}</span>
            <span className="game-details-separator">•</span>
            <span className="game-details-level">{match.level_display}</span>
            <span className="game-details-separator">•</span>
            <span className="game-details-type">{match.match_type}</span>
          </div>
        </div>
        <div className="game-details-header-status">
          <span className={`game-status ${match.status}`}>{match.status}</span>
        </div>
      </div>

      {/* Key Info Blocks */}
      <div className="game-details-info-grid">
        <div className="game-info-block">
          <div className="game-info-label">Buy-in</div>
          <div className="game-info-value">{match.buy_in.toFixed(2)} €</div>
        </div>
        <div className="game-info-block">
          <div className="game-info-label">Players</div>
          <div className="game-info-value">
            {match.players_current} / {match.max_players}
          </div>
        </div>
        <div className="game-info-block">
          <div className="game-info-label">Prize Pool</div>
          <div className="game-info-value prize-pool">{match.prize_pool} €</div>
        </div>
        <div className="game-info-block">
          <div className="game-info-label">Start Time</div>
          <div className="game-info-value">{match.start_time_formatted}</div>
        </div>
        <div className="game-info-block">
          <div className="game-info-label">Type</div>
          <div className="game-info-value">{match.match_type}</div>
        </div>
        <div className="game-info-block">
          <div className="game-info-label">Level Required</div>
          <div className="game-info-value">{match.level_display}</div>
        </div>
      </div>

      {/* Players List */}
      <div className="game-details-players">
        <h2 className="game-details-section-title">
          Players ({match.players.length})
        </h2>
        {match.players.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No players registered</div>
            <div className="empty-state-text">
              Be the first to join this match!
            </div>
          </div>
        ) : (
          <div className="players-table-wrapper">
            <table className="players-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Joueur</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {match.players.map((player, index) => (
                  <tr key={player.id}>
                    <td className="player-rank">{index + 1}</td>
                    <td className="player-pseudo">{player.pseudo}</td>
                    <td>
                      <span className={`player-status ${player.status}`}>
                        {player.status === "ready" ? "Ready" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="game-details-action">
        {canJoin ? (
          <button className="btn-join-game">Join Game</button>
        ) : (
          <button className="btn-join-game" disabled>
            {match.status === "full"
              ? "Game Full"
              : match.status === "locked"
              ? "Game Locked"
              : "Cannot Join"}
          </button>
        )}
      </div>
    </div>
  );
}
