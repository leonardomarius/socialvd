"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("users")
      .select("id, pseudo")
      .eq("email", email)
      .eq("password", password)
      .single();

    if (error || !data) {
      setErrorMessage("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    // On mémorise l'utilisateur dans le navigateur
    localStorage.setItem("user_id", data.id);
    localStorage.setItem("user_pseudo", data.pseudo);

    router.push("/feed");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md p-6 border rounded-lg shadow"
      >
        <h1 className="text-2xl font-bold mb-6 text-center">Se connecter</h1>

        {errorMessage && (
          <p className="text-red-600 text-center mb-4">{errorMessage}</p>
        )}

        <label className="block text-sm mb-1">Email</label>
        <input
          type="email"
          className="w-full px-3 py-2 border rounded mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="block text-sm mb-1">Mot de passe</label>
        <input
          type="password"
          className="w-full px-3 py-2 border rounded mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black py-2 rounded font-semibold text-white !text-white"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
