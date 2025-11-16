"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/utils/supabaseClient";

const supabase = supabaseBrowser();

type AuthGuardProps = {
  children: ReactNode;
};

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      // Pas de session → redirection vers /login
      if (error || !data.session) {
        router.replace("/login");
        return;
      }

      // Optionnel : on synchronise l'id dans le localStorage
      const user = data.session.user;
      localStorage.setItem("user_id", user.id);

      setChecking(false);
    };

    checkSession();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    );
  }

  return <>{children}</>;
}
