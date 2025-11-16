"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user || null);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "15px 25px",
        borderBottom: "1px solid #333",
        background: "#0f0f0f",
        color: "white",
      }}
    >
      <Link href="/feed" style={{ fontSize: 20, fontWeight: "bold" }}>
        SOCIALVD
      </Link>

      <div style={{ display: "flex", gap: 20 }}>
        <Link href="/feed">Feed</Link>
        {user && <Link href="/profile">Profil</Link>}

        {!user && (
          <>
            <Link href="/signup">Inscription</Link>
            <Link href="/login">Connexion</Link>
          </>
        )}

        {user && (
          <button
            onClick={logout}
            style={{
              background: "crimson",
              border: "none",
              padding: "6px 12px",
              color: "white",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Déconnexion
          </button>
        )}
      </div>
    </nav>
  );
}
