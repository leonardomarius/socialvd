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

  async function handleSignup(e: any) {
    e.preventDefault();
    setLoading(true);

    // 1) Créer le user dans Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert("Erreur : " + error.message);
      setLoading(false);
      return;
    }

    const user = data?.user;
    if (!user) {
      alert("Erreur : utilisateur non créé.");
      setLoading(false);
      return;
    }

    // 2) Créer le PROFIL lié à cet user (table profiles)
    await supabase.from("profiles").insert({
      id: user.id,
      pseudo: pseudo,
      bio: "",
    });

    // 3) Stocker l'id et le pseudo dans localStorage
    localStorage.setItem("user_id", user.id);
    localStorage.setItem("pseudo", pseudo);

    setLoading(false);

    // 4) Redirection vers le feed
    router.push("/feed");
  }

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "20px" }}>
      <h1>Inscription</h1>

      <form onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="Pseudo"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          required
          style={{ width: "100%", marginBottom: "10px" }}
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", marginBottom: "10px" }}
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", marginBottom: "10px" }}
        />

        <button type="submit" disabled={loading}>
          {loading ? "Chargement..." : "Créer mon compte"}
        </button>
      </form>
    </div>
  );
}
