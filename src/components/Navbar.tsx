"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { BellIcon } from "@heroicons/react/24/outline";

export default function Navbar() {
  const router = useRouter();
  const [logged, setLogged] = useState<boolean | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Mates
  const [mateRequestsCount, setMateRequestsCount] = useState(0);

  // Messages
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // -------------------------------------------------------------
  // MARK AS SEEN
  // -------------------------------------------------------------
  const markNotificationsAsSeen = async () => {
    if (!myId) return;

    await supabase
      .from("notifications")
      .update({ seen: true })
      .eq("user_id", myId)
      .eq("seen", false);

    loadNotifications(myId);
    setUnreadCount(0);
  };

  // -------------------------------------------------------------
  // AUTH STATE
  // -------------------------------------------------------------
  const refreshAuthState = async () => {
    const { data } = await supabase.auth.getSession();

    if (data.session?.user) {
      setLogged(true);
      setMyId(data.session.user.id);
      localStorage.setItem("user_id", data.session.user.id);

      setupRealtime(data.session.user.id);
    } else {
      setLogged(false);
      setMyId(null);
      localStorage.removeItem("user_id");
    }
  };

  // OnAuthStateChange
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setLogged(true);
        setMyId(session.user.id);
        localStorage.setItem("user_id", session.user.id);

        setupRealtime(session.user.id);
      } else {
        setLogged(false);
        setMyId(null);
        localStorage.removeItem("user_id");
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // -------------------------------------------------------------
  // CLOSE POPOVER OUTSIDE CLICK
  // -------------------------------------------------------------
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, []);

  // -------------------------------------------------------------
  // LOAD NOTIFICATIONS
  // -------------------------------------------------------------
  const loadNotifications = async (userId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15);

    setNotifications(data || []);
    const unread = (data || []).filter((n) => !n.seen).length;
    setUnreadCount(unread);
  };

  // -------------------------------------------------------------
  // NAVBAR COUNTS
  // -------------------------------------------------------------
  const loadNavbarCounts = async (userId: string) => {
    // Messages
    const { data: conversations } = await supabase
      .from("conversations_users")
      .select("conversation_id")
      .eq("user_id", userId);

    const convIds = conversations?.map((c) => c.conversation_id) || [];

    if (convIds.length === 0) {
      setMessagesUnreadCount(0);
    } else {
      const { count: unreadMessages } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .neq("sender_id", userId)
        .eq("seen", false);

      setMessagesUnreadCount(unreadMessages || 0);
    }

    // Mate requests
    const { count: mateRequests } = await supabase
      .from("mate_requests")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", userId)
      .eq("status", "pending");

    setMateRequestsCount(mateRequests || 0);
  };

  // -------------------------------------------------------------
  // REALTIME — notifications + messages + mate_requests
  // -------------------------------------------------------------
  const setupRealtime = (userId: string) => {
    console.log("📡 Realtime activated for:", userId);

    supabase
      .channel(`navbar-realtime-${userId}`)

      // Messages
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => loadNavbarCounts(userId)
      )

      // Mate requests
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mate_requests" },
        () => loadNavbarCounts(userId)
      )

      // Notifications
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          console.log("🔔 realtime notifications change:", payload);
          loadNotifications(userId);
        }
      )

      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("🔄 Realtime SUBSCRIBED for", userId);
        }
      });
  };

  // -------------------------------------------------------------
  // INITIAL AUTH LOAD
  // -------------------------------------------------------------
  useEffect(() => {
    (async () => {
      await refreshAuthState();
    })();

    const handler = () => refreshAuthState();
    window.addEventListener("authChanged", handler);

    return () => window.removeEventListener("authChanged", handler);
  }, []);

  // -------------------------------------------------------------
  // LOAD COUNTERS & NOTIFS WHEN myId AVAILABLE
  // -------------------------------------------------------------
  useEffect(() => {
    if (!myId) return;

    loadNotifications(myId);
    loadNavbarCounts(myId);
  }, [myId]);

  // -------------------------------------------------------------
  // LOGOUT
  // -------------------------------------------------------------
  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("user_id");

    window.dispatchEvent(new Event("authChanged"));
    router.push("/login");
  };

  if (logged === null) return null;

  // -------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------
  return (
    <nav
      style={{
        width: "100%",
        padding: "15px 30px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 1000,
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
      }}
    >
      {/* Logo */}
      <Link href="/feed" style={{ color: "white", fontSize: 22, fontWeight: 700 }}>
        SocialVD
      </Link>

      {/* Middle links */}
      {logged && (
        <div style={{ display: "flex", gap: 30 }}>
          <Link href="/feed" style={{ color: "white" }}>
            News Feed
          </Link>
          <Link href="/explore" style={{ color: "white" }}>
            Explore
          </Link>
        </div>
      )}

      {/* Right side */}
      <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
        {logged && myId && (
          <>
            {/* 🔔 Notifications */}
            <div style={{ position: "relative" }} ref={popoverRef}>
              <button
                onClick={() => {
                  const newState = !popoverOpen;
                  setPopoverOpen(newState);

                  if (!popoverOpen) {
                    markNotificationsAsSeen();
                  }
                }}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  padding: 8,
                  borderRadius: "50%",
                }}
              >
                <BellIcon width={24} height={24} color="white" />

                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      background: "red",
                      color: "white",
                      fontSize: 11,
                      padding: "2px 5px",
                      borderRadius: 999,
                      fontWeight: 700,
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {popoverOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 45,
                    width: 280,
                    background: "rgba(20,20,26,0.92)",
                    backdropFilter: "blur(16px)",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.15)",
                    padding: "10px 0",
                    boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
                  }}
                >
                  <div style={{ padding: "6px 14px", fontSize: 14, opacity: 0.7 }}>
                    Notifications
                  </div>

                  {notifications.length === 0 && (
                    <div style={{ padding: 14, color: "#ccc", fontSize: 14 }}>
                      No notifications
                    </div>
                  )}

                  {notifications.slice(0, 6).map((notif) => (
                    <div
                      key={notif.id}
                      style={{
                        padding: "10px 14px",
                        fontSize: 14,
                        borderBottom: "1px solid rgba(255,255,255,0.07)",
                        background: notif.seen
                          ? "transparent"
                          : "rgba(255,255,255,0.05)",
                      }}
                    >
                      {notif.message}
                    </div>
                  ))}

                  <Link
                    href="/notifications"
                    style={{
                      display: "block",
                      padding: 12,
                      textAlign: "center",
                      fontSize: 14,
                      color: "#9bb7ff",
                    }}
                  >
                    View all
                  </Link>
                </div>
              )}
            </div>

            {/* 💬 Messages */}
            <Link href="/messages">
              <button
                style={{
                  position: "relative",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  color: "white",
                }}
              >
                Messages

                {messagesUnreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      background: "red",
                      color: "white",
                      fontSize: 11,
                      padding: "2px 6px",
                      borderRadius: 999,
                      fontWeight: 700,
                    }}
                  >
                    {messagesUnreadCount}
                  </span>
                )}
              </button>
            </Link>

            {/* Profile */}
            <Link href={`/profile/${myId}`}>
              <button
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  color: "white",
                }}
              >
                My profile
              </button>
            </Link>

            {/* Logout */}
            <button
              onClick={logout}
              style={{
                background: "rgba(255, 0, 0, 0.8)",
                padding: "8px 14px",
                borderRadius: 6,
                color: "white",
              }}
            >
              Log out
            </button>
          </>
        )}

        {!logged && (
          <>
            <Link href="/login">
              <button>Login</button>
            </Link>
            <Link href="/signup">
              <button
                style={{
                  background: "#1a73e8",
                  padding: "8px 14px",
                  borderRadius: 6,
                  color: "white",
                }}
              >
                Sign up
              </button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
