"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async () => {
    setError("");

    // (optionnel) vérifier que le pseudo n'est pas déjà pris
    const { data: existing, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("pseudo", pseudo)
      .maybeSingle();

    if (checkError) {
      console.error("Erreur check pseudo:", checkError);
    }

    if (existing) {
      setError("Ce pseudo est déjà pris.");
      return;
    }

    // 1) création du compte auth
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signupError) {
      console.error("Erreur signUp:", signupError);
      setError(signupError.message);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setError("Impossible de récupérer l'utilisateur après inscription.");
      return;
    }

    // 2) insertion du profil dans la table users
    const { error: profileError } = await supabase.from("users").insert({
      id: userId,
      pseudo,
    });

    if (profileError) {
      console.error("Erreur insert profil:", profileError);
      setError("Erreur lors de la création du profil.");
      return;
    }

    // 3) redirection vers le feed (ou login si tu veux)
    router.push("/feed");
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Créer un compte</h1>

      <input
        placeholder="Pseudo"
        value={pseudo}
        onChange={(e) => setPseudo(e.target.value)}
      />

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        placeholder="Mot de passe"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleSignup}>S'inscrire</button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
