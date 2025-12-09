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
      // 1) Auth
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login");
        return;
      }

      if (!otherId) {
        router.push("/messages");
        return;
      }

      try {
        // 2) RPC : crée ou récupère la conversation
        const { data, error } = await supabase.rpc(
          "create_or_get_conversation",
          { other_user: otherId }
        );

        if (error || !data) {
          console.error("create_or_get_conversation error", error);
          router.push("/messages");
          return;
        }

        const conversationId = data as string;

        // 3) Redirection vers la page de conversation
        router.replace(`/messages/${conversationId}`);
      } catch (e) {
        console.error(e);
        router.push("/messages");
      }
    };

    start();
  }, [otherId, router]);

  return <p>Chargement...</p>;
}
