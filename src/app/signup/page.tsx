"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/utils/supabaseClient";

const supabase = supabaseBrowser();

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    // 1) Auth avec Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    // 2) On récupère le profil dans ta table "users"
    const { data: profile } = await supabase
      .from("users")
      .select("id, pseudo")
      .eq("id", data.user.id)
      .single();

    // 3) On stocke localement le profil (pour affichage dans le feed)
    localStorage.setItem("user_id", profile?.id);
    localStorage.setItem("user_pseudo", profile?.pseudo || "Utilisateur");

    router.push("/feed");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md p-6 border rounded-lg shadow bg-white"
      >
        <h1 className="text-2xl font-bold mb-6 text-center">Connexion</h1>

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
          className="w-full bg-black py-2 rounded font-semibold text-white"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
