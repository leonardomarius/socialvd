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
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🔥 LOAD ALL DATA + REALTIME
  useEffect(() => {
    if (!conversationId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    const init = async () => {
      try {
        // 1. Vérifier la session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
          router.replace("/login");
          return;
        }

        const uid = sessionData.session.user.id;
        if (!isMounted) return;
        setMyId(uid);

        // 2. Vérifier que la conversation existe et que l'utilisateur y a accès
        const { data: conv, error: convError } = await supabase
          .from("conversations")
          .select("id")
          .eq("id", conversationId)
          .maybeSingle();

        if (convError || !conv) {
          router.replace("/messages");
          return;
        }

        // 3. Charger les participants et trouver l'autre utilisateur
        await loadParticipants(uid);

        // 4. Charger les messages
        await loadMessages();

        // 5. Marquer les messages reçus comme vus
        await markMessagesSeen(uid);

        // 6. Ouvrir le canal realtime
        channel = supabase
          .channel("conv-" + conversationId + "-" + uid)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${conversationId}`,
            },
            (payload) => {
              const msg = payload.new as Message;
              // Dédoublonnage
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                const newMessages = [...prev, msg].sort(
                  (a, b) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                return newMessages;
              });

              // Si c'est un message reçu, le marquer comme lu
              if (msg.sender_id !== uid) {
                markMessagesSeen(uid);
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${conversationId}`,
            },
            (payload) => {
              const msg = payload.new as Message;
              setMessages((prev) =>
                prev.map((m) => (m.id === msg.id ? msg : m))
              );
            }
          )
          .subscribe();

        setLoading(false);
      } catch (error) {
        console.error("Error in init:", error);
        setLoading(false);
      }
    };

    init();

    // Cleanup
    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [conversationId, router]);

  // 🔥 LOAD PARTICIPANTS
  const loadParticipants = async (userId: string) => {
    try {
      // Utiliser les messages pour identifier l'autre participant (plus fiable que conversations_users avec RLS)
      // Chercher un message de l'autre utilisateur
      const { data: otherMessage } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("conversation_id", conversationId)
        .neq("sender_id", userId)
        .limit(1)
        .maybeSingle();

      let otherUserId: string | null = null;

      if (otherMessage?.sender_id) {
        otherUserId = otherMessage.sender_id;
      } else {
        // Fallback: chercher n'importe quel message pour identifier un sender
        const { data: anyMessage } = await supabase
          .from("messages")
          .select("sender_id")
          .eq("conversation_id", conversationId)
          .limit(1)
          .maybeSingle();

        if (anyMessage?.sender_id && anyMessage.sender_id !== userId) {
          otherUserId = anyMessage.sender_id;
        } else {
          // Dernier fallback: utiliser conversations_users (peut ne pas fonctionner avec RLS)
          const { data: convUsers } = await supabase
            .from("conversations_users")
            .select("user_id")
            .eq("conversation_id", conversationId);

          const other = convUsers?.find((u) => u.user_id && u.user_id !== userId);
          if (other?.user_id) {
            otherUserId = other.user_id;
          }
        }
      }

      if (!otherUserId) {
        console.warn("Could not identify other participant for conversation:", conversationId);
        return;
      }

      // Charger le profil de l'autre utilisateur
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, pseudo, avatar_url")
        .eq("id", otherUserId)
        .single();

      if (profileError) {
        console.error("Error fetching profile for user", otherUserId, ":", profileError);
        return;
      }

      if (!profile || !profile.id) {
        console.warn("Profile not found for user:", otherUserId);
        return;
      }

      setOtherUser({
        id: profile.id,
        pseudo: profile.pseudo ?? null,
        avatar_url: profile.avatar_url ?? null,
      });
    } catch (error) {
      console.error("Error in loadParticipants:", error);
    }
  };

  // 🔥 LOAD MESSAGES
  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      // Dédoublonnage
      const unique = (data || []).filter(
        (msg, index, self) => index === self.findIndex((m) => m.id === msg.id)
      );

      setMessages(unique);
    } catch (error) {
      console.error("Error in loadMessages:", error);
    }
  };

  // 🔥 MARK SEEN — marque tous les messages reçus comme lus
  // Utilise la policy `update_seen_only_receiver`
  const markMessagesSeen = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .update({ seen: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", userId)
        .eq("seen", false)
        .select("id");

      if (error) {
        console.error("Error marking messages as seen:", error);
      }
    } catch (error) {
      console.error("Error in markMessagesSeen:", error);
    }
  };

  // 🔥 SEND MESSAGE
  const handleSend = async () => {
    if (!newMessage.trim() || !myId || sending) return;

    const text = newMessage.trim();
    setNewMessage("");
    setSending(true);

    try {
      // 1. Insérer le message
      const { data: newMsg, error: insertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: myId,
          content: text,
          seen: false,
        })
        .select("*")
        .single();

      if (insertError) {
        console.error("Error inserting message:", insertError);
        setNewMessage(text); // Restore message on error
        setSending(false);
        return;
      }

      if (newMsg) {
        // Ajouter localement (optimistic update)
        setMessages((prev) => [...prev, newMsg]);
      }

      // 2. Mettre à jour la conversation (updated_at et last_message)
      // RLS UPDATE permet si l'utilisateur est participant
      await supabase
        .from("conversations")
        .update({
          updated_at: new Date().toISOString(),
          last_message: text,
        })
        .eq("id", conversationId);
    } catch (error) {
      console.error("Error in handleSend:", error);
      setNewMessage(text); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          marginTop: "20px",
          padding: "0 20px",
        }}
      >
        <p style={{ color: "white", padding: 20 }}>Chargement…</p>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
        color: "white",
        marginTop: "20px",
        padding: "0 20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "750px",
          minHeight: "70vh",
          borderRadius: "18px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          background: "rgba(30, 30, 30, 0.8)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            background: "rgba(20, 20, 20, 0.6)",
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/messages")}
            style={{
              background: "rgba(40, 40, 40, 0.8)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "white",
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: "1.1rem",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(50, 50, 50, 0.9)";
              e.currentTarget.style.borderColor = "rgba(250, 204, 21, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(40, 40, 40, 0.8)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
            }}
          >
            ←
          </button>

          {otherUser && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
              {otherUser.avatar_url ? (
                <img
                  src={otherUser.avatar_url}
                  alt={otherUser.pseudo ?? "Avatar"}
                  className="avatar"
                />
              ) : (
                <div
                  className="avatar"
                  style={{
                    background: "rgba(100, 100, 100, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#999",
                    fontSize: "18px",
                  }}
                >
                  ?
                </div>
              )}
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 600, fontSize: "1rem", color: "#ffffff" }}>
                  {otherUser.pseudo ?? "Utilisateur"}
                </div>
                <div style={{ fontSize: "0.75rem", opacity: 0.7, color: "#aaa" }}>
                  En ligne
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
            minHeight: 0,
          }}
        >
          {messages.length === 0 && (
            <p style={{ opacity: 0.7, textAlign: "center", marginTop: "20px" }}>
              Aucun message. Commencez la conversation !
            </p>
          )}

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
                    alignItems: "flex-end",
                    gap: "8px",
                  }}
                >
                  {!mine && otherUser && (
                    <>
                      {otherUser.avatar_url ? (
                        <img
                          src={otherUser.avatar_url}
                          alt={otherUser.pseudo ?? "Avatar"}
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            flexShrink: 0,
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: "50%",
                            background: "rgba(100, 100, 100, 0.3)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#999",
                            fontSize: "14px",
                            flexShrink: 0,
                          }}
                        >
                          ?
                        </div>
                      )}
                    </>
                  )}

                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "16px",
                      borderBottomRightRadius: mine ? "4px" : "16px",
                      borderBottomLeftRadius: mine ? "16px" : "4px",
                      background: mine
                        ? "rgba(37, 99, 235, 0.8)"
                        : "rgba(20, 20, 30, 0.8)",
                      color: "white",
                      maxWidth: "70%",
                      fontSize: "0.9rem",
                      boxShadow: mine
                        ? "0 2px 8px rgba(37, 99, 235, 0.3)"
                        : "0 2px 8px rgba(0, 0, 0, 0.3)",
                      border: mine ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
                      wordBreak: "break-word",
                    }}
                  >
                    <div>{m.content}</div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        opacity: 0.7,
                        marginTop: "4px",
                        textAlign: "right",
                      }}
                    >
                      {formatDate(m.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}

          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div
          style={{
            padding: "14px 18px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            background: "rgba(20, 20, 20, 0.6)",
            display: "flex",
            gap: "10px",
          }}
        >
          <input
            placeholder="Écrire un message…"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sending}
            style={{
              flex: 1,
              background: "rgba(30, 30, 30, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "white",
              padding: "10px 14px",
              borderRadius: "999px",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
            style={{
              background: sending || !newMessage.trim()
                ? "rgba(50, 50, 50, 0.8)"
                : "rgba(37, 99, 235, 0.8)",
              borderRadius: "999px",
              padding: "10px 18px",
              border: "none",
              color: "white",
              fontWeight: 600,
              cursor: sending || !newMessage.trim() ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              opacity: sending || !newMessage.trim() ? 0.5 : 1,
            }}
          >
            {sending ? "..." : "Envoyer"}
          </button>
        </div>
      </div>
    </div>

    <style jsx>{`
      .avatar {
        width: 46px;
        height: 46px;
        object-fit: cover;
        border-radius: 999px;
        border: 1px solid rgba(156, 163, 175, 0.2);
      }
    `}</style>
    </>
  );
}
