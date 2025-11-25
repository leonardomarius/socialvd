"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

  useEffect(() => {
    fetchPerf();
  }, [userId]);

  async function fetchPerf() {
    const { data } = await supabase
      .from("game_performances")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (data) setPerformances(data as Performance[]);
    setLoading(false);
  }

  async function deletePerformance(id: string) {
    const confirmDelete = window.confirm("Supprimer cette performance ?");
    if (!confirmDelete) return;

    await supabase
      .from("game_performances")
      .delete()
      .eq("id", id)
      .eq("user_id", myId);

    fetchPerf();
  }

  function startEdit(p: Performance) {
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
    if (!editingId || !myId) return;
    setSavingEdit(true);

    const { error } = await supabase
      .from("game_performances")
      .update({
        game_name: editGameName,
        performance_title: editTitle,
        performance_value: editValue || null,
      })
      .eq("id", editingId)
      .eq("user_id", myId);

    setSavingEdit(false);

    if (error) {
      alert("Erreur lors de la modification : " + error.message);
      return;
    }

    setEditingId(null);
    fetchPerf();
  }

  // 🧩 FIX : Animation CSS injectée côté client uniquement
  useEffect(() => {
    if (typeof document !== "undefined") {
      const styleTag = document.createElement("style");
      styleTag.innerHTML = `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(styleTag);

      return () => {
        try {
          document.head.removeChild(styleTag);
        } catch {}
      };
    }
  }, []);

  if (loading) return <p>Chargement...</p>;
  if (performances.length === 0) return <p>Aucune performance ajoutée pour le moment.</p>;

  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
      {performances.map((p) => {
        const isEditing = editingId === p.id;

        return (
          <div
            key={p.id}
            style={{
              padding: "22px",
              borderRadius: "16px",
              background:
                "linear-gradient(135deg, rgba(12,12,18,0.92), rgba(8,8,12,0.97))",
              border: "1px solid rgba(110,110,155,0.12)",
              boxShadow:
                "0 0 22px rgba(70,90,255,0.10), inset 0 0 12px rgba(20,20,35,0.35)",
              transition: "all 0.25s cubic-bezier(.25,.8,.25,1)",
              position: "relative",
              animation: "fadeIn 0.35s ease",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow =
                "0 0 26px rgba(90,110,255,0.18), inset 0 0 16px rgba(20,20,35,0.45)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0px)";
              e.currentTarget.style.boxShadow =
                "0 0 22px rgba(70,90,255,0.10), inset 0 0 12px rgba(20,20,35,0.35)";
            }}
          >
            {/* Boutons d'action */}
            {myId === userId && !isEditing && (
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  display: "flex",
                  gap: 8,
                }}
              >
                <button
                  onClick={() => startEdit(p)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    padding: "4px 10px",
                    borderRadius: 8,
                    color: "white",
                    cursor: "pointer",
                    fontSize: 13,
                    backdropFilter: "blur(3px)",
                  }}
                >
                  ✏
                </button>

                <button
                  onClick={() => deletePerformance(p.id)}
                  style={{
                    background: "rgba(176,0,32,0.85)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    padding: "4px 10px",
                    borderRadius: 8,
                    color: "white",
                    cursor: "pointer",
                    fontSize: 13,
                    backdropFilter: "blur(3px)",
                  }}
                >
                  🗑
                </button>
              </div>
            )}

            {/* MODE LECTURE */}
            {!isEditing && (
              <>
                <strong
                  style={{
                    fontSize: 18,
                    marginBottom: 8,
                    display: "block",
                    letterSpacing: "0.5px",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  {p.game_name}
                </strong>

                <div
                  style={{
                    height: "1px",
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    margin: "12px 0",
                  }}
                />

                <p style={{ fontSize: 15, marginBottom: 6, color: "rgba(255,255,255,0.85)" }}>
                  {p.performance_title}
                </p>

                {p.performance_value && (
                  <p style={{ fontSize: 14, opacity: 0.6 }}>
                    {p.performance_value}
                  </p>
                )}
              </>
            )}

            {/* MODE ÉDITION */}
            {isEditing && (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 12 }}>Jeu</label>
                <input
                  type="text"
                  value={editGameName}
                  onChange={(e) => setEditGameName(e.target.value)}
                  style={inputStyle}
                />

                <label style={{ fontSize: 12 }}>Performance</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={inputStyle}
                />

                <label style={{ fontSize: 12 }}>Détail (optionnel)</label>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  style={inputStyle}
                />

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    onClick={saveEdit}
                    disabled={savingEdit}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: "rgba(70,100,255,0.85)",
                      color: "white",
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    {savingEdit ? "Enregistrement..." : "💾 Enregistrer"}
                  </button>

                  <button
                    onClick={cancelEdit}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.18)",
                      background: "rgba(0,0,0,0.4)",
                      color: "white",
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: 10,
  borderRadius: 10,
  border: "1px solid rgba(110,110,155,0.20)",
  background: "rgba(10,10,18,0.6)",
  color: "white",
  marginBottom: 12,
};
