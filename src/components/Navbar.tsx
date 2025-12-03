"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import { BellIcon } from "@heroicons/react/24/outline";

type NotificationRow = {
  id: string;
  message: string | null;
  type: string | null;
  seen: boolean;
  created_at: string;
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  // --- CITATIONS (3 x 16h rotation) --- 11111111111
  const quotes = [
    "“You can’t move the zone, but you can make sure it moves for you.”",
    "“In ranked, hesitation costs more than defeat.”",
    "“Grind now. Glory later.”",
  ];

  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    // 16h = 57600000 ms
    const interval = 16 * 60 * 60 * 1000;

    // On stocke un index persistant
    const savedIndex = localStorage.getItem("daily_quote_index");
    const savedTime = localStorage.getItem("daily_quote_timestamp");
    const now = Date.now();

    if (savedIndex && savedTime) {
      const idx = parseInt(savedIndex, 10);
      const lastChange = parseInt(savedTime, 10);

      // Si 16h se sont écoulées → on passe à la suivante
      if (now - lastChange >= interval) {
        const nextIndex = (idx + 1) % quotes.length;
        setQuoteIndex(nextIndex);
        localStorage.setItem("daily_quote_index", String(nextIndex));
        localStorage.setItem("daily_quote_timestamp", String(now));
      } else {
        setQuoteIndex(idx);
      }
    } else {
      // Première visite
      localStorage.setItem("daily_quote_index", "0");
      localStorage.setItem("daily_quote_timestamp", String(now));
      setQuoteIndex(0);
    }
  }, []);

  // --- AUTH / NOTIFS ---
  const [logged, setLogged] = useState<boolean | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0);

  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        setLogged(false);
        setMyId(null);
        return;
      }

      setLogged(true);
      setMyId(user.id);

      await Promise.all([
        loadNotifications(user.id),
        loadNavbarCounts(user.id),
      ]);
    };

    load();
  }, []);

  const loadNotifications = async (userId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("id, message, type, seen, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15);

    const rows = (data || []) as NotificationRow[];
    setNotifications(rows);
    setUnreadNotifCount(rows.filter((n) => !n.seen).length);
  };

  const markAllNotificationsAsSeen = async () => {
    if (!myId) return;

    await supabase
      .from("notifications")
      .update({ seen: true })
      .eq("user_id", myId)
      .eq("seen", false);

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, seen: true }))
    );

    setUnreadNotifCount(0);
  };

  const loadNavbarCounts = async (userId: string) => {
    const { data: conversations } = await supabase
      .from("conversations_users")
      .select("conversation_id")
      .eq("user_id", userId);

    const convIds = conversations?.map((c) => c.conversation_id) || [];

    if (!convIds.length) {
      setMessagesUnreadCount(0);
      return;
    }

    const { count: unreadMessages } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .neq("sender_id", userId)
      .eq("seen", false);

    setMessagesUnreadCount(unreadMessages || 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!notifRef.current) return;
      if (!notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  return (
    <>
      <nav className="navbar-glass">
        <div className="nav-inner">

          {/* LEFT SIDE */}
          <div className="nav-left">
            <Link href="/feed" className="nav-btn logo-btn">
              SocialVD
            </Link>

            <Link href="/feed" className="nav-btn">
              News Feed
            </Link>

            <Link href="/explore" className="nav-btn">
              Explore
            </Link>

            {/* --- DAILY QUOTE (ONLY ON /feed) --- */}
            {pathname === "/feed" && (
              <span
                style={{
                  fontStyle: "italic",
                  opacity: 0.9,
                  color: "#d5d7ec",
                  fontSize: "0.82rem",
                  marginLeft: "14px",
                }}
              >
                {quotes[quoteIndex]}
              </span>
            )}
          </div>

          {/* RIGHT SIDE */}
          <div className="nav-right">
            {logged && (
              <>
                {/* Notification Bell */}
                <div className="notif-wrapper" ref={notifRef}>
                  <button
                    className="nav-btn icon-btn"
                    onClick={() =>
                      setShowNotifications((s) => !s)
                    }
                  >
                    <BellIcon className="icon-20" />
                    {unreadNotifCount > 0 && (
                      <span className="notif-dot">
                        {unreadNotifCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="notif-dropdown">
                      <div className="notif-header">
                        <span>Notifications</span>
                        {unreadNotifCount === 0 && (
                          <span className="notif-subtitle">
                            All caught up
                          </span>
                        )}
                      </div>

                      <div className="notif-list">
                        {notifications.length === 0 && (
                          <p className="notif-empty">No notifications yet.</p>
                        )}

                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`notif-row ${
                              n.seen
                                ? "notif-seen"
                                : "notif-unseen"
                            }`}
                          >
                            <p className="notif-text">
                              {n.message ||
                                "New activity on your account"}
                            </p>
                            <span className="notif-type">{n.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Messages */}
                <Link href="/messages" className="nav-btn">
                  Messages
                  {messagesUnreadCount > 0 && (
                    <span className="notif-dot">
                      {messagesUnreadCount}
                    </span>
                  )}
                </Link>

                {/* Profile */}
                {myId && (
                  <Link href={`/profile/${myId}`} className="nav-btn">
                    My profile
                  </Link>
                )}

                {/* Log out */}
                <button
                  className="nav-btn"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* STYLES BELOW (UNTOUCHED EXCEPT FOR ITALICS TEXT STYLE ABOVE) */}
      <style jsx>{`
        .navbar-glass {
          position: sticky;
          top: 0;
          z-index: 50;
          width: 100%;
          padding: 6px 0;
          backdrop-filter: blur(14px);
        }

        .nav-inner {
          max-width: 1150px;
          margin: 0 auto;
          padding: 8px 12px;

          display: flex;
          justify-content: space-between;
          align-items: center;

          background: rgba(15, 15, 20, 0.50);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.55);
        }

        .nav-left,
        
        .nav-right {
          display: flex;
          align-items: center;
          gap: 26px;
        }

        .nav-btn {
          font-family: "Space Grotesk", sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 6px;

          padding: 6px 12px;
          border-radius: 8px;

          background: rgba(32,32,40,0.90);
          border: 1px solid rgba(255,255,255,0.10);
          color: #f5f6ff;

          font-size: 0.84rem;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;

          transition:
            background .22s ease,
            border-color .22s ease,
            transform .22s ease,
            color .22s ease,
            box-shadow .22s ease;
        }

        .nav-btn::after {
          content: "";
          position: absolute;
          top: 0;
          left: -11155;
          width: 60%;
          height: 100%;
          background: linear-gradient(120deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.12) 50%,
            rgba(255,255,255,0) 100%
          );
          transition: transform 0.35s ease;
        }

        .nav-btn:hover::after {
          transform: translateX(200%);
        }

        .nav-btn:hover {
          background: rgba(50,52,65,0.95);
          border-color: rgba(255,255,255,0.18);
          color: #ffffff;
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 0 18px rgba(255,255,255,0.12);
        }

        .logo-btn {
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .icon-btn {
          padding: 6px;
          width: 34px;
          height: 34px;
          justify-content: center;
        }

        .icon-20 {
          width: 20px;
          height: 20px;
          color: #f5f6ff;
        }

        .notif-dot {
          position: absolute;
          top: -4px;
          right: -4px;

          background: rgba(80,80,95,0.95);
          padding: 0px 6px;
          border-radius: 999px;

          color: white;
          font-size: 0.68rem;
          font-weight: 600;

          border: 1px solid rgba(255,255,255,0.20);
        }

        .notif-wrapper {
          position: relative;
        }

        .notif-dropdown {
          position: absolute;
          right: 0;
          top: 42px;

          width: 260px;

          background: rgba(22,22,30,0.92);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.10);

          border-radius: 12px;
          padding: 10px 0;
          box-shadow: 0 14px 28px rgba(0,0,0,0.55);
          animation: fadeInScale .15s ease-out;
        }

        .notif-header {
          padding: 6px 14px 10px;
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .notif-header span:first-of-type {
          font-size: 0.85rem;
          font-weight: 600;
          color: #ffffff;
        }

        .notif-subtitle {
          font-size: 0.75rem;
          color: #bfc1e9;
        }

        .notif-list {
          max-height: 240px;
          overflow-y: auto;
        }

        .notif-empty {
          padding: 14px;
          color: #d0d1f0;
          opacity: 0.75;
          font-size: 0.82rem;
        }

        .notif-row {
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .notif-unseen {
          background: rgba(30,30,40,0.90);
        }

        .notif-seen {
          background: transparent;
        }

        .notif-text {
          margin-bottom: 3px;
        }

        .notif-type {
          font-size: 0.72rem;
          color: #b8bad8;
        }

        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(-3px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </>
  );
}
