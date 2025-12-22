// FILE: src/app/signup/page.tsx

"use client";

import { useState } from "react";
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [currentFact, setCurrentFact] = useState("");

  const funFacts = [
    "Did you know? The most used password in 2025 is still: 123456. That's... Not great.",
    "I keep this place safe. You're good.",
  ];

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
            {loading ? "Creating your account..." : "Sign up"}
          </button>
        </form>
      </main>
    </div>
  );
}
