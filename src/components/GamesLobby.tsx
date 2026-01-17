"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/* =====================
   TYPES
===================== */

export type GameStatus = "open" | "locked" | "full" | "running";

export type Match = {
  id: string;
  game_name: string; // From games.name
  format: string;
  level_min: string | null;
  level_max: string | null;
  buy_in: number;
  players_current: number; // Calculated from game_participants
  max_players: number;
  start_time: string;
  prize_pool: number;
  match_type: string;
  status: GameStatus;
};

/* =====================
   FILTER TYPES
===================== */

type BuyInFilter = {
  "0.25": boolean;
  "0.50": boolean;
  "1.00": boolean;
  "2.00": boolean;
};

type GameFilter = {
  all: boolean;
  cs2: boolean;
  apex: boolean;
};

/* =====================
   COMPONENT
===================== */

export default function GamesLobby() {
  // Filters state
  const [buyInFilters, setBuyInFilters] = useState<BuyInFilter>({
    "0.25": false,
    "0.50": false,
    "1.00": false,
    "2.00": false,
  });

  const [gameFilters, setGameFilters] = useState<GameFilter>({
    all: true,
    cs2: false,
    apex: false,
  });

  // Matches state
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* =====================
     LOAD MATCHES FROM SUPABASE
  ===================== */

  useEffect(() => {
    let mounted = true;

    const loadMatches = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Load matches with game names
        const { data: matchesData, error: matchesError } = await supabase
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
          .order("start_time", { ascending: true });

        if (!mounted) return;

        if (matchesError) {
          console.error("Error loading matches:", matchesError);
          console.error("Error details:", {
            message: matchesError.message,
            details: matchesError.details,
            hint: matchesError.hint,
            code: matchesError.code,
          });
          setError(`Failed to load matches: ${matchesError.message || "Unknown error"}`);
          setMatches([]);
          setLoading(false);
          return;
        }

        if (!matchesData || matchesData.length === 0) {
          setMatches([]);
          setLoading(false);
          return;
        }

        // 2. For each match, count participants
        const matchesWithCounts = await Promise.all(
          matchesData.map(async (match: any) => {
            const { count, error: countError } = await supabase
              .from("game_participants")
              .select("*", { count: "exact", head: true })
              .eq("match_id", match.id);

            if (countError) {
              console.error(`Error counting participants for match ${match.id}:`, countError);
              return null;
            }

            // Format level display
            const levelDisplay =
              match.level_min && match.level_max
                ? `${match.level_min}+`
                : match.level_min
                ? `${match.level_min}+`
                : match.level_max
                ? `≤${match.level_max}`
                : "Any";

            // Format start time (HH:MM from ISO string)
            const startDate = match.start_time ? new Date(match.start_time) : null;
            const startTimeFormatted = startDate
              ? `${startDate.getHours().toString().padStart(2, "0")}:${startDate.getMinutes().toString().padStart(2, "0")}`
              : "—";

            return {
              id: match.id,
              game_name: match.games?.name || "Unknown Game",
              format: match.format || "—",
              level_min: match.level_min,
              level_max: match.level_max,
              level_display: levelDisplay,
              buy_in: match.buy_in || 0,
              players_current: count || 0,
              max_players: match.max_players || 0,
              start_time: match.start_time,
              start_time_formatted: startTimeFormatted,
              prize_pool: match.prize_pool || 0,
              match_type: match.match_type || "—",
              status: (match.status as GameStatus) || "open",
            };
          })
        );

        if (!mounted) return;

        // Filter out null results
        const validMatches = matchesWithCounts.filter((m): m is Match & { level_display: string; start_time_formatted: string } => m !== null);

        setMatches(validMatches as any);
      } catch (err) {
        console.error("Unexpected error loading matches:", err);
        if (mounted) {
          setError("An unexpected error occurred. Please refresh the page.");
          setMatches([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadMatches();

    return () => {
      mounted = false;
    };
  }, []);

  /* =====================
     FILTER HANDLERS
  ===================== */

  const toggleBuyInFilter = (key: keyof BuyInFilter) => {
    setBuyInFilters((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleGameFilter = (key: keyof GameFilter) => {
    if (key === "all") {
      // If "All Games" is clicked, set it to true and others to false
      setGameFilters({
        all: true,
        cs2: false,
        apex: false,
      });
    } else {
      // If a specific game is clicked, uncheck "all" and toggle the specific game
      setGameFilters((prev) => ({
        ...prev,
        all: false,
        [key]: !prev[key],
      }));
    }
  };

  /* =====================
     RENDER
  ===================== */

  return (
    <div className="games-lobby-container">

      {/* Sidebar */}
      <aside className="games-lobby-sidebar">
        {/* Buy-in Filters */}
        <div className="filter-section">
          <h3 className="filter-section-title">Buy-in</h3>
          <div className="filter-checkbox-group">
            {(["0.25", "0.50", "1.00", "2.00"] as const).map((amount) => (
              <label key={amount} className="filter-checkbox-item">
                <input
                  type="checkbox"
                  className="filter-checkbox"
                  checked={buyInFilters[amount]}
                  onChange={() => toggleBuyInFilter(amount)}
                />
                <span className="filter-checkbox-label">{amount} €</span>
              </label>
            ))}
          </div>
        </div>

        {/* Game Filters */}
        <div className="filter-section">
          <h3 className="filter-section-title">Jeux</h3>
          <div className="filter-checkbox-group">
            <label className="filter-checkbox-item">
              <input
                type="checkbox"
                className="filter-checkbox"
                checked={gameFilters.all}
                onChange={() => toggleGameFilter("all")}
              />
              <span className="filter-checkbox-label">All Games</span>
            </label>
            <label className="filter-checkbox-item">
              <input
                type="checkbox"
                className="filter-checkbox"
                checked={gameFilters.cs2}
                onChange={() => toggleGameFilter("cs2")}
              />
              <span className="filter-checkbox-label">CS2</span>
            </label>
            <label className="filter-checkbox-item">
              <input
                type="checkbox"
                className="filter-checkbox"
                checked={gameFilters.apex}
                onChange={() => toggleGameFilter("apex")}
              />
              <span className="filter-checkbox-label">Apex Legends</span>
            </label>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="games-lobby-main">
        <div className="games-lobby-header">
          <h1 className="games-lobby-title">Available Games</h1>
          <p className="games-lobby-subtitle">
            Join competitive matches with real stakes
          </p>
        </div>

        <div className="games-table-wrapper">
          {loading ? (
            <div className="empty-state">
              <div className="empty-state-title">Loading matches...</div>
            </div>
          ) : error ? (
            <div className="empty-state">
              <div className="empty-state-title" style={{ color: "#f87171" }}>
                {error}
              </div>
            </div>
          ) : matches.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No matches available</div>
              <div className="empty-state-text">
                No matches are currently scheduled. Check back later.
              </div>
            </div>
          ) : (
            <table className="games-table">
              <thead>
                <tr>
                  <th>Jeu</th>
                  <th>Format</th>
                  <th>Niveau</th>
                  <th>Buy-in</th>
                  <th>Joueurs</th>
                  <th>Début</th>
                  <th>Prize Pool</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr
                    key={match.id}
                    className="game-row-clickable"
                    onClick={() => {
                      window.location.href = `/matches/${match.id}`;
                    }}
                  >
                    <td>
                      <Link
                        href={`/matches/${match.id}`}
                        className="game-name-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="game-name">{match.game_name}</span>
                      </Link>
                    </td>
                    <td>
                      <span className="game-format">{match.format}</span>
                    </td>
                    <td>
                      <span className="game-level">{(match as any).level_display || "—"}</span>
                    </td>
                    <td>
                      <span className="game-buyin">{match.buy_in.toFixed(2)} €</span>
                    </td>
                    <td>
                      <span className="game-players">
                        {match.players_current} / {match.max_players}
                      </span>
                    </td>
                    <td>
                      <span className="game-start-time">{(match as any).start_time_formatted || "—"}</span>
                    </td>
                    <td>
                      <span className="game-prizepool">{match.prize_pool} €</span>
                    </td>
                    <td>
                      <span className="game-type">{match.match_type}</span>
                    </td>
                    <td>
                      <span className={`game-status ${match.status}`}>
                        {match.status}
                      </span>
                    </td>
                    <td className="game-action" onClick={(e) => e.stopPropagation()}>
                      {match.status === "open" ? (
                        <Link href={`/matches/${match.id}`}>
                          <button className="btn-join">Join</button>
                        </Link>
                      ) : (
                        <span style={{ color: "rgba(255, 255, 255, 0.3)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
