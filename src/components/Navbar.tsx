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
  const [popoverOpen, setPopoverOpen] = useState(false);

  const popoverRef = useRef<HTMLDivElement | null>(null);

  // ✔️ Vérifie l’auth Supabase
  const refreshAuthState = async () => {
    const { data } = await supabase.auth.getUser();

    if (data.user) {
      setLogged(true);
      setMyId(data.user.id);
      localStorage.setItem("user_id", data.user.id);
    } else {
      setLogged(false);
      setMyId(null);
      localStorage.removeItem("user_id");
    }
  };

  // Fermer popover si clic extérieur
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, []);

  // Charger notifications
  const loadNotifications = async (userId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15);

    setNotifications(data || []);
    const unread = (data || []).filter((n) => n.seen === false).length;
    setUnreadCount(unread);
  };

  // Supabase realtime notifications
  const setupRealtime = (userId: string) => {
    supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          await loadNotifications(userId);
        }
      )
      .subscribe();
  };

  useEffect(() => {
    (async () => {
      await refreshAuthState();
    })();

    const handler = () => refreshAuthState();
    window.addEventListener("authChanged", handler);

    return () => window.removeEventListener("authChanged", handler);
  }, []);

  useEffect(() => {
    if (!myId) return;
    loadNotifications(myId);
    setupRealtime(myId);
  }, [myId]);

  // Déconnexion
  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("user_id");

    window.dispatchEvent(new Event("authChanged"));
    router.push("/login");
  };

  if (logged === null) return null;

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

      {/* Liens milieu */}
      {logged && (
        <div style={{ display: "flex", gap: 30 }}>
          <Link href="/feed" style={{ color: "white" }}>
            Fil d’actualité
          </Link>
          <Link href="/explore" style={{ color: "white" }}>
            Découvrir
          </Link>
        </div>
      )}

      {/* Droite */}
      <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
        {logged && myId && (
          <>
            {/* 🔔 Notifications */}
            <div style={{ position: "relative" }} ref={popoverRef}>
              <button
                onClick={() => setPopoverOpen(!popoverOpen)}
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

              {/* Popover */}
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
                      Aucune notification
                    </div>
                  )}

                  {notifications.slice(0, 6).map((notif) => (
                    <div
                      key={notif.id}
                      style={{
                        padding: "10px 14px",
                        fontSize: 14,
                        borderBottom: "1px solid rgba(255,255,255,0.07)",
                        background: notif.seen ? "transparent" : "rgba(255,255,255,0.05)",
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
                    Voir tout
                  </Link>
                </div>
              )}
            </div>

            {/* 💬 Messages privés */}
            <Link href="/messages">
              <button
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  color: "white",
                }}
              >
                Messages
              </button>
            </Link>

            {/* Profil */}
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
                Mon profil
              </button>
            </Link>

            {/* Déconnexion */}
            <button
              onClick={logout}
              style={{
                background: "rgba(255, 0, 0, 0.8)",
                padding: "8px 14px",
                borderRadius: 6,
                color: "white",
              }}
            >
              Se déconnecter
            </button>
          </>
        )}

        {/* NON connecté */}
        {!logged && (
          <>
            <Link href="/login">
              <button>Connexion</button>
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
                Inscription
              </button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
