"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Profile = {
  id: string;
  pseudo: string;
  avatar_url: string | null;
};

export default function FollowersPage({ params }: any) {
  const { id } = use(params) as { id: string };

  const [users, setUsers] = useState<Profile[]>([]);

  useEffect(() => {
    loadFollowers();
  }, [id]);

  const loadFollowers = async () => {
    // 1) récupérer les follower_id
    const { data: follows, error } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", id);

    if (error || !follows) return;

    const ids = follows.map((f) => f.follower_id);
    if (ids.length === 0) return;

    // 2) récupérer les profils correspondants
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", ids);

    setUsers(profiles || []);
  };

  return (
    <div>
      <h1 style={{ marginBottom: 20 }}>Abonnés</h1>

      {users.length === 0 && <p>Aucun abonné.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
       {users.map((u) => (
  <Link
    key={u.id}
    href={`/profile/${u.id}`}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: 12,
      border: "1px solid #222",
      borderRadius: 8,
      background: "#111",
      textDecoration: "none",
      color: "white",
    }}
  >
    {/* Avatar */}
    {u.avatar_url ? (
      <img
        src={u.avatar_url}
        alt="avatar"
        style={{
          width: 45,
          height: 45,
          borderRadius: "50%",
          objectFit: "cover",
        }}
      />
    ) : (
      <div
        style={{
          width: 45,
          height: 45,
          borderRadius: "50%",
          background: "#333",
        }}
      ></div>
    )}

    {/* Pseudo */}
    <strong>{u.pseudo}</strong>
  </Link>
))}
      </div>
    </div>
  );
}
