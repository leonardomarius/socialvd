"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isCS2Performance } from "@/lib/cs2-utils";

type Performance = {
  id: string;
  user_id: string;
  game_name: string;
  performance_title: string;
  performance_value: string | null;
};

export default function ProfilePerformances({
  userId,
  myId,
}: {
  userId: string;
  myId?: string | null;
}) {
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGameName, setEditGameName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // -----------------------------------------
  // Load the first 4 performances
  // -----------------------------------------
  useEffect(() => {
    fetchPerf();
  }, [userId]);

  async function fetchPerf() {
    const { data } = await supabase
      .from("game_performances")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(4);

    setPerformances((data || []) as Performance[]);
    setLoading(false);
  }

  // -----------------------------------------
  // Delete performance (only if own profile)
  // -----------------------------------------
  async function deletePerformance(id: string) {
    if (!myId || myId !== userId) return;

    const perf = performances.find((p) => p.id === id);
    if (perf && isCS2Performance(perf.game_name)) {
      alert("CS2 performances are read-only and cannot be deleted manually.");
      return;
    }

    const confirmDelete = window.confirm("Supprimer cette performance ?");
    if (!confirmDelete) return;

    await supabase
      .from("game_performances")
      .delete()
      .eq("id", id)
      .eq("user_id", myId);

    fetchPerf();
  }

  // -----------------------------------------
  // Edit
  // -----------------------------------------
  function startEdit(p: Performance) {
    // CS2 performances are read-only
    if (isCS2Performance(p.game_name)) {
      alert("CS2 performances are read-only and synced from Steam.");
      return;
    }

    setEditingId(p.id);
    setEditGameName(p.game_name);
    setEditTitle(p.performance_title);
    setEditValue(p.performance_value || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setSavingEdit(false);
  }

  async function saveEdit() {
    if (!editingId || !myId || myId !== userId) return;

    // CS2 performances are read-only
    if (isCS2Performance(editGameName)) {
      alert("CS2 performances are read-only and cannot be edited manually.");
      setSavingEdit(false);
      setEditingId(null);
      return;
    }

    setSavingEdit(true);

    await supabase
      .from("game_performances")
      .update({
        game_name: editGameName,
        performance_title: editTitle,
        performance_value: editValue,
      })
      .eq("id", editingId)
      .eq("user_id", myId);

    setSavingEdit(false);
    setEditingId(null);
    fetchPerf();
  }

  // -----------------------------------------
  // Animation fade
  // -----------------------------------------
  useEffect(() => {
    if (typeof document !== "undefined") {
      const st = document.createElement("style");
      st.innerHTML = `
        @keyframes fadeInPerf {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(st);
      return () => {
        try {
          document.head.removeChild(st);
        } catch {}
      };
    }
  }, []);

  if (loading) return <p>Chargement...</p>;
  if (performances.length === 0)
    return <p>Aucune performance ajoutée pour le moment.</p>;

  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
      {performances.map((p) => {
        const isEditing = editingId === p.id;

        return (
          <div
            key={p.id}
            style={{
              padding: "20px",
              borderRadius: "14px",
              background:
                "linear-gradient(135deg, rgba(12,12,20,0.90), rgba(8,8,12,0.97))",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 0 18px rgba(0,0,0,0.45)",
              transition: "all 0.25s",
              animation: "fadeInPerf 0.35s ease",
            }}
          >
            {/* --- MODE LECTURE --- */}
            {!isEditing && (
              <>
                <strong
                  style={{
                    fontSize: 18,
                    marginBottom: 6,
                    display: "block",
                    color: "rgba(255,255,255,0.95)",
                  }}
                >
                  {p.game_name}
                </strong>

                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)" }}>
                  {p.performance_title}
                </p>

                {p.performance_value && (
                  <p style={{ fontSize: 14, opacity: 0.6 }}>
                    {p.performance_value}
                  </p>
                )}

                {/* Action buttons - Hidden for CS2 (read-only) */}
                {myId === userId && !isCS2Performance(p.game_name) && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => startEdit(p)} style={btnEdit}>
                      ✏
                    </button>
                    <button onClick={() => deletePerformance(p.id)} style={btnDelete}>
                      🗑
                    </button>
                  </div>
                )}
                {/* CS2 badge for read-only performances */}
                {isCS2Performance(p.game_name) && (
                  <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6, fontStyle: "italic" }}>
                    Synced from Steam
                  </div>
                )}
              </>
            )}

            {/* --- MODE ÉDITION --- */}
            {isEditing && (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 12 }}>Jeu</label>
                <input
                  type="text"
                  value={editGameName}
                  onChange={(e) => setEditGameName(e.target.value)}
                  style={inputField}
                />

                <label style={{ fontSize: 12 }}>Performance</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={inputField}
                />

                <label style={{ fontSize: 12 }}>Détail (optionnel)</label>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  style={inputField}
                />

                <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                  <button onClick={saveEdit} disabled={savingEdit} style={btnSave}>
                    {savingEdit ? "…" : "✔ Enregistrer"}
                  </button>

                  <button onClick={cancelEdit} style={btnCancel}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* -----------------------------------------
   STYLES
------------------------------------------ */

const inputField: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "10px",
  borderRadius: 10,
  background: "rgba(35,40,60,0.55)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
  marginBottom: 12,
};

const btnEdit: React.CSSProperties = {
  padding: "6px 10px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  cursor: "pointer",
  color: "white",
};

const btnDelete: React.CSSProperties = {
  padding: "6px 10px",
  background: "rgba(160,0,30,0.85)",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.15)",
  cursor: "pointer",
  color: "white",
};

const btnSave: React.CSSProperties = {
  padding: "8px 14px",
  background: "rgba(70,100,255,0.85)",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  color: "white",
};

const btnCancel: React.CSSProperties = {
  padding: "8px 14px",
  background: "rgba(90,90,90,0.25)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  cursor: "pointer",
  color: "white",
};
