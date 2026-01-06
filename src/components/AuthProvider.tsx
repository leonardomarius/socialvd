"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      try {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
          setTick((t) => t + 1);
        }
      } catch {
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
