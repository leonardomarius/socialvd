"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    console.log("Bouton cliqué !"); // <── TEST IMPORTANT
    
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log("Erreur Supabase :", error); // <── TEST 2
      setError("Identifiants incorrects");
      return;
    }

    router.push("/feed");
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Connexion</h1>

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

      <button onClick={handleLogin}>Se connecter</button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
