"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";

type User = {
  id: string;
  pseudo: string | null;
  avatar_url: string | null;
};

type MateRelation = {
  id: string;
  user1_id: string;
  user2_id: string;
  start_date: string;
};

type Request = {
  id: string;
  sender_id: string;
  receiver_id: string;
};

export default function MatesPage() {
  const params = useParams();
  const id = params.id as string;

  const [myId, setMyId] = useState<string | null>(null);

  const [mates, setMates] = useState<(MateRelation & { other: User })[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<
    (Request & { sender: User })[]
  >([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setMyId(data.user?.id || null);
    };
    load();
  }, []);

  useEffect(() => {
    if (!myId) return;

    loadMates();
    loadRequests();
  }, [myId]);

  // Load mates
  const loadMates = async () => {
    const { data } = await supabase
      .from("mates")
      .select("*")
      .or(`user1_id.eq.${myId},user2_id.eq.${myId}`);

    if (!data) return;

    const enriched = await Promise.all(
      data.map(async (m) => {
        const otherId = m.user1_id === myId ? m.user2_id : m.user1_id;

        const { data: other } = await supabase
          .from("profiles")
          .select("id, pseudo, avatar_url")
          .eq("id", otherId)
          .single();

        return { ...m, other };
      })
    );

    setMates(enriched);
  };

  // Load received requests
  const loadRequests = async () => {
    const { data } = await supabase
      .from("mate_requests")
      .select("*")
      .eq("receiver_id", myId)
      .eq("status", "pending");

    if (!data) return;

    const enriched = await Promise.all(
      data.map(async (r) => {
        const { data: sender } = await supabase
          .from("profiles")
          .select("id, pseudo, avatar_url")
          .eq("id", r.sender_id)
          .single();

        return { ...r, sender };
      })
    );

    setReceivedRequests(enriched);
  };

  const acceptRequest = async (reqId: string, senderId: string) => {
    await supabase.from("mate_requests").delete().eq("id", reqId);
    await supabase.from("mates").insert({
      user1_id: myId!,
      user2_id: senderId,
    });
    loadMates();
    loadRequests();
  };

  const refuseRequest = async (reqId: string) => {
    await supabase.from("mate_requests").delete().eq("id", reqId);
    loadRequests();
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Mates</h1>

      {/* Requests */}
      {receivedRequests.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ marginBottom: 12 }}>Demandes reçues</h2>

          {receivedRequests.map((req) => (
            <div key={req.id} style={{ padding: 12, background: "#111", borderRadius: 6, marginBottom: 12 }}>
              <p><b>{req.sender.pseudo}</b> veut devenir mate</p>

              <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                <button
                  onClick={() => acceptRequest(req.id, req.sender.id)}
                  style={{ padding: "6px 12px", background: "green", color: "white", borderRadius: 6 }}
                >
                  Accepter
                </button>

                <button
                  onClick={() => refuseRequest(req.id)}
                  style={{ padding: "6px 12px", background: "red", color: "white", borderRadius: 6 }}
                >
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mates */}
      <h2 style={{ marginBottom: 12 }}>Tes mates</h2>

      {mates.length === 0 ? (
        <p>Aucun mate pour le moment.</p>
      ) : (
        mates.map((m) => (
          <div key={m.id} style={{ padding: 14, background: "#111", borderRadius: 6, marginBottom: 12 }}>
            <p><b>{m.other.pseudo}</b></p>
            <p style={{ fontSize: 12, color: "#888" }}>Depuis le {new Date(m.start_date).toLocaleDateString()}</p>

            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
              <Link
                href={`/profile/${m.other.id}`}
                style={{ padding: "6px 10px", background: "#0070f3", color: "white", borderRadius: 6, textDecoration: "none" }}
              >
                Voir profil
              </Link>

              {/* 🔥 NOUVEAU BOUTON — PAGE STATS */}
              <Link
                href={`/profile/${myId}/mates/${m.other.id}/stats`}
                style={{
                  padding: "6px 10px",
                  background: "purple",
                  color: "white",
                  borderRadius: 6,
                  textDecoration: "none"
                }}
              >
                Stats avec ce mate
              </Link>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
