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
  const [error, setError] = useState<string | null>(null);

  // ✅ Main loading function avec gestion d'erreur explicite
  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        router.push("/login");
        return;
      }

      const userId = sessionData.session.user.id;
      setMyId(userId);

    // 🔥 Filter conversations_users by current user FIRST
    const { data: convUsers } = await supabase
      .from("conversations_users")
      .select("conversation_id")
      .eq("user_id", userId);

    const convIds = Array.from(
      new Set(convUsers?.map((c) => c.conversation_id) ?? [])
    );

      if (convIds.length === 0) {
        setConversations([]);
        setLoading(false);
        setError(null);
        return;
      }

      const { data: convs, error: convsError } = await supabase
        .from("conversations")
        .select("*")
        .in("id", convIds)
        .order("updated_at", { ascending: false });

      if (convsError) {
        console.error("Error fetching conversations:", convsError);
        setError("Failed to load conversations. Please try again.");
        setLoading(false);
        return;
      }

      // ✅ Fetch all participants for all conversations
      const { data: participants, error: participantsError } = await supabase
        .from("conversations_users")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds);

      if (participantsError) {
        console.error("Error fetching participants:", participantsError);
        setError("Failed to load conversation participants. Please try again.");
        setLoading(false);
        return;
      }

    // 🔥 Build a map: conversation_id -> other_user_id
    // For each conversation, find the user who is NOT the current user
    const conversationToOtherUser: Record<string, string> = {};
    
    // Group participants by conversation
    const participantsByConv: Record<string, string[]> = {};
    (participants ?? []).forEach((p) => {
      if (!participantsByConv[p.conversation_id]) {
        participantsByConv[p.conversation_id] = [];
      }
      participantsByConv[p.conversation_id].push(p.user_id);
    });

    // For each conversation, find the other user
    Object.keys(participantsByConv).forEach((convId) => {
      const userIds = participantsByConv[convId];
      const otherUser = userIds.find((uid) => uid !== userId);
      if (otherUser) {
        conversationToOtherUser[convId] = otherUser;
      }
    });

    // 🔥 Get unique other user IDs
    const otherIds = Array.from(
      new Set(Object.values(conversationToOtherUser).filter(Boolean))
    );

    // 🔥 Fetch profiles (only if we have IDs)
    const profilesMap: Record<string, UserProfile> = {};
    if (otherIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, pseudo, avatar_url")
        .in("id", otherIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      } else if (profiles) {
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

    // 🔥 Get the ACTUAL last message
    const lastMessages: Record<string, string | null> = {};

    for (const convId of convIds) {
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      lastMessages[convId] = lastMsg?.content ?? null;
    }

    // 🔥 Map conversations with correct profile lookup
    const fullConvs: Conversation[] = (convs ?? []).map((conv) => {
      const otherUserId = conversationToOtherUser[conv.id];
      const profileData = otherUserId ? profilesMap[otherUserId] : null;
      const otherUser: UserProfile | null = profileData || null;

      return {
        id: conv.id,
        last_message: lastMessages[conv.id],
        updated_at: conv.updated_at,
        other_user: otherUser,
        unread: unreadCount[conv.id] ?? 0,
      };
    });

      setConversations(fullConvs);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Exception in load:", err);
      setError("An unexpected error occurred. Please refresh the page.");
      setLoading(false);
    }
  };

  // ✅ Initial load avec cleanup
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await load();
      if (!mounted) return;
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

    // 🔥 REALTIME watch messages → reload UNIQUEMENT quand je suis loggé
  useEffect(() => {
    if (!myId) return;

    const channel = supabase
      .channel("messages-list-" + myId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          // on s'intéresse surtout aux messages reçus,
          // mais RLS filtrera de toute façon
          filter: `sender_id=neq.${myId}`,
        },
        () => {
          load();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `sender_id=neq.${myId}`,
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId]);


  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });

  // ✅ État de chargement explicite
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
        <div
          style={{
            width: "100%",
            maxWidth: "700px",
            background: "rgba(0,0,0,0.80)",
            borderRadius: "20px",
            padding: "25px",
            border: "1px solid rgba(255,255,255,0.15)",
            textAlign: "center",
          }}
        >
          <p style={{ color: "white", opacity: 0.7 }}>Loading conversations...</p>
        </div>
      </div>
    );
  }

  // ✅ État d'erreur explicite
  if (error) {
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
            background: "rgba(0,0,0,0.80)",
            borderRadius: "20px",
            padding: "25px",
            border: "1px solid rgba(255,255,255,0.15)",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#f87171", marginBottom: "16px" }}>{error}</p>
          <button
            onClick={() => {
              setError(null);
              load();
            }}
            style={{
              padding: "8px 16px",
              background: "rgba(30, 30, 30, 0.8)",
              border: "1px solid rgba(100, 100, 100, 0.3)",
              borderRadius: "6px",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
          background: "rgba(0,0,0,0.80)",
          borderRadius: "20px",
          padding: "25px",
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: "0 0 35px rgba(0,0,0,0.6)",
        }}
      >
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
            No conversations yet.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          {conversations.map((conv) => {
  // 🔥 Resolve display user safely at render time
  const otherUserId =
    conv.other_user?.id ??
    null;

  const displayUser =
    otherUserId && conv.other_user
      ? conv.other_user
      : conv.other_user;

  return (
    <Link
      key={conv.id}
      href={`/messages/${conv.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "15px",
        background: "rgba(20,20,20,0.9)",
        padding: "14px",
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,0.1)",
        textDecoration: "none",
        transition: "0.2s",
      }}
    >

              <Image
  src={displayUser?.avatar_url || "/default-avatar.png"}
  width={50}
  height={50}
  alt={displayUser?.pseudo ?? "User avatar"}
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
                    {displayUser?.pseudo ?? "Unknown user"}
                  </p>

                  <span style={{ fontSize: "11px", color: "#aaa" }}>
                    {formatDate(conv.updated_at)}
                  </span>
                </div>

                <p style={{ fontSize: "13px", color: "#ddd" }}>
                  {conv.last_message ?? "New conversation"}
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
          )})}
        </div>
      </div>
    </div>
  );
}
