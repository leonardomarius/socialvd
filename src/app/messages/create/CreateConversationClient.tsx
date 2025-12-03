"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function CreateConversationClient() {
  const router = useRouter();
  const params = useSearchParams();
  const otherId = params.get("user");

  useEffect(() => {
    const start = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !otherId) return;

      // Vérifier si une conversation existe déjà
      const { data: existing } = await supabase
        .from("conversations")
        .select("*")
        .or(`and(user1.eq.${user.id},user2.eq.${otherId}),and(user1.eq.${otherId},user2.eq.${user.id})`)
        .single();

      if (existing) {
        router.push(`/messages/${existing.id}`);
        return;
      }

      // Sinon créer une conversation
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          user1: user.id,
          user2: otherId
        })
        .select()
        .single();

      router.push(`/messages/${newConv.id}`);
    };

    start();
  }, [otherId]);

  return <p>Chargement...</p>;
}
