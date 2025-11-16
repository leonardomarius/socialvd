"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  // Vérifie si un utilisateur est connecté
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
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
      {/* Logo */}
      <Link href="/feed" style={{ fontSize: 20, fontWeight: "bold" }}>
        SOCIALVD
      </Link>

      {/* Liens */}
      <div style={{ display: "flex", gap: "20px" }}>
        <Link href="/feed">Feed</Link>
        <Link href="/profile">Profil</Link>

        {/* Si pas connecté → Signup / Login */}
        {!user && (
          <>
            <Link href="/signup">Inscription</Link>
            <Link href="/login">Connexion</Link>
          </>
        )}

        {/* Si connecté → Logout */}
        {user && (
          <button
            onClick={handleLogout}
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
