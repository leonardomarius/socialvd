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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Erreur : " + error.message);
      return;
    }

    if (data.user) {
      localStorage.setItem("user_id", data.user.id);
      window.dispatchEvent(new Event("authChanged"));
    }

    router.push("/feed");
  };

  // ⬇️ Appuyer sur entrée déclenche le login
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <div style={{ padding: "20px" }} onKeyDown={onKeyDown}>
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
