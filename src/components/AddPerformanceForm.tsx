"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AddPerformanceForm({ userId, onAdded }: { 
  userId: string; 
  onAdded?: () => void;
}) {
  const [gameName, setGameName] = useState("");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("game_performances").insert({
      user_id: userId,
      game_name: gameName,
      performance_title: title,
      performance_value: value,
    });

    setLoading(false);

    if (!error) {
      setSuccess(true);
      setGameName("");
      setTitle("");
      setValue("");

      if (onAdded) onAdded();
    }
  };

  return (
    <div style={{
      marginTop: "20px",
      padding: "16px",
      borderRadius: "8px",
      background: "rgba(0, 0, 0, 0.4)",
      border: "1px solid rgba(255,255,255,0.1)"
    }}>
      <h3 style={{ marginBottom: "12px" }}>Add a performance</h3>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "10px" }}>
          <label>Game</label>
          <input
            type="text"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              marginTop: "4px"
            }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Performance</label>
          <input
            type="text"
            placeholder="e.g. Finished 4 times at 100%"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              marginTop: "4px"
            }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Details (optional)</label>
          <input
            type="text"
            placeholder="e.g. 100%, PSN Platinum, etc."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              marginTop: "4px"
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "12px",
            padding: "10px 20px",
            borderRadius: "6px",
            background: "#000",
            color: "#fff",
            cursor: "pointer",
            width: "100%"
          }}
        >
          {loading ? "Adding..." : "Add"}
        </button>

        {success && (
          <p style={{ marginTop: "10px", color: "lightgreen" }}>
            Performance added!
          </p>
        )}
      </form>
    </div>
  );
}
