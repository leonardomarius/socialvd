"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthGuard({ children }: any) {
  const router = useRouter();
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
        setLoading(false);
      } catch {
        router.replace("/login");
      }
    };

    check();
  }, []);

  if (loading) return <p>Chargement...</p>;

  return children;
}
