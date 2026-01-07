"use client";

import { useEffect, useState, createContext, useContext, useRef } from "react";
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

// ✅ AuthProvider SIMPLIFIÉ : Gère UNIQUEMENT la session, PAS les redirections
// Les redirections sont gérées par les pages individuelles pour éviter les conflits
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const hasInitializedRef = useRef(false); // ✅ Garde persistante avec useRef

  useEffect(() => {
    // ✅ Ne s'exécuter qu'une seule fois au montage
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    mountedRef.current = true;

    // ✅ Charger la session initiale
    const initSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (!mountedRef.current) return;

        if (error) {
          console.error("Error getting initial session:", error);
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setLoading(false);
      } catch (err) {
        if (!mountedRef.current) return;
        console.error("Exception in initSession:", err);
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    };

    initSession();

    // ✅ Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mountedRef.current) return;

      try {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      } catch (err) {
        console.error("Error in auth state change:", err);
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []); // ✅ Dépendances vides - s'exécute une seule fois

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
