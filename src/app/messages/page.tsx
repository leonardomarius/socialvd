"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
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

  // 🔥 Main loading function
  const loadConversations = async () => {
    try {
      // 1. Vérifier la session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        router.replace("/login");
        return;
      }

      const userId = sessionData.session.user.id;
      setMyId(userId);

      // 2. Récupérer les conversation_ids de l'utilisateur
      const { data: convUsers, error: convUsersError } = await supabase
        .from("conversations_users")
        .select("conversation_id")
        .eq("user_id", userId);

      if (convUsersError) {
        console.error("Error fetching conversations_users:", convUsersError);
        setLoading(false);
        return;
      }

      const convIds = Array.from(
        new Set((convUsers || []).map((c) => c.conversation_id).filter(Boolean))
      );

      if (convIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // 3. Récupérer les conversations
      const { data: convs, error: convsError } = await supabase
        .from("conversations")
        .select("*")
        .in("id", convIds)
        .order("updated_at", { ascending: false });

      if (convsError) {
        console.error("Error fetching conversations:", convsError);
        setLoading(false);
        return;
      }

      // 4. Récupérer l'autre utilisateur via les messages (contournement RLS)
      // Comme la RLS ne retourne que notre propre ligne dans conversations_users,
      // on utilise les messages pour identifier l'autre participant
      const conversationToOtherUser: Record<string, string> = {};
      
      // Récupérer un message par conversation pour identifier les autres senders
      // On fait une requête pour récupérer tous les messages nécessaires
      const { data: sampleMessages } = await supabase
        .from("messages")
        .select("conversation_id, sender_id")
        .in("conversation_id", convIds)
        .neq("sender_id", userId)
        .order("created_at", { ascending: false });

      // Construire la map conversation_id -> other_user_id
      if (sampleMessages) {
        // Pour chaque conversation, prendre le premier sender différent trouvé
        const seenConversations = new Set<string>();
        sampleMessages.forEach((msg) => {
          if (msg.conversation_id && msg.sender_id && !seenConversations.has(msg.conversation_id)) {
            conversationToOtherUser[msg.conversation_id] = msg.sender_id;
            seenConversations.add(msg.conversation_id);
          }
        });
      }

      // Pour les conversations où on n'a pas trouvé de message de l'autre,
      // essayer de récupérer n'importe quel message
      const missingConvs = convIds.filter((id) => !conversationToOtherUser[id]);
      if (missingConvs.length > 0) {
        const { data: anyMessages } = await supabase
          .from("messages")
          .select("conversation_id, sender_id")
          .in("conversation_id", missingConvs)
          .order("created_at", { ascending: false });

        if (anyMessages) {
          const seenMissing = new Set<string>();
          anyMessages.forEach((msg) => {
            if (
              msg.conversation_id &&
              msg.sender_id &&
              msg.sender_id !== userId &&
              !conversationToOtherUser[msg.conversation_id] &&
              !seenMissing.has(msg.conversation_id)
            ) {
              conversationToOtherUser[msg.conversation_id] = msg.sender_id;
              seenMissing.add(msg.conversation_id);
            }
          });
        }
      }

      // 6. Récupérer les profils des autres utilisateurs
      const otherIds = Array.from(
        new Set(Object.values(conversationToOtherUser))
      ).filter(Boolean);

      const profilesMap: Record<string, UserProfile> = {};
      if (otherIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, pseudo, avatar_url")
          .in("id", otherIds);

        if (profilesError) {
          console.error("❌ Error fetching profiles:", profilesError);
        } else if (profiles && Array.isArray(profiles)) {
          profiles.forEach((p) => {
            if (p && p.id) {
              profilesMap[p.id] = {
                id: p.id,
                pseudo: p.pseudo ?? null,
                avatar_url: p.avatar_url ?? null,
              };
            }
          });
        }
      }

      // 7. Récupérer les compteurs unread (messages non lus dont sender_id != myId)
      const { data: unreadMessages, error: unreadError } = await supabase
        .from("messages")
        .select("conversation_id")
        .eq("seen", false)
        .neq("sender_id", userId)
        .in("conversation_id", convIds);

      const unreadCount: Record<string, number> = {};
      if (!unreadError && unreadMessages) {
        unreadMessages.forEach((m) => {
          unreadCount[m.conversation_id] = (unreadCount[m.conversation_id] ?? 0) + 1;
        });
      }

      // 8. Construire la liste finale
      const fullConvs: Conversation[] = (convs || []).map((conv) => {
        const otherUserId = conversationToOtherUser[conv.id];
        const profileData = otherUserId ? profilesMap[otherUserId] : null;

        return {
          id: conv.id,
          last_message: conv.last_message ?? null,
          updated_at: conv.updated_at ?? conv.created_at ?? new Date().toISOString(),
          other_user: profileData || null,
          unread: unreadCount[conv.id] ?? 0,
        };
      });

      setConversations(fullConvs);
    } catch (error) {
      console.error("Error in loadConversations:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Initial load
  useEffect(() => {
    loadConversations();
  }, []);

  // 🔥 REALTIME: écouter les changements de messages
  useEffect(() => {
    if (!myId) return;

    const channel = supabase
      .channel("messages-list-realtime-" + myId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          loadConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId]);

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
    } else if (diffDays < 7) {
      return date.toLocaleDateString("fr-FR", { weekday: "short" });
    } else {
      return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
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
          marginTop: "40px",
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
          marginTop: "40px",
          padding: "0 20px",
        }}
      >
      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          background: "rgba(30, 30, 30, 0.8)",
          borderRadius: "20px",
          padding: "25px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "25px",
            color: "#ffffff",
          }}
        >
          Messages
        </h1>

        {conversations.length === 0 && (
          <p style={{ color: "#bbb", textAlign: "center", marginTop: 30 }}>
            Aucune conversation.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          {conversations.map((conv) => {
            const displayUser = conv.other_user;

            return (
              <Link
                key={conv.id}
                href={`/messages/${conv.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "15px",
                  background: "rgba(20, 20, 20, 0.6)",
                  padding: "14px",
                  borderRadius: "14px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(30, 30, 30, 0.8)";
                  e.currentTarget.style.borderColor = "rgba(250, 204, 21, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(20, 20, 20, 0.6)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                }}
              >
                {displayUser?.avatar_url ? (
                  <img
                    src={displayUser.avatar_url}
                    alt={displayUser.pseudo ?? "Avatar"}
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

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <p
                      style={{
                        fontWeight: "600",
                        fontSize: "15px",
                        color: "#ffffff",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {displayUser?.pseudo ?? "Utilisateur inconnu"}
                    </p>

                    <span
                      style={{
                        fontSize: "11px",
                        color: "#aaa",
                        marginLeft: "8px",
                        flexShrink: 0,
                      }}
                    >
                      {formatDate(conv.updated_at)}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: "13px",
                      color: "#ddd",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {conv.last_message ?? "Nouvelle conversation"}
                  </p>
                </div>

                {conv.unread > 0 && (
                  <span
                    style={{
                      background: "#facc15",
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      fontSize: "11px",
                      fontWeight: "bold",
                      color: "#000",
                      flexShrink: 0,
                    }}
                  >
                    {conv.unread > 99 ? "99+" : conv.unread}
                  </span>
                )}
              </Link>
            );
          })}
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
