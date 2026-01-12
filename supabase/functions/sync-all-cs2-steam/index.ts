import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // 🎮 Récupérer le game_id pour CS2 (via slug "cs2")
    const { data: cs2Game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("slug", "cs2")
      .single();

    if (gameError || !cs2Game) {
      console.error("CS2 game not found:", gameError);
      return new Response(
        JSON.stringify({ error: "CS2 game not found in database" }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const CS2_GAME_ID = cs2Game.id;

    // 🔍 Récupération des comptes Steam actifs
    console.log("📥 Fetching Steam accounts...");
    const { data: links, error } = await supabase
      .from("game_account_links")
      .select("user_id, game_id, external_account_id")
      .eq("provider", "steam")
      .eq("game_id", CS2_GAME_ID)
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
      const { user_id, game_id, external_account_id: steamid } = link;
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

        // ✅ Vérifier que le game_account_link existe toujours (sécurité)
        // Si le lien a été supprimé entre-temps, le recréer
        let { data: existingLink } = await supabase
          .from("game_account_links")
          .select("id")
          .eq("user_id", user_id)
          .eq("game_id", game_id)
          .eq("provider", "steam")
          .eq("external_account_id", steamid)
          .is("revoked_at", null)
          .maybeSingle();

        if (!existingLink) {
          console.log(`⚠️ Game account link missing for user ${user_id}, creating it...`);
          
          // Récupérer le username Steam depuis l'API (optionnel, non-bloquant)
          let steamUsername: string | null = null;
          try {
            const steamProfileUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${steamid}`;
            const steamProfileResponse = await fetch(steamProfileUrl);
            
            if (steamProfileResponse.ok) {
              const steamProfileData = await steamProfileResponse.json();
              steamUsername = steamProfileData?.response?.players?.[0]?.personaname || null;
            }
          } catch (e) {
            console.warn("Failed to fetch Steam username (non-blocking):", e);
          }
          
          const now = new Date().toISOString();
          const { data: newLink, error: createError } = await supabase
            .from("game_account_links")
            .insert({
              user_id: user_id,
              game_id: game_id,
              provider: "steam",
              external_account_id: steamid,
              username: steamUsername || steamid, // Fallback sur steamid si username non disponible
              linked_at: now,
              revoked_at: null,
            })
            .select("id")
            .single();

          if (createError) {
            // Si l'erreur est une violation de contrainte unique, le lien existe peut-être déjà
            if (createError.code === "23505") {
              console.log("Link already exists (race condition), fetching it");
              const { data: fetchedLink } = await supabase
                .from("game_account_links")
                .select("id")
                .eq("user_id", user_id)
                .eq("game_id", game_id)
                .eq("provider", "steam")
                .is("revoked_at", null)
                .maybeSingle();
              
              if (fetchedLink) {
                existingLink = fetchedLink;
              } else {
                console.error(`❌ Error creating game_account_link for user ${user_id}:`, createError);
                failed++;
                continue;
              }
            } else {
              console.error(`❌ Error creating game_account_link for user ${user_id}:`, createError);
              failed++;
              continue;
            }
          } else {
            existingLink = newLink;
            console.log(`✅ Successfully created game_account_link for user ${user_id}`);
          }
        }

        // 🧹 Suppression des anciennes stats CS2
        const { error: deleteError } = await supabase
          .from("game_performances_verified")
          .delete()
          .eq("user_id", user_id)
          .eq("game_id", game_id);

        if (deleteError) {
          console.error(`❌ Delete error for user ${user_id}:`, deleteError);
          failed++;
          continue;
        }

        // 💾 Insertion des nouvelles stats
        // La table game_performances_verified utilise un champ stats (JSONB) qui contient un array d'objets { title, value }
        const statsArray = performances.map(p => ({
          title: p.title,
          value: p.value,
        }));

        const insertRow = {
          user_id,
          game_id: game_id,
          stats: statsArray,
        };

        console.log(`📝 Inserting stats for user ${user_id}:`, JSON.stringify(insertRow));

        const { error: insertError } = await supabase
          .from("game_performances_verified")
          .insert(insertRow);

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
