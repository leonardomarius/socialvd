"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AmbientGlow from "@/components/background/AmbientGlow";

// ✅ Client Component qui utilise useSearchParams() - doit être dans Suspense
export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const hasProcessedRef = useRef(false); // ✅ Garde persistante contre les traitements multiples
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (hasProcessedRef.current) return; // ✅ Ne traiter qu'une seule fois

    const handleCallback = async () => {
      // ✅ Vérifier les erreurs OAuth dans les query params OU le hash
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");
      
      // Vérifier aussi dans le hash (format: #error=...&error_description=...)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashError = hashParams.get("error");
      const hashErrorDesc = hashParams.get("error_description");

      // Si erreur OAuth depuis Google (query params ou hash)
      if (errorParam || hashError) {
        const errorMsg = errorDescription || hashErrorDesc || "Google authentication failed. Please try again.";
        hasProcessedRef.current = true;
        // Nettoyer le hash/query params avant redirection
        window.history.replaceState(null, "", window.location.pathname);
        router.replace(`/login?error=${encodeURIComponent(errorMsg)}`);
        return;
      }

      // ✅ Utiliser onAuthStateChange pour attendre la confirmation de session
      // Cela garantit que la session est bien établie après le traitement du hash OAuth
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (hasProcessedRef.current) return;

        try {
          // ✅ Attendre l'événement SIGNED_IN qui confirme la session
          if (event === "SIGNED_IN" && session?.user) {
            hasProcessedRef.current = true;

            // ✅ Nettoyer le hash de l'URL immédiatement après confirmation
            window.history.replaceState(null, "", window.location.pathname);

            const userId = session.user.id;

            // Chercher le profil dans public.profiles
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("profile_completed")
              .eq("id", userId)
              .maybeSingle();

            // Si erreur de lecture (pas juste "pas trouvé")
            if (profileError && profileError.code !== "PGRST116") {
              console.error("Error fetching profile:", profileError);
              setError("Database error. Please try again.");
              setTimeout(() => {
                router.replace("/login?error=" + encodeURIComponent("An error occurred. Please try again."));
              }, 3000);
              if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
              }
              return;
            }

            // Si aucune ligne de profil existe, créer une ligne avec profile_completed = false
            if (!profile) {
              const { error: insertError } = await supabase
                .from("profiles")
                .insert({
                  id: userId,
                  profile_completed: false,
                });

              if (insertError) {
                console.error("Error creating profile:", insertError);
                setError("Failed to create profile. Please try again.");
                setTimeout(() => {
                  router.replace("/login?error=" + encodeURIComponent("An error occurred. Please try again."));
                }, 3000);
                if (subscriptionRef.current) {
                  subscriptionRef.current.unsubscribe();
                }
                return;
              }

              // Profil créé avec profile_completed = false → rediriger vers /signup/complete
              if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
              }
              router.replace("/signup/complete");
              return;
            }

            // Profil existe, vérifier profile_completed
            if (profile.profile_completed === false) {
              // Profil incomplet → rediriger vers /signup/complete
              if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
              }
              router.replace("/signup/complete");
              return;
            }

            // Profil complet → rediriger vers /
            if (subscriptionRef.current) {
              subscriptionRef.current.unsubscribe();
            }
            router.replace("/");
          } else if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
            // Session invalide ou expirée
            hasProcessedRef.current = true;
            setError("Authentication failed. Please try again.");
            window.history.replaceState(null, "", window.location.pathname);
            setTimeout(() => {
              router.replace("/login?error=" + encodeURIComponent("Google authentication failed. Please try again."));
            }, 3000);
            if (subscriptionRef.current) {
              subscriptionRef.current.unsubscribe();
            }
          }
        } catch (err) {
          console.error("Exception in auth callback:", err);
          hasProcessedRef.current = true;
          setError("An unexpected error occurred. Please try again.");
          window.history.replaceState(null, "", window.location.pathname);
          setTimeout(() => {
            router.replace("/login?error=" + encodeURIComponent("An error occurred. Please try again."));
          }, 3000);
          if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
          }
        }
      });

      subscriptionRef.current = subscription;

      // ✅ Timeout de sécurité : si aucune session après 10 secondes, considérer comme échec
      const timeoutId = setTimeout(() => {
        if (!hasProcessedRef.current) {
          hasProcessedRef.current = true;
          setError("Authentication timeout. Please try again.");
          window.history.replaceState(null, "", window.location.pathname);
          setTimeout(() => {
            router.replace("/login?error=" + encodeURIComponent("Authentication timeout. Please try again."));
          }, 3000);
          if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
          }
        }
      }, 10000);

      // ✅ Cleanup
      return () => {
        clearTimeout(timeoutId);
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
        }
      };
    };

    handleCallback();
  }, [router, searchParams]); // ✅ Pas besoin de hasProcessed dans les dépendances (utilise useRef)

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
