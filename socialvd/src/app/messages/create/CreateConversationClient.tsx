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

      /* 1️⃣ Récupérer toutes mes conversations */
      const { data: myConversations } = await supabase
        .from("conversations_users")
        .select("conversation_id")
        .eq("user_id", user.id);

      const myConvIds = myConversations?.map((c) => c.conversation_id) || [];

      /* 2️⃣ Vérifier si l’autre user est déjà dans une conv avec moi */
      if (myConvIds.length > 0) {
        const { data: match } = await supabase
          .from("conversations_users")
          .select("conversation_id")
          .in("conversation_id", myConvIds)
          .eq("user_id", otherId)
          .maybeSingle();

        /* Conversation EXISTE déjà → redirection directe */
        if (match) {
          router.push(`/messages/${match.conversation_id}`);
          return;
        }
      }

      /* 3️⃣ Sinon créer la conversation */
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({})
        .select()
        .single();

      if (convErr) {
        console.error("Conversation creation error:", convErr);
        return;
      }

      /* 4️⃣ Enregistrer les deux participants */
      const { error: linkErr } = await supabase
        .from("conversations_users")
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: otherId }
        ]);

      if (linkErr) {
        console.error("Conversation_users error:", linkErr);
        return;
      }

      /* 5️⃣ Redirection vers la nouvelle conversation */
      router.push(`/messages/${newConv.id}`);
    };

    start();
  }, [otherId]);

  return <p>Chargement...</p>;
}
