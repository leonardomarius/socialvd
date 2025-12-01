"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Notification = {
  id: string;
  user_id: string;
  from_user_id: string | null;
  type: string;
  message: string;
  post_id?: string | null;
  seen: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user
  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    if (!userId) return;
    setMyId(userId);
  }, []);

  // Load notifications
  useEffect(() => {
    if (!myId) return;

    const load = async () => {
      setLoading(true);

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", myId)
        .order("created_at", { ascending: false });

      setNotifications(data || []);
      setLoading(false);

      // Mark as seen
      await supabase
        .from("notifications")
        .update({ seen: true })
        .eq("user_id", myId)
        .eq("seen", false);
    };

    load();
  }, [myId]);

  return (
    <div className="notif-container">
      <h1 className="notif-title">Notifications</h1>

      {loading && (
        <div className="notif-loading">Loading...</div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="notif-empty">
          🎉 No notifications yet.
        </div>
      )}

      <div className="notif-list">
        {notifications.map((notif) => (
          <div key={notif.id} className="notif-card">
            <div className="notif-message">{notif.message}</div>

            {notif.post_id && (
              <Link href={`/post/${notif.post_id}`} className="notif-link">
                View post →
              </Link>
            )}

            <div className="notif-date">
              {new Date(notif.created_at).toLocaleString("en-US")}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .notif-container {
          max-width: 700px;
          margin: 0 auto;
          padding: 24px;
          color: #f5f5f5;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .notif-title {
          font-size: 1.7rem;
          font-weight: 600;
          margin-bottom: 20px;
        }

        .notif-loading,
        .notif-empty {
          margin-top: 30px;
          text-align: center;
          color: #aaa;
          font-size: 1rem;
        }

        .notif-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 10px;
        }

        .notif-card {
          background: rgba(15, 15, 22, 0.9);
          border-radius: 14px;
          border: 1px solid rgba(90, 90, 120, 0.35);
          padding: 16px;
          backdrop-filter: blur(12px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
          transition: transform 0.12s ease, background 0.12s ease;
        }

        .notif-card:hover {
          background: rgba(25, 25, 35, 0.95);
          transform: translateY(-2px);
        }

        .notif-message {
          font-size: 1rem;
          margin-bottom: 6px;
        }

        .notif-link {
          font-size: 0.85rem;
          color: #9ebbff;
          text-decoration: none;
        }

        .notif-link:hover {
          text-decoration: underline;
        }

        .notif-date {
          font-size: 0.75rem;
          opacity: 0.7;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}
