// FILE: src/app/signup/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AmbientGlow from "@/components/background/AmbientGlow";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [mindset, setMindset] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [currentFact, setCurrentFact] = useState("");

  const funFacts = [
    "Did you know? The most used password in 2025 is still: 123456. That's... Not great.",
    "I keep this place safe. You're good.",
  ];

  // ✅ Vérifier les paramètres d'erreur dans l'URL (après retour OAuth)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    if (errorParam) {
      setErrorMsg(errorParam);
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setErrorMsg(null);
    
    try {
      // Lancer OAuth - la redirection vers Google se fait automatiquement
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      // Si erreur immédiate (rare, avant redirection), afficher l'erreur
      if (error) {
        setErrorMsg("Google authentication failed. Please try again.");
        setGoogleLoading(false);
      }
      // Si pas d'erreur, la redirection vers Google se fait automatiquement
      // L'utilisateur sera redirigé vers Google, puis vers /auth/callback
      // qui gérera le succès ou l'échec
    } catch (err) {
      // Erreur lors de l'appel OAuth (exception)
      console.error("Exception in Google signup:", err);
      setErrorMsg("Google authentication failed. Please try again.");
      setGoogleLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // ------------------------------------------------------
    // 🔥 0) Vérifier si le pseudo existe déjà
    // ------------------------------------------------------
    const { data: pseudoExists } = await supabase
      .from("profiles")
      .select("id")
      .eq("pseudo", pseudo)
      .maybeSingle();

    if (pseudoExists) {
      setErrorMsg("This username is already taken.");
      setLoading(false);
      return;
    }

    // Mindset validation
    const trimmedMindset = mindset.trim();
    if (trimmedMindset.length < 3) {
      setErrorMsg("Your mindset must be at least 3 characters long.");
      setLoading(false);
      return;
    }
    if (trimmedMindset.length > 160) {
      setErrorMsg("Your mindset must be fewer than 160 characters.");
      setLoading(false);
      return;
    }

    // -----------------------------
    // 1) Création du compte Auth
    // -----------------------------
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    if (!user) {
      setErrorMsg("Unable to create your account.");
      setLoading(false);
      return;
    }

    // -----------------------------
// 2) Mise à jour du mindset (OBLIGATOIRE)
// -----------------------------
const { error: mindsetError } = await supabase
  .from("profiles")
  .update({ bio: trimmedMindset })
  .eq("id", user.id);

if (mindsetError) {
  setErrorMsg("Unable to save your mindset. Please try again.");
  setLoading(false);
  return;
}


    // -----------------------------
    // 3) Mettre à jour la session locale
    // -----------------------------
    localStorage.setItem("user_id", user.id);
    window.dispatchEvent(new Event("authChanged"));

    setLoading(false);

    // -----------------------------
    // 4) Redirection
    // -----------------------------
    router.push("/feed");
  };

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
          Create an account
        </h1>

        <form
          onSubmit={handleSignup}
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
              Email
            </label>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              Password
            </label>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => {
                setPasswordFocused(true);
                setCurrentFact(
                  funFacts[Math.floor(Math.random() * funFacts.length)]
                );
              }}
              onBlur={() => setPasswordFocused(false)}
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
              onFocusCapture={(e) => {
                e.currentTarget.style.borderColor = "rgba(255, 215, 0, 0.5)";
              }}
              onBlurCapture={(e) => {
                e.currentTarget.style.borderColor = "rgba(100, 100, 100, 0.3)";
              }}
            />
          </div>

          {passwordFocused && (
            <p
              style={{
                marginTop: "-6px",
                marginBottom: "4px",
                fontSize: "0.78rem",
                color: "rgba(220,220,235,0.7)",
                opacity: 0.9,
                transition: "opacity 0.3s ease",
              }}
            >
              {currentFact}
            </p>
          )}

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: "0.875rem", color: "#ffffff" }}>
              Mindset
            </label>
            <input
              type="text"
              placeholder="What would define you best"
              value={mindset}
              onChange={(e) => setMindset(e.target.value)}
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
            disabled={loading || googleLoading}
            className="btn-primary-glow"
            style={{
              marginTop: 5,
              padding: "12px 16px",
              background: "rgba(30, 30, 30, 0.8)",
              color: "white",
              borderRadius: 6,
              border: "1px solid rgba(255, 215, 0, 0.3)",
              cursor: loading || googleLoading ? "not-allowed" : "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
              transition: "all 0.2s",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.4), 0 0 12px rgba(255, 215, 0, 0.15)",
            }}
            onMouseEnter={(e) => {
              if (!loading && !googleLoading) {
                e.currentTarget.style.borderColor = "rgba(255, 215, 0, 0.5)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(255, 215, 0, 0.25), 0 0 20px rgba(255, 215, 0, 0.2)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255, 215, 0, 0.3)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.4), 0 0 12px rgba(255, 215, 0, 0.15)";
            }}
          >
            {loading ? "Creating your account..." : "Sign up"}
          </button>
        </form>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(100, 100, 100, 0.3)" }} />
          <span style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "0.75rem" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "rgba(100, 100, 100, 0.3)" }} />
        </div>

        <button
          onClick={handleGoogleSignup}
          disabled={loading || googleLoading}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "rgba(30, 30, 30, 0.8)",
            color: "white",
            borderRadius: 6,
            border: "1px solid rgba(100, 100, 100, 0.3)",
            cursor: loading || googleLoading ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 16,
          }}
          onMouseEnter={(e) => {
            if (!loading && !googleLoading) {
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.5)";
              e.currentTarget.style.background = "rgba(40, 40, 40, 0.8)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(100, 100, 100, 0.3)";
            e.currentTarget.style.background = "rgba(30, 30, 30, 0.8)";
          }}
        >
          {googleLoading ? (
            "Connecting..."
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M17.64 9.20454C17.64 8.56636 17.5827 7.95272 17.4764 7.36363H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9454 17.64 9.20454Z"
                  fill="#4285F4"
                />
                <path
                  d="M9 18C11.43 18 13.467 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65455 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z"
                  fill="#34A853"
                />
                <path
                  d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957273C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957273 13.0418L3.96409 10.71Z"
                  fill="#FBBC05"
                />
                <path
                  d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65455 3.57955 9 3.57955Z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>
      </main>
    </div>
  );
}
