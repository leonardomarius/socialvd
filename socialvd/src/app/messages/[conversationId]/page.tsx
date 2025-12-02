"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  seen: boolean;
  created_at: string;
};

type UserProfile = {
  id: string;
  pseudo: string | null;
  avatar_url: string | null;
};

export default function ConversationPage() {
  const router = useRouter();
  const params = useParams();
  const conversationId = params.conversationId as string;

  const [myId, setMyId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);

  /* MARK SEEN — After messages are fully loaded */
  useEffect(() => {
    if (!myId || messages.length === 0) return;

    supabase
      .from("messages")
      .update({ seen: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", myId)
      .eq("seen", false);
  }, [messages, myId]);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  /* AUTO SCROLL */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* LOAD ALL DATA */
  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.push("/login");

      const uid = auth.user.id;
      setMyId(uid);

      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .maybeSingle();

      if (!conv) return router.push("/messages");

           await loadParticipants(uid);
      await loadMessages();
      // ❌ NE PLUS mettre markMessagesSeen ici

      /* REALTIME — ignorer mes propres messages */
      const channel = supabase
        .channel("conv-" + conversationId)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            table: "messages",
            schema: "public",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const msg = payload.new as Message;

            if (msg.sender_id === uid) return;

            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        )
        .subscribe();

      setLoading(false);

      return () => supabase.removeChannel(channel);
    };

    if (conversationId) load();
  }, [conversationId]);

  /* LOAD PARTICIPANT */
  const loadParticipants = async (userId: string) => {
    const { data: convUsers } = await supabase
      .from("conversations_users")
      .select("user_id")
      .eq("conversation_id", conversationId);

    const other = convUsers?.find((u) => u.user_id !== userId);
    if (!other) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", other.user_id)
      .single();

    setOtherUser(data);
  };

  /* LOAD MESSAGES */
  const loadMessages = async () => {
    setLoading(true);

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    const unique = (data || []).filter(
      (msg, index, self) => index === self.findIndex((m) => m.id === msg.id)
    );

    setMessages(unique);
    setLoading(false);
  };

  /* MARK SEEN */
  const markMessagesSeen = async (userId: string) => {
    await supabase
      .from("messages")
      .update({ seen: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", userId)
      .eq("seen", false);
  };

  /* SEND MESSAGE — 🔥 AJOUT LOCAL IMMÉDIAT + PATCH */
  const handleSend = async () => {
    if (!newMessage.trim() || !myId) return;

    const text = newMessage.trim();
    setNewMessage("");

    // 1️⃣ INSERT MESSAGE
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: myId,
        content: text,
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      setMessages((prev) => [...prev, data]);
    }

    // 2️⃣ 🔥 PATCH : mettre à jour la conversation
    await supabase
      .from("conversations")
      .update({
        updated_at: new Date().toISOString(),
        last_message: text,
      })
      .eq("id", conversationId);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  /* STYLE */
  const pageWrapperStyle: React.CSSProperties = {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    color: "white",
    marginTop: "20px",
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "750px",
    minHeight: "70vh",
    borderRadius: "18px",
    border: "1px solid rgba(255,255,255,0.25)",
    background:
      "linear-gradient(145deg, rgba(5,5,16,0.95), rgba(12,12,28,0.95))",
    boxShadow: "0 25px 60px rgba(0,0,0,0.85)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backdropFilter: "blur(10px)",
  };

  const bubbleMine: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: "16px",
    borderBottomRightRadius: "2px",
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "white",
    maxWidth: "70%",
    fontSize: "0.9rem",
    boxShadow: "0 12px 25px rgba(37,99,235,0.35)",
    wordBreak: "break-word",
  };

  const bubbleOther: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: "16px",
    borderBottomLeftRadius: "2px",
    background: "rgba(20,20,35,0.95)",
    color: "rgba(230,230,255,0.95)",
    maxWidth: "70%",
    fontSize: "0.9rem",
    boxShadow: "0 8px 18px rgba(0,0,0,0.8)",
    border: "1px solid rgba(140,140,200,0.3)",
    wordBreak: "break-word",
  };

  const timeStyle: React.CSSProperties = {
    fontSize: "0.7rem",
    opacity: 0.6,
    marginTop: "4px",
    textAlign: "right",
  };

  return (
    <div style={pageWrapperStyle}>
      <div style={cardStyle}>

        {/* HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.12)",
            background:
              "linear-gradient(90deg, rgba(10,10,24,0.98), rgba(20,20,40,0.98))",
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/messages")}
            style={{
              background: "#1f2937",
              borderRadius: "999px",
              border: "none",
              color: "white",
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: "1.1rem",
            }}
          >
            ←
          </button>

          {otherUser && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img
                src={
                  otherUser.avatar_url ||
                  "https://via.placeholder.com/40/333/FFF?text=?"
                }
                alt="Avatar"
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "999px",
                  objectFit: "cover",
                  border: "1px solid rgba(255,255,255,0.5)",
                }}
              />
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 600, fontSize: "1rem" }}>
                  {otherUser.pseudo ?? "Utilisateur"}
                </div>
                <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                  Actif récemment
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MESSAGES */}
        <div
          style={{
            flex: 1,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            overflowY: "auto",
          }}
        >
          {loading && <p style={{ opacity: 0.7 }}>Chargement des messages…</p>}

          {messages
            .filter(
              (msg, index, self) =>
                index === self.findIndex((m) => m.id === msg.id)
            )
            .map((m) => {
              const mine = m.sender_id === myId;

              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: mine ? "flex-end" : "flex-start",
                    gap: "6px",
                  }}
                >
                  {!mine && otherUser && (
                    <img
                      src={
                        otherUser.avatar_url ||
                        "https://via.placeholder.com/32/333/FFF?text=?"
                      }
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "999px",
                        objectFit: "cover",
                      }}
                    />
                  )}

                  <div style={mine ? bubbleMine : bubbleOther}>
                    <div>{m.content}</div>
                    <div style={timeStyle}>{formatDate(m.created_at)}</div>
                  </div>
                </div>
              );
            })}

          <div ref={bottomRef} />
        </div>

        {/* INPUT */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(8,8,20,0.98)",
            display: "flex",
            gap: "10px",
          }}
        >
          <input
            placeholder="Écrire un message…"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            style={{
              flex: 1,
              background: "rgba(12,12,30,0.95)",
              border: "1px solid rgba(120,120,180,0.8)",
              color: "white",
              padding: "10px 14px",
              borderRadius: "999px",
              fontSize: "0.9rem",
            }}
          />
          <button
            onClick={handleSend}
            style={{
              background: "#2563eb",
              borderRadius: "999px",
              padding: "10px 18px",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Envoyer
          </button>
        </div>

      </div>
    </div>
  );
}
