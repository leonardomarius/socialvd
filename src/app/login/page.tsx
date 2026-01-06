// FILE: src/app/login/page.tsx

"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import AmbientGlow from "@/components/background/AmbientGlow";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [autoLogin, setAutoLogin] = useState(false);

  // ✅ Charger la préférence "Automatic login" depuis localStorage
  useEffect(() => {
    const savedAutoLogin = localStorage.getItem("socialvd_auto_login");
    if (savedAutoLogin === "true") {
      setAutoLogin(true);
    }
  }, []);

  // ✅ Vérifier les paramètres d'erreur dans l'URL (après retour OAuth)
  // MAIS uniquement si aucune session n'existe après traitement par Supabase
  // Cette vérification se fait UNIQUEMENT au chargement initial de la page
  useEffect(() => {
    // Ne vérifier l'erreur QUE si on vient d'arriver sur la page (pas pendant un clic OAuth)
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    
    // Si pas d'erreur dans l'URL, ne rien faire
    if (!errorParam) {
      return;
    }
    
    // Il y a une erreur dans l'URL, vérifier si c'est une vraie erreur
    const checkError = async () => {
      // Attendre un peu pour que Supabase traite la session depuis l'URL
      // (Supabase détecte automatiquement les tokens dans l'URL avec detectSessionInUrl: true)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Vérifier si une session existe AVANT d'afficher l'erreur
      const { data: { session } } = await supabase.auth.getSession();
      
      // Si une session existe, l'authentification a réussi
      // Ne pas afficher l'erreur, laisser AuthProvider gérer la redirection
      if (session?.user) {
        // Nettoyer l'URL et ne pas afficher l'erreur
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      // Si aucune session après traitement, c'est une vraie erreur
      setErrorMsg(errorParam);
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);
    };
    
    checkError();
  }, []); // Exécuté UNIQUEMENT au montage du composant

  // ✅ Vérifier si l'utilisateur est déjà connecté (UNIQUEMENT si auto-login activé)
  useEffect(() => {
    const checkSession = async () => {
      // Vérifier la préférence auto-login
      const savedAutoLogin = localStorage.getItem("socialvd_auto_login");
      const isAutoLoginEnabled = savedAutoLogin === "true";

      // Si auto-login désactivé, ne PAS vérifier la session ni rediriger
      // La page /login reste neutre
      if (!isAutoLoginEnabled) {
        setChecking(false);
        return;
      }

      // Auto-login activé : vérifier la session et rediriger si nécessaire
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Vérifier si le profil est complet
        const { data: profile } = await supabase
          .from("profiles")
          .select("pseudo, bio")
          .eq("id", session.user.id)
          .single();

        const isProfileComplete = !!(profile && profile.pseudo && profile.bio);

        if (isProfileComplete) {
          // Profil complet → rediriger vers /feed
          router.replace("/feed");
          return;
        } else {
          // Profil incomplet → rediriger vers /onboarding
          router.replace("/onboarding");
          return;
        }
      }
      setChecking(false);
    };

    checkSession();
  }, [router]);

  const handleGoogleLogin = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    // Empêcher tout comportement par défaut (submit, etc.)
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setGoogleLoading(true);
    setErrorMsg(null);
    
    try {
      // Lancer OAuth - la redirection vers Google se fait automatiquement
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      // Si erreur EXPLICITE renvoyée par signInWithOAuth, afficher l'erreur
      if (error) {
        console.error("Google OAuth error:", error);
        setErrorMsg("Google authentication failed. Please try again.");
        setGoogleLoading(false);
        return;
      }
      
      // Si pas d'erreur, la redirection vers Google se fait automatiquement
      // Ne pas réinitialiser googleLoading car la redirection va se produire
      // L'utilisateur sera redirigé vers Google, puis vers /auth/callback
      // qui gérera le succès ou l'échec
      // Si data.url existe, c'est l'URL de redirection (normal)
      if (data?.url) {
        // La redirection se fait automatiquement par Supabase
        // Ne rien faire ici, laisser la redirection se produire
      }
    } catch (err) {
      // Erreur lors de l'appel OAuth (exception JavaScript réelle)
      // Ceci ne devrait PAS se produire en cas de succès
      console.error("Exception in Google login:", err);
      setErrorMsg("Google authentication failed. Please try again.");
      setGoogleLoading(false);
    }
  };

  const handleAutoLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAutoLogin(checked);
    localStorage.setItem("socialvd_auto_login", checked ? "true" : "false");
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
          {errorMsg && (
            <p style={{ color: "#f87171", fontSize: "0.875rem", marginBottom: 8 }}>
              {errorMsg}
            </p>
          )}
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

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.875rem",
              color: "rgba(255, 255, 255, 0.8)",
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            <input
              type="checkbox"
              checked={autoLogin}
              onChange={handleAutoLoginChange}
              style={{
                width: 16,
                height: 16,
                cursor: "pointer",
                accentColor: "rgba(255, 215, 0, 0.8)",
              }}
            />
            <span>Automatic login on this device</span>
          </label>

          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(100, 100, 100, 0.3)" }} />
            <span style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "0.75rem" }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "rgba(100, 100, 100, 0.3)" }} />
          </div>

          <button
            type="button"
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
