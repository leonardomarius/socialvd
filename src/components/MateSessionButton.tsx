"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type MateSession = {
  id: string;
  user1_id: string;
  user2_id: string;
  start_request_by: string;
  start_accepted: boolean;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
};

export default function MateSessionButton({
  myId,
  otherId,
}: {
  myId: string | null;
  otherId: string | null;
}) {
  const [session, setSession] = useState<MateSession | null>(null);
  const [loading, setLoading] = useState(false);

  // -------------------------------------------------
  // 🔥 1) Timer live (maj du composant toutes les 1 sec)
  // -------------------------------------------------
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (session?.status !== "active") return;

    const interval = setInterval(() => {
      forceUpdate((x) => x + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  // -------------------------------------------------
  // 🔥 2) Charger la session active/pending
  // -------------------------------------------------
  useEffect(() => {
    if (!myId || !otherId) return;
    fetchActiveSession();
  }, [myId, otherId]);

  async function fetchActiveSession() {
    const { data } = await supabase
      .from("mate_sessions")
      .select("*")
      .or(
        `and(user1_id.eq.${myId},user2_id.eq.${otherId}),and(user1_id.eq.${otherId},user2_id.eq.${myId})`
      )
      .neq("status", "ended")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setSession(data || null);
  }

  // -------------------------------------------------
  // 🔥 2 bis) Realtime global pour détecter une NOUVELLE demande
  // -------------------------------------------------
  useEffect(() => {
    if (!myId || !otherId) return;

    const channel = supabase
      .channel(`mate_session_global_${myId}_${otherId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mate_sessions",
        },
        (payload) => {
          const s = payload.new;

          const isConcerned =
            (s.user1_id === myId && s.user2_id === otherId) ||
            (s.user1_id === otherId && s.user2_id === myId);

          if (isConcerned) {
            console.log("🔥 Nouvelle session détectée en realtime :", s);
            fetchActiveSession();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, otherId]);

  // -------------------------------------------------
  // 🔥 3) Realtime ciblé (écoute UNIQUEMENT cette session)
  // -------------------------------------------------
  useEffect(() => {
    if (!session?.id) return;

    const channel = supabase
      .channel(`mate_session_${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mate_sessions",
          filter: `id=eq.${session.id}`,
        },
        () => {
          fetchActiveSession();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("🔄 Realtime branché sur la session", session.id);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  // -------------------------------------------------
  // 🔥 4) Demander une session
  // -------------------------------------------------
  async function requestSession() {
    setLoading(true);

    await supabase.from("mate_sessions").insert({
      user1_id: myId,
      user2_id: otherId,
      start_request_by: myId,
      status: "pending",
    });

    setLoading(false);
    fetchActiveSession();
  }

  // -------------------------------------------------
  // 🔥 5) Annuler une demande
  // -------------------------------------------------
  async function cancelSession() {
    if (!session) return;
    setLoading(true);

    await supabase.from("mate_sessions").delete().eq("id", session.id);

    setLoading(false);
    setSession(null);
  }

  // -------------------------------------------------
  // 🔥 6) Accepter la session
  // -------------------------------------------------
  async function acceptSession() {
    if (!session) return;
    setLoading(true);

    await supabase
      .from("mate_sessions")
      .update({
        start_accepted: true,
        status: "active",
        started_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    setLoading(false);
    fetchActiveSession();
  }

  // -------------------------------------------------
  // 🔥 7) Terminer la session
  // -------------------------------------------------
  async function stopSession() {
    if (!session) return;

    setLoading(true);

    const endedAt = new Date();
    const startedAt = new Date(session.started_at!);

    const duration =
      Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000) || 1;

    await supabase
      .from("mate_sessions")
      .update({
        status: "ended",
        ended_at: endedAt.toISOString(),
        duration_seconds: duration,
      })
      .eq("id", session.id);

    setLoading(false);
    setSession(null);
  }

  // -------------------------------------------------
  // 🔥 8) UI dynamique
  // -------------------------------------------------

  if (!session) {
    return (
      <button onClick={requestSession} disabled={loading} className="mate-btn">
        Lancer une session de jeu 🎮
      </button>
    );
  }

  if (session.status === "pending") {
    if (session.start_request_by === myId) {
      return (
        <div style={{ display: "flex", gap: 10 }}>
          <div className="mate-btn">Demande envoyée… ⏳</div>

          <button
            onClick={cancelSession}
            disabled={loading}
            className="mate-btn"
            style={{ background: "#b00020" }}
          >
            Annuler
          </button>
        </div>
      );
    }

    return (
      <button onClick={acceptSession} disabled={loading} className="mate-btn">
        Accepter la session 🎮
      </button>
    );
  }

  if (session.status === "active") {
    const elapsed =
      session.started_at
        ? Math.floor(
            (new Date().getTime() -
              new Date(session.started_at).getTime()) /
              1000
          )
        : 0;

    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    return (
      <div>
        <div className="mate-btn">
          Session en cours : {minutes}m {seconds}s ⏱️
        </div>

        <button
          onClick={stopSession}
          disabled={loading}
          className="mate-btn"
          style={{ marginTop: 10 }}
        >
          Arrêter la session
        </button>
      </div>
    );
  }

  return null;
}
