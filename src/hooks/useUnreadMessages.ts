"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function useUnreadMessages(myId: string | null) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!myId) return;

    // 1) Charger les non-lus au démarrage
    const fetchUnread = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id", { count: "exact" })
        .eq("receiver_id", myId)
        .eq("seen", false);

      if (!error && data) {
        setUnreadCount(data.length);
      }
    };

    fetchUnread();

    // 2) Realtime: messages reçus
    const channel = supabase
      .channel("new-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const msg = payload.new;

          if (msg.receiver_id === myId) {
            setUnreadCount((c) => c + 1);
          }
        }
      )
      // Quand un message passe seen = true, on baisse le compteur
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const oldMsg = payload.old;
          const newMsg = payload.new;

          // seulement si un message pour moi passe de non-lu → lu
          if (
            newMsg.receiver_id === myId &&
            oldMsg.seen === false &&
            newMsg.seen === true
          ) {
            setUnreadCount((c) => Math.max(0, c - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId]);

  return unreadCount;
}
