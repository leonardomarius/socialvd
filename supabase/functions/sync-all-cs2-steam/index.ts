import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  /* =====================================================
     🔥 DEBUG — TRACE D’INVOCATION (TOUT EN HAUT)
     ===================================================== */
  console.log("HEADERS:", Object.fromEntries(req.headers.entries()));
  console.log("🔥 FUNCTION HIT");
  console.log("METHOD:", req.method);
  console.log("HEADERS:", Object.fromEntries(req.headers));
  /* ===================================================== */

  try {
    /* =====================================================
       🔒 SÉCURITÉ ABSOLUE — SERVICE ROLE ONLY
       ===================================================== */
    /* ===================================================== */

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1️⃣ Récupérer tous les comptes Steam CS2 actifs
    const { data: links, error } = await supabase
      .from("game_account_links")
      .select("user_id, game_id, external_account_id")
      .eq("provider", "steam")
      .is("revoked_at", null);

    if (error) {
      console.error(error);
      return new Response("Failed to fetch Steam accounts", { status: 500 });
    }

    if (!links || links.length === 0) {
      return new Response(
        JSON.stringify({ message: "No Steam accounts to sync" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    let synced = 0;
    let failed = 0;

    // 2️⃣ Boucle sur chaque compte
    for (const link of links) {
      const { user_id, game_id, external_account_id: steamid } = link;

      try {
        // 🚫 TEMPORAIREMENT DÉSACTIVÉ — vérification DB du lien Steam
        // await supabase.rpc("assert_steam_account_linked", {
        //   p_user_id: user_id,
        //   p_game_id: game_id,
        //   p_steamid: steamid,
        // });

        // Appel de la fonction unitaire
        const res = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-cs2-steam`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get(
                "SUPABASE_SERVICE_ROLE_KEY"
              )}`,
            },
            body: JSON.stringify({
              user_id,
              game_id,
              steamid,
            }),
          }
        );

        if (!res.ok) {
          failed++;
          console.error(`Sync failed for user ${user_id}`);
          continue;
        }

        synced++;
      } catch (e) {
        failed++;
        console.error(`Error syncing user ${user_id}`, e);
      }
    }

    // 3️⃣ Résumé
    return new Response(
      JSON.stringify({
        total: links.length,
        synced,
        failed,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response("Internal server error", { status: 500 });
  }
});
