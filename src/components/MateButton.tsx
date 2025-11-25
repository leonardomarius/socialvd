"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function MateButton({ myId, otherId }: { myId: string; otherId: string }) {
  const [status, setStatus] = useState<"none" | "pending_sent" | "pending_received" | "mate">("none");
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!myId || !otherId) return;
    loadStatus();
  }, [myId, otherId]);

  const loadStatus = async () => {
    // Check request sent by me
    const { data: sent } = await supabase
      .from("mate_requests")
      .select("*")
      .eq("sender_id", myId)
      .eq("receiver_id", otherId)
      .eq("status", "pending")
      .single();

    if (sent) {
      setStatus("pending_sent");
      setRequestId(sent.id);
      return;
    }

    // Check request received
    const { data: received } = await supabase
      .from("mate_requests")
      .select("*")
      .eq("sender_id", otherId)
      .eq("receiver_id", myId)
      .eq("status", "pending")
      .single();

    if (received) {
      setStatus("pending_received");
      setRequestId(received.id);
      return;
    }

    // Check if already mates
    const { data: mate } = await supabase
      .from("mates")
      .select("*")
      .or(`user1_id.eq.${myId},user2_id.eq.${myId}`)
      .or(`user1_id.eq.${otherId},user2_id.eq.${otherId}`);

    if (mate && mate.length > 0) {
      setStatus("mate");
      return;
    }

    setStatus("none");
  };

  // Send request
  const sendRequest = async () => {
    await supabase.from("mate_requests").insert({
      sender_id: myId,
      receiver_id: otherId,
      status: "pending",
    });
    loadStatus();
  };

  // Cancel request I sent
  const cancelRequest = async () => {
    if (!requestId) return;
    await supabase.from("mate_requests").delete().eq("id", requestId);
    loadStatus();
  };

  // Accept request received
  const acceptRequest = async () => {
    if (!requestId) return;

    // delete request
    await supabase.from("mate_requests").delete().eq("id", requestId);

    // create mate
    await supabase.from("mates").insert({
      user1_id: myId,
      user2_id: otherId,
    });

    loadStatus();
  };

  if (status === "mate") {
    return (
      <button
        style={{
          padding: "8px 16px",
          background: "#198754",
          color: "white",
          borderRadius: 6,
          border: "none",
        }}
      >
        🔥 Vous êtes mates
      </button>
    );
  }

  if (status === "pending_sent") {
    return (
      <button
        onClick={cancelRequest}
        style={{
          padding: "8px 16px",
          background: "orange",
          color: "black",
          borderRadius: 6,
          border: "none",
        }}
      >
        Demande envoyée (annuler)
      </button>
    );
  }

  if (status === "pending_received") {
    return (
      <button
        onClick={acceptRequest}
        style={{
          padding: "8px 16px",
          background: "yellow",
          color: "black",
          borderRadius: 6,
          border: "none",
        }}
      >
        Accepter la demande 🤝
      </button>
    );
  }

  return (
    <button
      onClick={sendRequest}
      style={{
        padding: "8px 16px",
        background: "#0070f3",
        color: "white",
        borderRadius: 6,
        border: "none",
      }}
    >
      Devenir mates 🤝
    </button>
  );
}