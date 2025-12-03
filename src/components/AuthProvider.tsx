"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      setTick((t) => t + 1); // force rerender global quand login/logout
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
