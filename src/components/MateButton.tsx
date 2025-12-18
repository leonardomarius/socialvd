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

    // Check if mates
    const { data: mate } = await supabase
      .from("mates")
      .select("*")
      .or(
        `and(user1_id.eq.${myId},user2_id.eq.${otherId}),and(user1_id.eq.${otherId},user2_id.eq.${myId})`
      )
      .maybeSingle();

    if (mate) {
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

    const { data: me } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", myId)
      .single();

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
    await supabase.from("mate_requests").delete().eq("id", requestId);
    loadStatus();
  };

  // Accept request received
  const acceptRequest = async () => {
    if (!myId || !otherId) return;

    // 1) Get the pending request
    const { data: req } = await supabase
      .from("mate_requests")
      .select("*")
      .eq("sender_id", otherId)
      .eq("receiver_id", myId)
      .eq("status", "pending")
      .single();

    if (!req) return;

    // 2) Mark request as accepted
    const { error: err1 } = await supabase
      .from("mate_requests")
      .update({ status: "accepted" })
      .eq("id", req.id);

    if (err1) return console.error("Error updating request:", err1);

    // 3) Insert into mates
    const orderedUser1 = otherId < myId ? otherId : myId;
    const orderedUser2 = otherId < myId ? myId : otherId;

    const { error: err2 } = await supabase.from("mates").insert({
      user1_id: orderedUser1,
      user2_id: orderedUser2,
      start_date: new Date().toISOString(),
    });

    if (err2) return console.error("Error creating mate:", err2);

    // Notification
    const { data: me } = await supabase
      .from("profiles")
      .select("pseudo")
      .eq("id", myId)
      .single();

    await supabase.from("notifications").insert({
      user_id: otherId,
      from_user_id: myId,
      type: "mate_accept",
      message: `${me?.pseudo ?? "Someone"} accepted your mate request 🎉`,
    });

    loadStatus();
  };

  // ---------------- UI ----------------

  if (status === "mate") {
    return (
      <button
        className="btn social-btn active"
        type="button"
      >
        🔥 You are mates
      </button>
    );
  }

  if (status === "pending_sent") {
    return (
      <button
        onClick={cancelRequest}
        className="btn social-btn"
        type="button"
      >
        Request sent (cancel)
      </button>
    );
  }

  if (status === "pending_received") {
    return (
      <button
        onClick={acceptRequest}
        className="btn social-btn active"
        type="button"
      >
        Accept request 🤝
      </button>
    );
  }

  return (
    <button
      onClick={sendRequest}
      className="btn social-btn"
      type="button"
    >
      Become mates 🤝
    </button>
  );
}
