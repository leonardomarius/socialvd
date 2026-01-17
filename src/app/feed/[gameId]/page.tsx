"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { Game, GameStatus, GameType } from "@/components/GamesLobby";

/* =====================
   TYPES
===================== */

type Player = {
  id: string;
  pseudo: string;
  level: string;
  status: "ready" | "pending";
  rank?: number;
};

type GameDetails = Game & {
  description?: string;
  playersList: Player[];
};

/* =====================
   MOCK DATA
===================== */

const mockGames: Record<string, GameDetails> = {
  "1": {
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
    description: "Compete in a high-stakes Battle Royale match. Last team standing wins the prize pool.",
    playersList: [
      { id: "p1", pseudo: "PlayerOne", level: "Plat", status: "ready", rank: 1 },
      { id: "p2", pseudo: "PlayerTwo", level: "Diamond", status: "ready", rank: 2 },
      { id: "p3", pseudo: "PlayerThree", level: "Plat", status: "ready", rank: 3 },
      { id: "p4", pseudo: "PlayerFour", level: "Gold", status: "pending", rank: 4 },
      { id: "p5", pseudo: "PlayerFive", level: "Plat", status: "ready", rank: 5 },
      { id: "p6", pseudo: "PlayerSix", level: "Diamond", status: "ready", rank: 6 },
      { id: "p7", pseudo: "PlayerSeven", level: "Plat", status: "ready", rank: 7 },
      { id: "p8", pseudo: "PlayerEight", level: "Gold", status: "pending", rank: 8 },
    ],
  },
  "2": {
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
    description: "Classic 5v5 competitive match. Best of 16 rounds wins.",
    playersList: [
      { id: "p1", pseudo: "CSPlayer1", level: "Gold", status: "ready", rank: 1 },
      { id: "p2", pseudo: "CSPlayer2", level: "Plat", status: "ready", rank: 2 },
      { id: "p3", pseudo: "CSPlayer3", level: "Gold", status: "ready", rank: 3 },
      { id: "p4", pseudo: "CSPlayer4", level: "Gold", status: "pending", rank: 4 },
      { id: "p5", pseudo: "CSPlayer5", level: "Plat", status: "ready", rank: 5 },
      { id: "p6", pseudo: "CSPlayer6", level: "Gold", status: "ready", rank: 6 },
      { id: "p7", pseudo: "CSPlayer7", level: "Gold", status: "ready", rank: 7 },
      { id: "p8", pseudo: "CSPlayer8", level: "Plat", status: "ready", rank: 8 },
    ],
  },
  "3": {
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
    description: "Solo Battle Royale tournament. Only the best survive.",
    playersList: Array.from({ length: 60 }, (_, i) => ({
      id: `p${i + 1}`,
      pseudo: `Player${i + 1}`,
      level: i < 20 ? "Diamond" : i < 40 ? "Plat" : "Gold",
      status: i < 50 ? "ready" : "pending",
      rank: i + 1,
    })),
  },
  "4": {
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
    description: "Ranked competitive match. Teams are locked and ready.",
    playersList: [
      { id: "p1", pseudo: "RankedPlayer1", level: "Plat", status: "ready", rank: 1 },
      { id: "p2", pseudo: "RankedPlayer2", level: "Diamond", status: "ready", rank: 2 },
      { id: "p3", pseudo: "RankedPlayer3", level: "Plat", status: "ready", rank: 3 },
      { id: "p4", pseudo: "RankedPlayer4", level: "Plat", status: "ready", rank: 4 },
      { id: "p5", pseudo: "RankedPlayer5", level: "Diamond", status: "ready", rank: 5 },
      { id: "p6", pseudo: "RankedPlayer6", level: "Plat", status: "ready", rank: 6 },
      { id: "p7", pseudo: "RankedPlayer7", level: "Plat", status: "ready", rank: 7 },
      { id: "p8", pseudo: "RankedPlayer8", level: "Diamond", status: "ready", rank: 8 },
      { id: "p9", pseudo: "RankedPlayer9", level: "Plat", status: "ready", rank: 9 },
      { id: "p10", pseudo: "RankedPlayer10", level: "Plat", status: "ready", rank: 10 },
    ],
  },
  "5": {
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
    description: "Duo Battle Royale. Team up and dominate the arena.",
    playersList: [
      { id: "p1", pseudo: "DuoPlayer1", level: "Gold", status: "ready", rank: 1 },
      { id: "p2", pseudo: "DuoPlayer2", level: "Plat", status: "ready", rank: 2 },
      { id: "p3", pseudo: "DuoPlayer3", level: "Gold", status: "ready", rank: 3 },
      { id: "p4", pseudo: "DuoPlayer4", level: "Gold", status: "pending", rank: 4 },
      { id: "p5", pseudo: "DuoPlayer5", level: "Plat", status: "ready", rank: 5 },
      { id: "p6", pseudo: "DuoPlayer6", level: "Gold", status: "ready", rank: 6 },
      { id: "p7", pseudo: "DuoPlayer7", level: "Gold", status: "ready", rank: 7 },
      { id: "p8", pseudo: "DuoPlayer8", level: "Plat", status: "pending", rank: 8 },
    ],
  },
};

