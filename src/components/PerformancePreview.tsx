"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Performance = {
  id: string;
  user_id: string;
  game_name: string;
  performance_title: string;
  performance_value: string | null;
  snapshot_at?: string;
};

type PerformancePreviewProps = {
  userId: string;
};

export default function PerformancePreview({ userId }: PerformancePreviewProps) {
  const router = useRouter();
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformances();
  }, [userId]);

  async function fetchPerformances() {
    try {
      setLoading(true);

      // Load verified CS2 performances from latest_game_performances_verified view
      const { data: verifiedData, error: verifiedError } = await supabase
        .from("latest_game_performances_verified")
        .select("*")
        .eq("user_id", userId);

      if (verifiedError) {
        console.error("Error loading verified performances:", verifiedError);
        setPerformances([]);
        setLoading(false);
        return;
      }

      // Get CS2 game_id
      const { data: cs2Game } = await supabase
        .from("games")
        .select("id, slug, name")
        .eq("slug", "cs2")
        .single();

      if (!cs2Game) {
        setPerformances([]);
        setLoading(false);
        return;
      }

      // Filter for CS2 only
      const cs2Performances = verifiedData?.filter(
        (row) => row.game_id === cs2Game.id
      ) || [];

      // Parse and format CS2 performances
      const formattedPerformances: Performance[] = [];

      for (const row of cs2Performances) {
        // Parse stats JSON
        let statsData: any = null;
        try {
          if (typeof row.stats === 'string') {
            statsData = JSON.parse(row.stats);
          } else {
            statsData = row.stats;
          }
        } catch (e) {
          console.warn("Failed to parse stats JSON:", e, row.stats);
          continue;
        }

        const gameName = cs2Game.name || cs2Game.slug || "CS2";

        // Handle different stats structures
        if (statsData && typeof statsData === 'object') {
          if (statsData.title && statsData.value !== undefined) {
            // Single performance object
            formattedPerformances.push({
              id: row.id || `verified-${row.user_id}-${row.game_id}`,
              user_id: row.user_id,
              game_name: gameName,
              performance_title: statsData.title,
              performance_value: statsData.value !== null ? String(statsData.value) : null,
              snapshot_at: row.snapshot_at,
            });
          } else if (Array.isArray(statsData)) {
            // Array of performance objects
            for (const stat of statsData) {
              if (stat && stat.title && stat.value !== undefined) {
                formattedPerformances.push({
                  id: `${row.id}-${stat.title}`,
                  user_id: row.user_id,
                  game_name: gameName,
                  performance_title: stat.title,
                  performance_value: stat.value !== null ? String(stat.value) : null,
                  snapshot_at: row.snapshot_at,
                });
              }
            }
          }
        }
      }

      // Sort by snapshot_at DESC (most recent first) as fallback
      // If no snapshot_at, keep original order
      const sorted = formattedPerformances.sort((a, b) => {
        if (a.snapshot_at && b.snapshot_at) {
          return new Date(b.snapshot_at).getTime() - new Date(a.snapshot_at).getTime();
        }
        return 0;
      });

      // Limit to 3 performances maximum
      setPerformances(sorted.slice(0, 3));
    } catch (error) {
      console.error("Error in fetchPerformances:", error);
      setPerformances([]);
    } finally {
      setLoading(false);
    }
  }

  const handlePerformanceClick = () => {
    router.push(`/profile/${userId}/performances`);
  };

  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.7 }}>
        Loading...
      </div>
    );
  }

  if (performances.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.7 }}>
        No performances yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
        marginTop: 0,
      }}
    >
        {performances.map((perf) => (
          <div
            key={perf.id}
            onClick={handlePerformanceClick}
            style={{
              padding: "20px",
              borderRadius: "14px",
              background:
                "linear-gradient(135deg, rgba(12,12,20,0.90), rgba(8,8,12,0.97))",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 0 18px rgba(0,0,0,0.45)",
              cursor: "pointer",
              transition: "all 0.25s ease",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 24px rgba(90,110,255,0.3)";
              e.currentTarget.style.borderColor = "rgba(250,204,21,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 0 18px rgba(0,0,0,0.45)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "rgba(80, 200, 120, 0.9)",
                fontWeight: 500,
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>✓</span>
              <span>CS2</span>
            </div>

            <strong
              style={{
                fontSize: 16,
                marginBottom: 6,
                display: "block",
                color: "rgba(255,255,255,0.95)",
              }}
            >
              {perf.performance_title}
            </strong>

            {perf.performance_value && (
              <p
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.75)",
                  margin: 0,
                }}
              >
                {perf.performance_value}
              </p>
            )}
          </div>
        ))}
    </div>
  );
}
