"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const [userId, setUserId] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const id = localStorage.getItem("user_id");
    const p = localStorage.getItem("pseudo");

    setUserId(id);
    setPseudo(p);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();

    if (typeof window !== "undefined") {
      localStorage.removeItem("user_id");
      localStorage.removeItem("pseudo");
    }

    // 🔥 Met à jour immédiatement la navbar
    setUserId(null);
    setPseudo(null);

    // 🔥 Redirige vers la bonne page (dit-moi laquelle tu préfères !)
    router.push("/login");
  };

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 20px",
        borderBottom: "1px solid #ddd",
        marginBottom: "10px",
      }}
    >
      {/* Gauche : liens */}
      <div style={{ display: "flex", gap: "15px" }}>
        <Link href="/feed">Feed</Link>

        {userId && (
          <Link href={`/profile/${userId}`}>
            Profil
          </Link>
        )}
      </div>

      {/* Droite : état connexion */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        {userId ? (
          <>
            <span>Connecté : {pseudo}</span>
            <button
              onClick={handleLogout}
              style={{
                padding: "5px 10px",
                background: "black",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Se déconnecter
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Se connecter</Link>
            <Link href="/signup">S’inscrire</Link>
          </>
        )}
      </div>
    </nav>
  );
}
