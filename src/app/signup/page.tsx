// src/app/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");

  // 🔥 AJOUT — nouveau champ mindset
  const [mindset, setMindset] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 🔥 NEW — fun facts
  const [passwordFocused, setPasswordFocused] = useState(false);

  // 🔥 AJOUT — on fixe la fun fact une fois sélectionnée
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
        maxWidth: 400,
        margin: "40px auto",
        padding: 20,
        border: "1px solid #222",
        borderRadius: 8,
        background: "#000",
      }}
    >
      <h1 style={{ marginBottom: 16 }}>Create an account</h1>

      <form
        onSubmit={handleSignup}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div>
          <label>Username</label>
          <input
            type="text"
            placeholder="Your username"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </div>

        <div>
          <label>Email</label>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </div>

        <div>
          <label>Password</label>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => {
              setPasswordFocused(true);
              // 🔥 AJOUT — on choisit une fun fact UNIQUEMENT lorsqu'on clique
              setCurrentFact(
                funFacts[Math.floor(Math.random() * funFacts.length)]
              );
            }}
            onBlur={() => setPasswordFocused(false)}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </div>

        {/* 🔥 NEW — Display fun fact */}
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

        {/* 🔥 AJOUT — Champ mindset */}
        <div>
          <label>Mindset</label>
          <input
            type="text"
            placeholder="What would define you best"
            value={mindset}
            onChange={(e) => setMindset(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </div>

        {errorMsg && (
          <p style={{ color: "red", fontSize: 14, marginTop: 4 }}>{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 5,
            padding: "10px 16px",
            background: "#0070f3",
            color: "white",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Creating your account..." : "Sign up"}
        </button>
      </form>
    </div>
  );
}
