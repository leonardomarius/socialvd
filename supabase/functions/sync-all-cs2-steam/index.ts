import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CS2_GAME_ID = "cs2"; // ⚠️ remplace par l’UUID réel si nécessaire
const CS2_APP_ID = 730;

serve(async (req) => {
  console.log("🔥🔥🔥 SYNC-ALL-CS2-STEAM FUNCTION HIT 🔥🔥🔥");
  console.log("METHOD:", req.method);

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // 🔑 Steam API Key
    const steamApiKey = Deno.env.get("STEAM_WEB_API_KEY");
    if (!steamApiKey) {
      throw new Error("STEAM_WEB_API_KEY is not set");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 🔍 Récupération des comptes Steam actifs
    console.log("📥 Fetching Steam accounts...");
    const { data: links, error } = await supabase
      .from("game_account_links")
      .select("user_id, external_account_id")
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

    console.log(`📊 Found ${links.length} Steam account(s)`);

    let synced = 0;
    let failed = 0;

    for (const link of links) {
      const { user_id, external_account_id: steamid } = link;
      console.log(`🔄 Syncing CS2 for user ${user_id} (steamid ${steamid})`);

      try {
        // 🎯 Appel Steam API CS2 (EXACT)
        const steamUrl =
          `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/` +
          `?appid=${CS2_APP_ID}&steamid=${steamid}&key=${steamApiKey}`;

        console.log("Calling Steam API:", steamUrl);
        const steamResponse = await fetch(steamUrl);
        console.log("Steam response status:", steamResponse.status);

        if (!steamResponse.ok) {
          const errorText = await steamResponse.text();
          console.error(`❌ Steam API failed:`, steamResponse.status, errorText);
          failed++;
          continue;
        }

        const steamData = await steamResponse.json();
        const stats = steamData?.playerstats?.stats || [];

        const getStat = (name: string) =>
          stats.find((s: any) => s.name === name)?.value;

        const totalKills = getStat("total_kills");
        const totalDeaths = getStat("total_deaths");
        const totalWins = getStat("total_wins");
        const totalRounds = getStat("total_rounds_played");

        let kdRatio: string | null = null;
        if (totalKills !== undefined && totalDeaths !== undefined) {
          kdRatio = totalDeaths > 0
            ? (totalKills / totalDeaths).toFixed(2)
            : "0.00";
        }

        const performances: Array<{ title: string; value: string }> = [];

        if (totalKills !== undefined)
          performances.push({ title: "Total Kills", value: totalKills.toString() });
        if (kdRatio !== null)
          performances.push({ title: "K/D Ratio", value: kdRatio });
        if (totalWins !== undefined)
          performances.push({ title: "Total Wins", value: totalWins.toString() });
        if (totalRounds !== undefined)
          performances.push({ title: "Rounds Played", value: totalRounds.toString() });

        if (performances.length === 0) {
          console.warn("⚠️ No CS2 stats extracted");
          failed++;
          continue;
        }

        // 🧹 Suppression des anciennes stats CS2
        await supabase
          .from("game_performances_verified")
          .delete()
          .eq("user_id", user_id)
          .eq("game_id", CS2_GAME_ID);

        // 💾 Insertion des nouvelles stats
        const rows = performances.map(p => ({
          user_id,
          game_id: CS2_GAME_ID,
          provider: "steam",
          external_account_id: steamid,
          snapshot_at: new Date().toISOString(),
          season: null,
          stats: {
            title: p.title,
            value: p.value
          }
        }));

        const { error: insertError } = await supabase
          .from("game_performances_verified")
          .insert(rows);

        if (insertError) {
          console.error("❌ Insert error:", insertError);
          failed++;
          continue;
        }

        console.log(`✅ CS2 stats synced for user ${user_id}`);
        synced++;
      } catch (e) {
        console.error(`❌ Error syncing user ${user_id}:`, e);
        failed++;
      }
    }

    console.log(`📊 Sync complete: ${synced} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({ total: links.length, synced, failed }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response("Internal server error", { status: 500 });
  }
});
