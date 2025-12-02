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
    // On ne lance le timer que si la session est en cours
    if (!session || (session.status !== "active" && session.status !== "ongoing")) {
      return;
    }

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
    if (!myId || !otherId) return;

    const { data, error } = await supabase.rpc("get_active_session", {
      p_other_user_id: otherId,
    });

    if (error) {
      console.error("Error get_active_session:", error);
      setSession(null);
      return;
    }

    console.log("DEBUG get_active_session =>", data);
    setSession(data as MateSession | null);
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

    const finalMessage = `${fromProfile?.pseudo ?? "A player"} ${message}`;

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
    await supabase.rpc("start_mate_session", {
  p_other_user_id: otherId,
});


    // 🔔 créer nouvelle notif propre
    await sendNotification(otherId!, myId!, "session_request", "wants to start a gaming session with you 🎮");

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
   await supabase.rpc("end_mate_session", {
  p_session_id: session.id,
});

    setLoading(false);
    setSession(null);
  }

  // -------------------------------------------------
  // 🔥 Accepter session
  // -------------------------------------------------
  async function acceptSession() {
    if (!session) return;
    setLoading(true);

    await supabase.rpc("accept_active_session", {
  p_session_id: session.id,
});

    // 🔔 notif acceptation
    await sendNotification(otherId!, myId!, "session_accept", "accepted your gaming session 🎮🔥");

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

    await supabase.rpc("end_mate_session", {
  p_session_id: session.id,
});


    setLoading(false);
    setSession(null);
  }

  // -------------------------------------------------
  // 🔥 UI
  // -------------------------------------------------

  // -------------------------------------------------
  // 🔥 UI
  // -------------------------------------------------

  const currentStatus = session?.status;

  // 🔒 Sécurité : si pas de session OU statut inconnu (= pas pending / active / ongoing),
  // on affiche TOUJOURS le bouton "Start", jamais un trou vide.
  if (
    !session ||
    (currentStatus !== "pending" &&
      currentStatus !== "active" &&
      currentStatus !== "ongoing")
  ) {
    return (
      <button onClick={requestSession} disabled={loading} className="mate-btn">
        Start a gaming session 🎮
      </button>
    );
  }

  // 🟡 Session en attente (optionnel : l’autre doit accepter)
  if (currentStatus === "pending") {
    if (session.start_request_by === myId) {
      return (
        <div style={{ display: "flex", gap: 10 }}>
          <div className="mate-btn">Request sent… ⏳</div>

          <button
            onClick={cancelSession}
            disabled={loading}
            className="mate-btn"
            style={{ background: "#b00020" }}
          >
            Cancel
          </button>
        </div>
      );
    }

    return (
      <button onClick={acceptSession} disabled={loading} className="mate-btn">
        Accept session 🎮
      </button>
    );
  }

  // 🟢 Session en cours (active ou ongoing)
  if (currentStatus === "active" || currentStatus === "ongoing") {
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
          Session in progress: {minutes}m {seconds}s ⏱️
        </div>

        <button
          onClick={stopSession}
          disabled={loading}
          className="mate-btn"
          style={{ marginTop: 10 }}
        >
          Stop session
        </button>
      </div>
    );
  }

  // Théoriquement on ne devrait jamais arriver ici,
  // mais par sécurité on remet le bouton Start.
  return (
    <button onClick={requestSession} disabled={loading} className="mate-btn">
      Start a gaming session 🎮
    </button>
  );
}
