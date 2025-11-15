"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSignup = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    console.log("ATTEMPT SIGNUP with:", { email, pseudo, password });

    const { data, error } = await supabase
      .from("users")
      .insert([{ email, pseudo, password }]);

    console.log("SIGNUP ERROR:", error);
    console.log("SIGNUP DATA:", data);

    setLoading(false);

    if (error) {
      setErrorMessage("Erreur lors de l'inscription.");
      return;
    }

    // Redirection si réussite
    window.location.href = "/login";
  };

  return (
    <main className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-6 text-black">Créer un compte</h1>

      <form onSubmit={handleSignup} className="space-y-4">

        <div>
          <label className="block text-sm mb-1 text-black">Email</label>
          <input
            type="email"
            className="w-full px-3 py-2 rounded bg-white text-black border border-gray-400"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-black">Pseudo</label>
          <input
            type="text"
            className="w-full px-3 py-2 rounded bg-white text-black border border-gray-400"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-black">Mot de passe</label>
          <input
            type="password"
            className="w-full px-3 py-2 rounded bg-white text-black border border-gray-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {errorMessage && (
          <p className="text-red-600 text-sm">{errorMessage}</p>
        )}

        <button
  type="submit"
  disabled={loading}
  className="w-full bg-black py-2 rounded font-semibold text-white !text-white"
>
  {loading ? "Création..." : "Créer un compte"}
</button>
      </form>
    </main>
  );
}
