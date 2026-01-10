import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  /* =====================================================
     🔥 DEBUG — TRACE D’INVOCATION (TOUT EN HAUT)
     ===================================================== */
  console.log("🔥🔥🔥 SYNC-ALL-CS2-STEAM FUNCTION HIT 🔥🔥🔥");
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

    // 1) Lecture de la clé Steam (OBLIGATOIRE)
    const steamApiKey = Deno.env.get("STEAM_WEB_API_KEY");
    if (!steamApiKey) {
      throw new Error("STEAM_WEB_API_KEY is not set");
    }
    console.log("✅ Steam API key found");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2) Récupérer tous les comptes Steam CS2 actifs
    console.log("📥 Fetching Steam accounts from game_account_links...");
    const { data: links, error } = await supabase
      .from("game_account_links")
      .select("user_id, game_id, external_account_id")
      .eq("provider", "steam")
      .is("revoked_at", null);

    if (error) {
      console.error("❌ Error fetching Steam accounts:", error);
      return new Response("Failed to fetch Steam accounts", { status: 500 });
    }

    if (!links || links.length === 0) {
      console.log("ℹ️ No Steam accounts to sync");
      return new Response(
        JSON.stringify({ message: "No Steam accounts to sync" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`📊 Found ${links.length} Steam account(s) to sync`);

    let synced = 0;
    let failed = 0;

    // 3) Boucle sur chaque compte - Appel Steam API DIRECT
    for (const link of links) {
      const { user_id, game_id, external_account_id: steamid } = link;
      console.log(`🔄 Processing SteamID: ${steamid} for user ${user_id}`);

      try {
        // CS2 = appid 730, endpoint GetUserStatsForGame v2
        // Appel STRICTEMENT IDENTIQUE au test navigateur fonctionnel
        const steamUrl = "https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/" +
          "?appid=730&steamid=" + steamid + "&key=" + steamApiKey;
        
        console.log("Calling Steam API:", steamUrl);
        const steamResponse = await fetch(steamUrl);

        console.log("Steam response status:", steamResponse.status);

        if (!steamResponse.ok) {
          const errorText = await steamResponse.text();
          console.error(`❌ Steam API failed for ${steamid}:`, steamResponse.status, errorText);
          failed++;
          continue;
        }

        const steamData = await steamResponse.json();
        console.log("Steam payload keys:", Object.keys(steamData || {}));
        console.log(`✅ Steam API OK for ${steamid}`);

        // 4) Normalisation des stats CS2
        const stats = steamData?.playerstats?.stats || [];
        
        const totalKills = stats.find((s: any) => s.name === "total_kills")?.value;
        const totalDeaths = stats.find((s: any) => s.name === "total_deaths")?.value;
        const totalWins = stats.find((s: any) => s.name === "total_wins")?.value;
        const totalRounds = stats.find((s: any) => s.name === "total_rounds_played")?.value;

        // Calcul K/D ratio
        let kdRatio: string | null = null;
        if (totalKills !== undefined && totalDeaths !== undefined) {
          kdRatio = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : "0.00";
        }

        // Construire les performances
        const performances: Array<{
          user_id: string;
          game_id: string;
          performance_title: string;
          performance_value: string | null;
        }> = [];

        if (totalKills !== undefined) {
          performances.push({
            user_id,
            game_id,
            performance_title: "Total Kills",
            performance_value: totalKills.toString(),
          });
        }

        if (kdRatio !== null) {
          performances.push({
            user_id,
            game_id,
            performance_title: "K/D Ratio",
            performance_value: kdRatio,
          });
        }

        if (totalWins !== undefined) {
          performances.push({
            user_id,
            game_id,
            performance_title: "Total Wins",
            performance_value: totalWins.toString(),
          });
        }

        if (totalRounds !== undefined) {
          performances.push({
            user_id,
            game_id,
            performance_title: "Rounds Played",
            performance_value: totalRounds.toString(),
          });
        }

        if (performances.length === 0) {
          console.warn(`⚠️ No stats extracted for ${steamid}`);
          failed++;
          continue;
        }

        // 5) Écriture base de données
        console.log(`💾 Writing ${performances.length} performance(s) for user ${user_id}...`);

        // Supprimer les anciennes stats CS2 de l'utilisateur
        const { error: deleteError } = await supabase
          .from("latest_game_performances_verified")
          .delete()
          .eq("user_id", user_id)
          .eq("game_id", game_id);

        if (deleteError) {
          console.error(`❌ Delete error for user ${user_id}:`, deleteError);
          failed++;
          continue;
        }

        // Insérer les nouvelles stats
        const { error: insertError } = await supabase
          .from("latest_game_performances_verified")
          .insert(performances);

        if (insertError) {
          console.error(`❌ Insert error for user ${user_id}:`, insertError);
          failed++;
          continue;
        }

        console.log(`✅ Successfully synced stats for user ${user_id}`);
        synced++;
      } catch (e) {
        console.error(`❌ Error syncing user ${user_id}:`, e);
        failed++;
      }
    }

    // 6) Résumé final
    console.log(`📊 Sync complete: ${synced} succeeded, ${failed} failed out of ${links.length} total`);
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
