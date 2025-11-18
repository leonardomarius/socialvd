"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";

type UserProfile = {
  id: string;
  pseudo: string | null;
  avatar_url: string | null;
};

type Conversation = {
  id: string;
  last_message: string | null;
  updated_at: string;
  other_user: UserProfile | null;
  unread: number;
};

export default function MessagesPage() {
  const router = useRouter();
  const [myId, setMyId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }

      const userId = userData.user.id;
      setMyId(userId);

      const { data: convUsers } = await supabase
        .from("conversations_users")
        .select("conversation_id")
        .eq("user_id", userId);

      const convIds = convUsers?.map((c) => c.conversation_id) ?? [];

      if (convIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const { data: convs } = await supabase
        .from("conversations")
        .select("*")
        .in("id", convIds)
        .order("updated_at", { ascending: false });

      const { data: participants } = await supabase
        .from("conversations_users")
        .select("*")
        .in("conversation_id", convIds);

      const otherIds = Array.from(
        new Set(
          (participants ?? [])
            .filter((p) => p.user_id !== userId)
            .map((p) => p.user_id)
        )
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", otherIds);

      const { data: unread } = await supabase
        .from("messages")
        .select("conversation_id")
        .eq("seen", false)
        .neq("sender_id", userId);

      const unreadCount: Record<string, number> = {};
      unread?.forEach((m) => {
        unreadCount[m.conversation_id] =
          (unreadCount[m.conversation_id] ?? 0) + 1;
      });

      const fullConvs: Conversation[] = (convs ?? []).map((conv) => {
        const otherId = participants?.find(
          (p) => p.conversation_id === conv.id && p.user_id !== userId
        )?.user_id;

        const otherUser =
          profiles?.find((p) => p.id === otherId) ?? null;

        return {
          id: conv.id,
          last_message: conv.last_message,
          updated_at: conv.updated_at,
          other_user: otherUser,
          unread: unreadCount[conv.id] ?? 0,
        };
      });

      setConversations(fullConvs);
      setLoading(false);
    };

    load();
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });

  if (loading) return <p style={{ color: "white", padding: 20 }}>Chargement…</p>;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        marginTop: "40px",
        padding: "0 20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          background: "rgba(0,0,0,0.80)",    // 🔥 FOND NOIR OPAQUE
          borderRadius: "20px",
          padding: "25px",
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: "0 0 35px rgba(0,0,0,0.6)",
        }}
      >
        {/* TITRE */}
        <h1
          style={{
            fontSize: "32px",
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "25px",
          }}
        >
          Messages
        </h1>

        {conversations.length === 0 && (
          <p style={{ color: "#bbb", textAlign: "center", marginTop: 30 }}>
            Aucune conversation.
          </p>
        )}

        {/* LISTE DES CONVERSATIONS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/messages/${conv.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "15px",
                background: "rgba(20,20,20,0.9)",   // 🔥 CARTES LISIBLES
                padding: "14px",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.1)",
                textDecoration: "none",
                transition: "0.2s",
              }}
            >
              <Image
                src={conv.other_user?.avatar_url ?? "/default-avatar.png"}
                width={50}
                height={50}
                alt="avatar"
                style={{ borderRadius: "50%" }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <p
                    style={{
                      fontWeight: "600",
                      fontSize: "15px",
                      color: "white",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {conv.other_user?.pseudo ?? "Utilisateur"}
                  </p>

                  <span style={{ fontSize: "11px", color: "#aaa" }}>
                    {formatDate(conv.updated_at)}
                  </span>
                </div>

                <p style={{ fontSize: "13px", color: "#ddd" }}>
                  {conv.last_message ?? "Nouvelle conversation"}
                </p>
              </div>

              {conv.unread > 0 && (
                <span
                  style={{
                    background: "red",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: "11px",
                    fontWeight: "bold",
                    color: "white",
                  }}
                >
                  {conv.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
