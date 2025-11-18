"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Profile = {
  id: string;
  pseudo: string;
  avatar_url: string | null;
};

export default function DiscoverPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, pseudo, avatar_url")
      .order("pseudo", { ascending: true });

    setUsers(data || []);
  };

  const filtered = users.filter((u) =>
    u.pseudo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 20, maxWidth: 700, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 20 }}>Découvrir</h1>

      {/* BARRE DE RECHERCHE */}
      <input
        type="text"
        placeholder="Rechercher un utilisateur..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 20,
          borderRadius: 8,
          border: "1px solid #444",
          background: "#111",
          color: "white",
        }}
      />

      {filtered.map((u) => (
        <Link
          href={`/profile/${u.id}`}
          key={u.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
            marginBottom: 10,
            background: "#111",
            border: "1px solid #333",
            borderRadius: 10,
            textDecoration: "none",
            color: "white",
          }}
        >
          {u.avatar_url ? (
            <img
              src={u.avatar_url}
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
                background: "#333",
                borderRadius: "50%",
              }}
            ></div>
          )}

          <strong>{u.pseudo}</strong>
        </Link>
      ))}
    </div>
  );
}
