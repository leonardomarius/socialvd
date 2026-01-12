"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AmbientGlow from "@/components/background/AmbientGlow";

// ✅ Force la page à être dynamique (pas de prerendering)
export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // ✅ Avec detectSessionInUrl: true, Supabase traite automatiquement le hash au chargement
        // On attend un peu pour que Supabase ait le temps de traiter le hash
        await new Promise((resolve) => setTimeout(resolve, 100));

        // ✅ Appeler getSession() pour vérifier la session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        // ✅ Nettoyer l'URL après avoir récupéré la session (supprimer tout #access_token)
        if (typeof window !== "undefined" && window.location.hash) {
          window.history.replaceState(null, "", window.location.pathname);
        }

        if (sessionError) {
          console.error("Session error:", sessionError);
          setError("Authentication failed");
          setTimeout(() => {
            router.replace("/login");
          }, 2000);
          return;
        }

        if (!session || !session.user) {
          setError("No session found");
          setTimeout(() => {
            router.replace("/login");
          }, 2000);
          return;
        }

        // ✅ Session OK → rediriger vers /
        router.replace("/");
      } catch (err) {
        console.error("Exception in auth callback:", err);
        setError("An unexpected error occurred");
        setTimeout(() => {
          router.replace("/login");
        }, 2000);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#1a1a1a",
      }}
    >
      <AmbientGlow />
      <main
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "400px",
          width: "100%",
          margin: "60px auto",
          padding: "40px",
          textAlign: "center",
          color: "#ffffff",
        }}
      >
        {error ? (
          <>
            <h1 style={{ marginBottom: 20, fontSize: "1.5rem", fontWeight: 700, color: "#f87171" }}>
              Authentication Error
            </h1>
            <p style={{ marginBottom: 20, fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.7)" }}>
              {error}
            </p>
            <p style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)" }}>
              Redirecting...
            </p>
          </>
        ) : (
          <>
            <h1 style={{ marginBottom: 20, fontSize: "1.5rem", fontWeight: 700 }}>
              Authenticating...
            </h1>
            <p style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.7)" }}>
              Please wait while we complete your authentication.
            </p>
          </>
        )}
      </main>
    </div>
  );
}