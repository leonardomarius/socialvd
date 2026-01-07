"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AmbientGlow from "@/components/background/AmbientGlow";

export default function SignupCompletePage() {
  const router = useRouter();

  const [pseudo, setPseudo] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      // Vérifier si le profil est déjà complet
      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_completed")
        .eq("id", session.user.id)
        .single();

      if (profile?.profile_completed === true) {
        router.replace("/feed");
        return;
      }

      setChecking(false);
    };

    checkAuth();
  }, [router]);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // Validation
    if (!pseudo.trim()) {
      setErrorMsg("Username is required.");
      setLoading(false);
      return;
    }

    const trimmedBio = bio.trim();
    if (trimmedBio.length < 3) {
      setErrorMsg("Your bio must be at least 3 characters long.");
      setLoading(false);
      return;
    }
    if (trimmedBio.length > 160) {
      setErrorMsg("Your bio must be fewer than 160 characters.");
      setLoading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setErrorMsg("Session expired. Please log in again.");
      setLoading(false);
      router.replace("/login");
      return;
    }

    // Vérifier si le pseudo existe déjà
    const { data: pseudoExists } = await supabase
      .from("profiles")
      .select("id")
      .eq("pseudo", pseudo.trim())
      .maybeSingle();

    if (pseudoExists && pseudoExists.id !== session.user.id) {
      setErrorMsg("This username is already taken.");
      setLoading(false);
      return;
    }

    try {
      // Mettre à jour le profil (pseudo, bio, et profile_completed = true)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          pseudo: pseudo.trim(),
          bio: trimmedBio,
          profile_completed: true,
        })
        .eq("id", session.user.id);

      if (profileError) {
        setErrorMsg("Unable to save your profile. Please try again.");
        setLoading(false);
        return;
      }

      // Redirection vers le feed
      window.dispatchEvent(new Event("authChanged"));
      router.push("/feed");
    } catch (err) {
      setErrorMsg("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (checking) {
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
        <p style={{ color: "#ffffff", position: "relative", zIndex: 10 }}>
          Loading...
        </p>
      </div>
    );
  }

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
          maxWidth: 400,
          width: "100%",
          margin: "40px auto",
          padding: "40px",
          color: "#ffffff",
        }}
      >
        <h1 style={{ marginBottom: 24, fontSize: "1.75rem", fontWeight: 700, textAlign: "center" }}>
          Complete your profile
        </h1>
        <p style={{ marginBottom: 24, fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.7)", textAlign: "center" }}>
          Please complete your SocialVD account by choosing a username and bio.
        </p>

        <form
          onSubmit={handleComplete}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: "0.875rem", color: "#ffffff" }}>
              Username
            </label>
            <input
              type="text"
              placeholder="Your username"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 6,
                border: "1px solid rgba(100, 100, 100, 0.3)",
                background: "rgba(30, 30, 30, 0.8)",
                color: "#ffffff",
                fontSize: "0.9rem",
                outline: "none",
                transition: "all 0.2s",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "rgba(255, 215, 0, 0.5)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(100, 100, 100, 0.3)";
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: "0.875rem", color: "#ffffff" }}>
              Bio (Mindset)
            </label>
            <input
              type="text"
              placeholder="What would define you best"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 6,
                border: "1px solid rgba(100, 100, 100, 0.3)",
                background: "rgba(30, 30, 30, 0.8)",
                color: "#ffffff",
                fontSize: "0.9rem",
                outline: "none",
                transition: "all 0.2s",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "rgba(255, 215, 0, 0.5)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(100, 100, 100, 0.3)";
              }}
            />
          </div>

          {errorMsg && (
            <p style={{ color: "#f87171", fontSize: "0.875rem", marginTop: 4 }}>{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary-glow"
            style={{
              marginTop: 5,
              padding: "12px 16px",
              background: "rgba(30, 30, 30, 0.8)",
              color: "white",
              borderRadius: 6,
              border: "1px solid rgba(255, 215, 0, 0.3)",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
              transition: "all 0.2s",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.4), 0 0 12px rgba(255, 215, 0, 0.15)",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = "rgba(255, 215, 0, 0.5)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(255, 215, 0, 0.25), 0 0 20px rgba(255, 215, 0, 0.2)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255, 215, 0, 0.3)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.4), 0 0 12px rgba(255, 215, 0, 0.15)";
            }}
          >
            {loading ? "Completing..." : "Complete profile"}
          </button>
        </form>
      </main>
    </div>
  );
}

