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

  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (session?.status !== "active") return;

    const interval = setInterval(() => {
      forceUpdate((x) => x + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

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
  // 🔥 Realtime pour NOUVELLE session
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

          if (isConcerned) fetchActiveSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, otherId]);

  // -------------------------------------------------
  // 🔥 Realtime ciblé
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
        () => fetchActiveSession()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  // -------------------------------------------------
  // 🔥 NOTIFS : fonction utilitaire
  // -------------------------------------------------
  async function sendNotification(targetId: string, fromId: string, type: string, message: string) {
    const { data: fromProfile } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", fromId)
      .single();

    const finalMessage = `${fromProfile?.pseudo ?? "Un joueur"} ${message}`;

    await supabase.from("notifications").insert({
      user_id: targetId,
      from_user_id: fromId,
      type,
      message: finalMessage,
    });
  }

  // -------------------------------------------------
  // 🔥 Demander une session
  // -------------------------------------------------
  async function requestSession() {
    setLoading(true);

    // 🧹 supprimer anciennes notifs "session_request"
    await supabase
  .from("notifications")
  .delete()
  .eq("user_id", otherId)      // celui qui reçoit la notif
  .eq("from_user_id", myId)    // celui qui annule la demande
  .eq("type", "session_request");


    // créer nouvelle session
    await supabase.from("mate_sessions").insert({
      user1_id: myId,
      user2_id: otherId,
      start_request_by: myId,
      status: "pending",
    });

    // 🔔 créer nouvelle notif propre
    await sendNotification(otherId!, myId!, "session_request", "veut lancer une session de jeu avec toi 🎮");

    setLoading(false);
    fetchActiveSession();
  }

  // -------------------------------------------------
  // 🔥 Annuler session
  // -------------------------------------------------
  async function cancelSession() {
    if (!session) return;
    setLoading(true);

    // 🧹 supprimer notif “session_request”
    await supabase
      .from("notifications")
      .delete()
      .eq("from_user_id", session.start_request_by)
      .eq("user_id", otherId)
      .eq("type", "session_request");

    // supprimer session
    await supabase.from("mate_sessions").delete().eq("id", session.id);

    setLoading(false);
    setSession(null);
  }

  // -------------------------------------------------
  // 🔥 Accepter session
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

    // 🔔 notif acceptation
    await sendNotification(otherId!, myId!, "session_accept", "a accepté ta session de jeu 🎮🔥");

    setLoading(false);
    fetchActiveSession();
  }

  // -------------------------------------------------
  // 🔥 Stop session
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
  // 🔥 UI
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
              new Date(session.started_at).getTime()) / 1000
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
