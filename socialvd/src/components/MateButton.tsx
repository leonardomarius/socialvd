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
  if (!myId || !otherId) return;

  const { data, error } = await supabase.rpc("get_mate_status", {
    p_other_user: otherId,
  });

  if (error) {
    console.error("Error get_mate_status:", error);
    return;
  }

  // Expected : 
  // { status: "none" | "pending_sent" | "pending_received" | "mates", request_id: uuid? }
  setStatus(
    data.status === "mates"
      ? "mate"
      : data.status === "pending_sent"
      ? "pending_sent"
      : data.status === "pending_received"
      ? "pending_received"
      : "none"
  );

  setRequestId(data.request_id || null);
};


  // Send request
  const sendRequest = async () => {
    await supabase.rpc("send_mate_request", {
  p_receiver_id: otherId,
});


    // 👉 Step 1: fetch username
    const { data: me } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", myId)
      .single();

    // 🔔 Notification: mate request sent
    await supabase.from("notifications").insert({
      user_id: otherId,
      from_user_id: myId,
      type: "mate_request",
      message: `${me?.pseudo ?? "Someone"} wants to become your mate 🤝`,
    });

    loadStatus();
  };

  // Cancel request I sent
  const cancelRequest = async () => {
    if (!requestId) return;
    await supabase.rpc("cancel_mate_request", {
  p_request_id: requestId,
});
    loadStatus();
  };

  // Accept request received
  const acceptRequest = async () => {
    if (!requestId) return;

   await supabase.rpc("accept_mate_request", {
  p_request_id: requestId,
});


    // 👉 Step 1: get username
    const { data: me } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", myId)
      .single();

    // 🔔 Notification: mate request accepted
    await supabase.from("notifications").insert({
      user_id: otherId,
      from_user_id: myId,
      type: "mate_accept",
      message: `${me?.pseudo ?? "Someone"} accepted your mate request 🎉`,
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
        🔥 You are mates
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
        Request sent (cancel)
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
        Accept request 🤝
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
      Become mates 🤝
    </button>
  );
}
