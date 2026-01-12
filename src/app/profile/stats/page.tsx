"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type GameOption = {
  id: string;
  name: string;
  available: boolean;
};

const gameOptions: GameOption[] = [
  { id: "cs2", name: "Counter-Strike 2", available: true },
  { id: "lol", name: "League of Legends", available: false },
  { id: "apex", name: "Apex Legends", available: false },
  { id: "r6", name: "Rainbow Six Siege", available: false },
  { id: "planetside2", name: "Planetside 2", available: false },
  { id: "valorant", name: "Valorant", available: false },
];

export default function StatsHubPage() {
  const router = useRouter();

  const handleConnectSteam = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      alert("Please log in to connect your Steam account.");
      return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const url = `${supabaseUrl}/functions/v1/steam-link-start?access_token=${session.access_token}`;
    window.location.href = url;
  };

  const handleGameSelection = (game: GameOption) => {
    if (game.id === "cs2" && game.available) {
      handleConnectSteam();
    } else {
      alert("Our developers are currently adding game APIs one by one. Only CS2 stats are available at the moment.");
    }
  };

  return (
    <div
      style={{
        padding: "30px",
        maxWidth: "900px",
        margin: "0 auto",
        color: "white",
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Game stats</h1>
      <p style={{ fontSize: 16, opacity: 0.7, marginBottom: 40 }}>
        Connect your game accounts to import verified stats.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        {gameOptions.map((game) => (
          <div
            key={game.id}
            onClick={() => handleGameSelection(game)}
            style={{
              padding: "24px",
              background: game.available
                ? "linear-gradient(135deg, rgba(12,12,22,0.95), rgba(8,8,14,0.98))"
                : "linear-gradient(135deg, rgba(12,12,22,0.85), rgba(8,8,14,0.9))",
              border: game.available
                ? "1px solid rgba(80,120,255,0.4)"
                : "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              cursor: "pointer",
              transition: "all 0.2s ease",
              opacity: game.available ? 1 : 0.7,
              boxShadow: game.available
                ? "0 0 20px rgba(80,120,255,0.2)"
                : "0 0 10px rgba(0,0,0,0.3)",
            }}
            onMouseEnter={(e) => {
              if (game.available) {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(12,12,22,1), rgba(8,8,14,1))";
                e.currentTarget.style.borderColor = "rgba(80,120,255,0.6)";
                e.currentTarget.style.boxShadow = "0 0 30px rgba(80,120,255,0.3)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (game.available) {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(12,12,22,0.95), rgba(8,8,14,0.98))";
                e.currentTarget.style.borderColor = "rgba(80,120,255,0.4)";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(80,120,255,0.2)";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  margin: 0,
                  color: "white",
                }}
              >
                {game.name}
              </h3>
              {game.available && (
                <span
                  style={{
                    fontSize: 12,
                    color: "rgba(80, 200, 120, 0.9)",
                    fontWeight: 600,
                    padding: "4px 10px",
                    background: "rgba(80, 200, 120, 0.1)",
                    borderRadius: 6,
                    border: "1px solid rgba(80, 200, 120, 0.3)",
                  }}
                >
                  SUPPORTED
                </span>
              )}
              {!game.available && (
                <span
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.4)",
                    fontWeight: 600,
                    padding: "4px 10px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  COMING SOON
                </span>
              )}
            </div>
            {game.available && (
              <p
                style={{
                  fontSize: 14,
                  opacity: 0.7,
                  margin: 0,
                  marginTop: 8,
                }}
              >
                Click to connect via Steam
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
