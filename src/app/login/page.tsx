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
            disabled={loading}
            className="btn-primary-glow"
            style={{
              width: "100%",
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
            {loading ? "Logging in…" : "Log in"}
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
