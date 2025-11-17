// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    console.log("LOGIN START"); // ← debug pour vérifier que le clic fonctionne

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Erreur : " + error.message);
      return;
    }

    console.log("LOGIN DATA", data); // ← debug

    // Stocker l'id utilisateur
    if (data.user) {
      localStorage.setItem("user_id", data.user.id);
    }

    router.push("/feed");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Connexion</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ marginRight: "12px" }}
      />

      <input
        type="password"
        placeholder="Mot de passe"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ marginRight: "12px" }}
      />

      <button onClick={handleLogin}>Se connecter</button>
    </div>
  );
}