/* =====================
   COMPONENT
===================== */

export default function GameDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params?.gameId as string;

  const [game, setGame] = useState<GameDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    // Simulate loading
    setTimeout(() => {
      const foundGame = mockGames[gameId];
      if (foundGame) {
        setGame(foundGame);
      }
      setLoading(false);
    }, 300);
  }, [gameId]);

  if (loading) {
    return (
      <div className="game-details-container">
        <div className="game-details-loading">Loading game details...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="game-details-container">
        <div className="game-details-error">
          <h2>Game not found</h2>
          <Link href="/feed" className="btn primary-btn">
            Back to Lobby
          </Link>
        </div>
      </div>
    );
  }

  const canJoin = game.status === "open" && game.players.current < game.players.max;

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
          <h1 className="game-details-title">{game.game}</h1>
          <div className="game-details-header-meta">
            <span className="game-details-format">{game.format}</span>
            <span className="game-details-separator">•</span>
            <span className="game-details-level">{game.level}</span>
            <span className="game-details-separator">•</span>
            <span className="game-details-type">{game.type}</span>
          </div>
        </div>
        <div className="game-details-header-status">
          <span className={`game-status ${game.status}`}>{game.status}</span>
        </div>
      </div>

      {/* Key Info Blocks */}
      <div className="game-details-info-grid">
        <div className="game-info-block">
          <div className="game-info-label">Buy-in</div>
          <div className="game-info-value">{game.buyIn.toFixed(2)} €</div>
        </div>
        <div className="game-info-block">
          <div className="game-info-label">Players</div>
          <div className="game-info-value">
            {game.players.current} / {game.players.max}
          </div>
        </div>
        <div className="game-info-block">
          <div className="game-info-label">Prize Pool</div>
          <div className="game-info-value prize-pool">{game.prizePool} €</div>
        </div>
        <div className="game-info-block">
          <div className="game-info-label">Start Time</div>
          <div className="game-info-value">{game.startTime}</div>
        </div>
        <div className="game-info-block">
          <div className="game-info-label">Type</div>
          <div className="game-info-value">{game.type}</div>
        </div>
        <div className="game-info-block">
          <div className="game-info-label">Level Required</div>
          <div className="game-info-value">{game.level}</div>
        </div>
      </div>

      {/* Description */}
      {game.description && (
        <div className="game-details-description">
          <h3>About this match</h3>
          <p>{game.description}</p>
        </div>
      )}

      {/* Players List */}
      <div className="game-details-players">
        <h2 className="game-details-section-title">
          Players ({game.playersList.length})
        </h2>
        <div className="players-table-wrapper">
          <table className="players-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Joueur</th>
                <th>Niveau</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {game.playersList.map((player) => (
                <tr key={player.id}>
                  <td className="player-rank">{player.rank}</td>
                  <td className="player-pseudo">{player.pseudo}</td>
                  <td className="player-level">{player.level}</td>
                  <td>
                    <span
                      className={`player-status ${player.status}`}
                    >
                      {player.status === "ready" ? "Ready" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Button */}
      <div className="game-details-action">
        {canJoin ? (
          <button className="btn-join-game">Join Game</button>
        ) : (
          <button className="btn-join-game" disabled>
            {game.status === "full"
              ? "Game Full"
              : game.status === "locked"
              ? "Game Locked"
              : "Cannot Join"}
          </button>
        )}
      </div>
    </div>
  );
}
