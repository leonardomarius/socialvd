"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ✅ Fonction pour vérifier si le profil est complet
async function isProfileComplete(userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, bio")
    .eq("id", userId)
    .single();

  // Profil complet si pseudo ET bio sont définis
  return !!(profile && profile.pseudo && profile.bio);
}

export default function AuthGuard({ children }: any) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session) {
          router.replace("/login");
          return;
        }

        localStorage.setItem("user_id", data.session.user.id);

        // ✅ Vérifier si le profil est complet (sauf si on est déjà sur /onboarding)
        if (pathname !== "/onboarding") {
          const profileComplete = await isProfileComplete(data.session.user.id);
          if (!profileComplete) {
            router.replace("/onboarding");
            return;
          }
        }

        setLoading(false);
      } catch {
        router.replace("/login");
      }
    };

    check();
  }, [router, pathname]);

  if (loading) return <p>Chargement...</p>;

  return children;
}
