"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);

    // 🔥 Actual Supabase authentication
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Login error: " + error.message);
      setLoading(false);
      return;
    }

    // 📌 IMPORTANT : Supabase handles the token storage internally
    if (data.session) {
      console.log("Session created:", data.session);

      // This will trigger Navbar and AuthProvider
      window.dispatchEvent(new Event("authChanged"));

      router.push("/feed");
    }

    setLoading(false);
  };

  return (
    <main
      style={{
        maxWidth: "400px",
        margin: "60px auto",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Log in</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "10px",
          borderRadius: 6,
          border: "1px solid #ccc",
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
    padding: "10px",
    marginBottom: "20px",
    borderRadius: 6,
    border: "1px solid #ccc",
  }}
/>


      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px",
          background: "#000",
          color: "white",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
        }}
      >
        {loading ? "Logging in…" : "Log in"}
      </button>

      <div style={{ marginTop: 20 }}>
        <a href="/signup" style={{ color: "#0070f3" }}>
          No account? Sign up
        </a>
      </div>
    </main>
  );
}
