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
      try {
        // 1) Vérifier la session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData.session) {
          router.replace("/login");
          return;
        }

        if (!otherId) {
          router.replace("/messages");
          return;
        }

        // 2) RPC : crée ou récupère la conversation
        const { data, error } = await supabase.rpc("create_or_get_conversation", {
          other_user: otherId,
        });

        if (error || !data) {
          console.error("create_or_get_conversation error", error);
          router.replace("/messages");
          return;
        }

        const conversationId = data as string;

        // 3) Redirection vers la page de conversation
        router.replace(`/messages/${conversationId}`);
      } catch (e) {
        console.error("Error in CreateConversationClient:", e);
        router.replace("/messages");
      }
    };

    start();
  }, [otherId, router]);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        marginTop: "40px",
        padding: "0 20px",
      }}
    >
      <p style={{ color: "white", padding: 20 }}>Chargement…</p>
    </div>
  );
}
