"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProfilePerformances({ userId }: { userId: string }) {
  const [performances, setPerformances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPerf() {
      const { data, error } = await supabase
        .from("game_performances")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error) setPerformances(data);
      setLoading(false);
    }

    fetchPerf();
  }, [userId]);

  if (loading) return <p>Chargement...</p>;

  if (performances.length === 0) {
    return <p>Aucune performance pour le moment.</p>;
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>
        Performances vérifiables
      </h2>

      {performances.map((p) => (
        <div
          key={p.id}
          style={{
            padding: "12px",
            marginBottom: "10px",
            background: "rgba(0,0,0,0.4)",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.1)"
          }}
        >
          <strong>{p.game_name}</strong>
          <p style={{ marginTop: "4px" }}>{p.performance_title}</p>
          {p.performance_value && (
            <p style={{ opacity: 0.7 }}>{p.performance_value}</p>
          )}
        </div>
      ))}
    </div>
  );
}
