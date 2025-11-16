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

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signupError) {
      setError(signupError.message);
      return;
    }

    const userId = data.user?.id;
    if (!userId) return;

    await supabase.from("users").insert({
      id: userId,
      pseudo: pseudo,
    });

    router.push("/login");
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
