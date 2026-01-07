"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AmbientGlow from "@/components/background/AmbientGlow";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [hasProcessed, setHasProcessed] = useState(false); // ✅ Garde contre les traitements multiples

  useEffect(() => {
    if (hasProcessed) return; // ✅ Ne traiter qu'une seule fois

    const handleCallback = async () => {
      setHasProcessed(true); // ✅ Marquer comme traité immédiatement
      try {
        // Récupérer les paramètres de l'URL
        const errorParam = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        // Si erreur OAuth depuis Google
        if (errorParam) {
          const errorMsg = errorDescription || "Google authentication failed. Please try again.";
          router.replace(`/login?error=${encodeURIComponent(errorMsg)}`);
          return;
        }

        // Attendre que Supabase détecte automatiquement la session depuis l'URL
        // (detectSessionInUrl: true dans la config Supabase)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Récupérer la session (Supabase a déjà traité les tokens de l'URL)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          setError("Failed to authenticate. Please try again.");
          setTimeout(() => {
            router.replace("/login?error=" + encodeURIComponent("Google authentication failed. Please try again."));
          }, 3000);
          return;
        }

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
            return;
          }

          // Profil créé avec profile_completed = false → rediriger vers /signup/complete
          router.replace("/signup/complete");
          return;
        }

        // Profil existe, vérifier profile_completed
        if (profile.profile_completed === false) {
          // Profil incomplet → rediriger vers /signup/complete
          router.replace("/signup/complete");
          return;
        }

        // Profil complet → rediriger vers /feed
        router.replace("/feed");
      } catch (err) {
        console.error("Exception in auth callback:", err);
        setError("An unexpected error occurred. Please try again.");
        setTimeout(() => {
          router.replace("/login?error=" + encodeURIComponent("An error occurred. Please try again."));
        }, 3000);
      }
    };

    handleCallback();
  }, [router, searchParams, hasProcessed]); // ✅ Ajouter hasProcessed pour éviter les re-traitements

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

