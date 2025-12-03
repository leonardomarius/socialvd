"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ProfilePerformances from "@/components/ProfilePerformances";

export default function UserPerformancesPage() {
  const params = useParams();
  const id = params.id as string;

  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setMyId(data.user?.id || null);
    };
    loadUser();
  }, []);

  if (!id) return <p>Loading...</p>;

  return (
    <div
      style={{
        maxWidth: "780px",
        margin: "0 auto",
        padding: "20px",
        color: "white",
      }}
    >
      <h1
        style={{
          fontSize: 24,
          marginBottom: 20,
          letterSpacing: "0.5px",
          color: "rgba(255,255,255,0.95)",
        }}
      >
        Personal performances
      </h1>

      {/* Composant déjà existant, réutilisé */}
      <ProfilePerformances userId={id} myId={myId} />
    </div>
  );
}
