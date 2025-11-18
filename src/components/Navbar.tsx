"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const [logged, setLogged] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setLogged(true);
        setMyId(data.user.id);
      } else {
        setLogged(false);
        setMyId(null);
      }
    };

    checkUser();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setLogged(false);
    router.push("/login");
  };

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
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
      }}
    >
      {/* ---- Logo / Titre ---- */}
      <Link href="/feed" style={{ color: "white", fontSize: 22, fontWeight: 700 }}>
        SocialVD
      </Link>

      {/* ---- Liens centraux ---- */}
      {logged && (
        <div style={{ display: "flex", gap: 30, fontSize: 16 }}>
          <Link href="/feed" style={{ color: "white", textDecoration: "none" }}>
            Fil d’actualité
          </Link>
          <Link href="/explore" style={{ color: "white", textDecoration: "none" }}>
            Découvrir
          </Link>
        </div>
      )}

      {/* ---- Boutons droite ---- */}
      <div style={{ display: "flex", gap: 15 }}>
        {logged && myId ? (
          <>
            <Link href={`/profile/${myId}`}>
              <button
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  padding: "8px 14px",
                  borderRadius: 6,
                }}
              >
                Mon profil
              </button>
            </Link>

            <button
              onClick={logout}
              style={{
                background: "rgba(255, 0, 0, 0.8)",
                padding: "8px 14px",
                borderRadius: 6,
                color: "white",
                border: "none",
              }}
            >
              Se déconnecter
            </button>
          </>
        ) : (
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
