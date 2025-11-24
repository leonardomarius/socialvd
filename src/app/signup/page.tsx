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

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      setErrorMsg("Ce pseudo est déjà pris.");
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
      setErrorMsg("Impossible de créer votre compte.");
      setLoading(false);
      return;
    }

    // -----------------------------
    // 2) Création du profil associé
    // -----------------------------
    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      pseudo: pseudo || email.split("@")[0],
      bio: "",
      avatar_url: null,
    });

    if (profileError) {
      setErrorMsg(profileError.message);
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
      <h1 style={{ marginBottom: 16 }}>Créer un compte</h1>

      <form
        onSubmit={handleSignup}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div>
          <label>Pseudo</label>
          <input
            type="text"
            placeholder="Ton pseudo"
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
            placeholder="Adresse email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </div>

        <div>
          <label>Mot de passe</label>
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? "Création du compte..." : "S'inscrire"}
        </button>
      </form>
    </div>
  );
}
