// FILE: src/app/login/page.tsx

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import AmbientGlow from "@/components/background/AmbientGlow";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setGoogleLoading(true);

    try {
      // ✅ Lancer OAuth avec PKCE - Supabase gère automatiquement même avec session existante
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        },
      });

      if (error) {
        console.error("OAuth error:", error);
        alert("Error connecting to Google: " + error.message);
        setGoogleLoading(false);
        return;
      }

      // ✅ signInWithOAuth ne redirige PAS automatiquement
      // Il faut rediriger MANUELLEMENT vers l'URL Google OAuth
      if (data?.url) {
        // Redirection IMMÉDIATE vers Google OAuth (externe)
        window.location.href = data.url;
        // Pas besoin de réinitialiser googleLoading car l'utilisateur quitte la page
        return;
      }

      // Si pas d'URL, erreur inattendue
      console.error("No OAuth URL returned");
      alert("An error occurred. Please try again.");
      setGoogleLoading(false);
    } catch (err) {
      console.error("Exception in Google login:", err);
      alert("An error occurred. Please try again.");
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Login error: " + error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      console.log("Session created:", data.session);
      window.dispatchEvent(new Event("authChanged"));
      router.push("/feed");
    }

    setLoading(false);
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
          maxWidth: "400px",
          width: "100%",
          margin: "60px auto",
          padding: "40px",
          textAlign: "center",
          color: "#ffffff",
        }}
      >
        <h1 style={{ marginBottom: 30, fontSize: "1.75rem", fontWeight: 700 }}>
          Log in
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
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

          <button
            onClick={handleLogin}
            disabled={loading || googleLoading}
            className="btn-primary-glow"
            style={{
              width: "100%",
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
            {loading ? "Logging in…" : "Log in"}
          </button>

          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(100, 100, 100, 0.3)" }} />
            <span style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "0.75rem" }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "rgba(100, 100, 100, 0.3)" }} />
          </div>

          <button
            onClick={handleGoogleLogin}
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

          <div style={{ marginTop: 20 }}>
            <a
              href="/signup"
              style={{
                color: "rgba(255, 215, 0, 0.8)",
                textDecoration: "none",
                fontSize: "0.875rem",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "rgba(255, 215, 0, 1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255, 215, 0, 0.8)";
              }}
            >
              No account? Sign up
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
