"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

// ✅ Context pour partager l'état de session
type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

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

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    // ✅ Charger la session initiale
    const initSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (error) {
          console.error("Error getting initial session:", error);
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        // ✅ Vérifier le profil si l'utilisateur est connecté
        if (initialSession?.user) {
          const currentPath = pathname || window.location.pathname;
          // Ne pas vérifier sur les pages publiques
          if (currentPath !== "/onboarding" && currentPath !== "/login" && currentPath !== "/signup" && !currentPath.startsWith("/auth/")) {
            const profileComplete = await isProfileComplete(initialSession.user.id);
            if (!profileComplete) {
              router.replace("/onboarding");
            }
          }
        }

        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        console.error("Exception in initSession:", err);
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    };

    initSession();

    // ✅ Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      try {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // ✅ Vérifier le profil après connexion (SIGNED_IN ou TOKEN_REFRESHED)
        if (newSession?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
          const currentPath = window.location.pathname;
          // Ne pas vérifier sur les pages publiques
          if (currentPath !== "/onboarding" && currentPath !== "/login" && currentPath !== "/signup" && !currentPath.startsWith("/auth/")) {
            const profileComplete = await isProfileComplete(newSession.user.id);
            if (!profileComplete) {
              router.replace("/onboarding");
            }
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Error in auth state change:", err);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
