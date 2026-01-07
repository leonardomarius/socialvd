"use client";

import { useEffect, useState, useRef } from "react";
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

// ✅ AuthGuard SIMPLIFIÉ avec gardes persistantes (useRef)
export default function AuthGuard({ children }: any) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const hasCheckedRef = useRef(false); // ✅ Garde persistante avec useRef
  const hasRedirectedRef = useRef(false); // ✅ Garde persistante avec useRef
  const mountedRef = useRef(true);

  useEffect(() => {
    // ✅ Ne vérifier qu'une seule fois
    if (hasCheckedRef.current) {
      setLoading(false);
      return;
    }

    const check = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mountedRef.current) return;

        if (error || !data.session) {
          if (!hasRedirectedRef.current) {
            hasRedirectedRef.current = true;
            router.replace("/login");
          }
          hasCheckedRef.current = true;
          setLoading(false);
          return;
        }

        localStorage.setItem("user_id", data.session.user.id);

        // ✅ Vérifier si le profil est complet (sauf si on est déjà sur /onboarding)
        if (pathname !== "/onboarding" && !hasRedirectedRef.current) {
          const profileComplete = await isProfileComplete(data.session.user.id);
          if (!profileComplete && !hasRedirectedRef.current) {
            hasRedirectedRef.current = true;
            router.replace("/onboarding");
            hasCheckedRef.current = true;
            setLoading(false);
            return;
          }
        }

        if (mountedRef.current) {
          hasCheckedRef.current = true;
          setLoading(false);
        }
      } catch {
        if (!mountedRef.current) return;
        if (!hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          router.replace("/login");
        }
        hasCheckedRef.current = true;
        setLoading(false);
      }
    };

    check();

    return () => {
      mountedRef.current = false;
    };
  }, [router, pathname]); // ✅ Dépendances stables

  if (loading) return <p>Chargement...</p>;

  return children;
}
