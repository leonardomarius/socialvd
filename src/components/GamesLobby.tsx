"use client";

import { useState } from "react";
import Link from "next/link";

/* =====================
   TYPES
===================== */

export type GameStatus = "open" | "locked" | "full" | "running";

export type GameType = "Battle Royale" | "Team Match" | "Ranked" | "Tournament";

export type Game = {
  id: string;
  game: string; // "CS2", "Apex Legends", etc.
  format: string; // "5v5", "Trio", etc.
  level: string; // "Gold+", "Plat+", etc.
  buyIn: number; // 0.25, 0.50, 1.00, 2.00
  players: {
    current: number;
    max: number;
  };
  startTime: string; // "20:30", "21:00", etc.
  prizePool: number; // Total prize pool in euros
  type: GameType;
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

  // Mock games data
  const [games] = useState<Game[]>([
    {
      id: "1",
      game: "Apex Legends",
      format: "Trio",
      level: "Plat+",
      buyIn: 1.0,
      players: { current: 52, max: 60 },
      startTime: "21:00",
      prizePool: 100,
      type: "Battle Royale",
      status: "open",
    },
    {
      id: "2",
      game: "CS2",
      format: "5v5",
      level: "Gold+",
      buyIn: 0.5,
      players: { current: 8, max: 10 },
      startTime: "20:30",
      prizePool: 50,
      type: "Team Match",
      status: "open",
    },
    {
      id: "3",
      game: "Apex Legends",
      format: "Solo",
      level: "Diamond+",
      buyIn: 2.0,
      players: { current: 60, max: 60 },
      startTime: "22:00",
      prizePool: 200,
      type: "Battle Royale",
      status: "full",
    },
    {
      id: "4",
      game: "CS2",
      format: "5v5",
      level: "Plat+",
      buyIn: 1.0,
      players: { current: 10, max: 10 },
      startTime: "19:00",
      prizePool: 100,
      type: "Ranked",
      status: "locked",
    },
    {
      id: "5",
      game: "Apex Legends",
      format: "Duo",
      level: "Gold+",
      buyIn: 0.25,
      players: { current: 38, max: 40 },
      startTime: "21:30",
      prizePool: 25,
      type: "Battle Royale",
      status: "open",
    },
  ]);

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
          {games.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No games available</div>
              <div className="empty-state-text">
                Games will appear here once the system is connected.
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
                {games.map((game) => (
                  <tr
                    key={game.id}
                    className="game-row-clickable"
                    onClick={() => {
                      window.location.href = `/feed/${game.id}`;
                    }}
                  >
                    <td>
                      <Link
                        href={`/feed/${game.id}`}
                        className="game-name-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="game-name">{game.game}</span>
                      </Link>
                    </td>
                    <td>
                      <span className="game-format">{game.format}</span>
                    </td>
                    <td>
                      <span className="game-level">{game.level}</span>
                    </td>
                    <td>
                      <span className="game-buyin">{game.buyIn.toFixed(2)} €</span>
                    </td>
                    <td>
                      <span className="game-players">
                        {game.players.current} / {game.players.max}
                      </span>
                    </td>
                    <td>
                      <span className="game-start-time">{game.startTime}</span>
                    </td>
                    <td>
                      <span className="game-prizepool">{game.prizePool} €</span>
                    </td>
                    <td>
                      <span className="game-type">{game.type}</span>
                    </td>
                    <td>
                      <span className={`game-status ${game.status}`}>
                        {game.status}
                      </span>
                    </td>
                    <td className="game-action" onClick={(e) => e.stopPropagation()}>
                      {game.status === "open" ? (
                        <Link href={`/feed/${game.id}`}>
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
