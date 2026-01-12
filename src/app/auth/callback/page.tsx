"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AmbientGlow from "@/components/background/AmbientGlow";

// ✅ Force la page à être dynamique (pas de prerendering)
export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const hasProcessedRef = useRef(false);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (hasProcessedRef.current) return;

    // ✅ Vérifier les erreurs OAuth dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorParam = urlParams.get("error") || hashParams.get("error");
    const errorDescription = urlParams.get("error_description") || hashParams.get("error_description");

    if (errorParam) {
      const errorMsg = errorDescription || "Google authentication failed. Please try again.";
      hasProcessedRef.current = true;
      window.history.replaceState(null, "", window.location.pathname);
      router.replace(`/login?error=${encodeURIComponent(errorMsg)}`);
      return;
    }

    // ✅ Utiliser onAuthStateChange pour attendre la confirmation de session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (hasProcessedRef.current) return;

      try {
        if (event === "SIGNED_IN" && session?.user) {
          hasProcessedRef.current = true;
          
          // Nettoyer l'URL
          window.history.replaceState(null, "", window.location.pathname);
          
          if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
          }

          // ✅ Session OK → rediriger vers /feed
          router.replace("/feed");
        } else if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
          hasProcessedRef.current = true;
          setError("Authentication failed. Please try again.");
          window.history.replaceState(null, "", window.location.pathname);
          
          if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
          }
          
          router.replace(`/login?error=${encodeURIComponent("Google authentication failed. Please try again.")}`);
        }
      } catch (err) {
        console.error("Exception in auth callback:", err);
        hasProcessedRef.current = true;
        setError("An unexpected error occurred. Please try again.");
        window.history.replaceState(null, "", window.location.pathname);
        
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
        }
        
        router.replace(`/login?error=${encodeURIComponent("An error occurred. Please try again.")}`);
      }
    });

    subscriptionRef.current = subscription;

    // Cleanup
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
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