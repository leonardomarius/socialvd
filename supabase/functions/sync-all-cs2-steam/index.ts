import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CS2_APP_ID = 730;

serve(async (req) => {
  console.log("[sync-all-cs2-steam] Function called");
  console.log("[sync-all-cs2-steam] Method:", req.method);

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const steamApiKey = Deno.env.get("STEAM_WEB_API_KEY");
    if (!steamApiKey) {
      throw new Error("STEAM_WEB_API_KEY is not set");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: cs2Game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("slug", "cs2")
      .single();

    if (gameError || !cs2Game) {
      console.error("[sync-all-cs2-steam] CS2 game not found:", gameError);
      return new Response(
        JSON.stringify({ error: "CS2 game not found in database" }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const CS2_GAME_ID = cs2Game.id;

    console.log("[sync-all-cs2-steam] Fetching Steam accounts...");
    const { data: links, error } = await supabase
      .from("game_account_links")
      .select("user_id, game_id, external_account_id")
      .eq("provider", "steam")
      .eq("game_id", CS2_GAME_ID)
      .is("revoked_at", null);

    if (error) {
      console.error("[sync-all-cs2-steam] Error fetching Steam accounts:", error);
      return new Response("Failed to fetch Steam accounts", { status: 500 });
    }

    if (!links || links.length === 0) {
      console.log("[sync-all-cs2-steam] No Steam accounts to sync");
      return new Response(
        JSON.stringify({ message: "No Steam accounts to sync" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-all-cs2-steam] Found ${links.length} Steam account(s)`);

    let synced = 0;
    let failed = 0;

    for (const link of links) {
      const { user_id, game_id, external_account_id: steamid } = link;
      console.log(`[sync-all-cs2-steam] Syncing CS2 for user ${user_id} (steamid ${steamid})`);

      try {
        const steamUrl =
          `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/` +
          `?appid=${CS2_APP_ID}&steamid=${steamid}&key=${steamApiKey}`;

        console.log(`[sync-all-cs2-steam] Calling Steam API for user ${user_id}`);
        const steamResponse = await fetch(steamUrl);
        console.log(`[sync-all-cs2-steam] Steam API response status for user ${user_id}:`, steamResponse.status);

        if (!steamResponse.ok) {
          const errorText = await steamResponse.text();
          console.error(`[sync-all-cs2-steam] Steam API failed for user ${user_id}:`, steamResponse.status, errorText);
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
          console.warn(`[sync-all-cs2-steam] No CS2 stats extracted for user ${user_id}`);
          failed++;
          continue;
        }

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
          console.log(`[sync-all-cs2-steam] Game account link missing for user ${user_id}, creating it...`);
          
          let steamUsername: string | null = null;
          try {
            const steamProfileUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${steamid}`;
            const steamProfileResponse = await fetch(steamProfileUrl);
            
            if (steamProfileResponse.ok) {
              const steamProfileData = await steamProfileResponse.json();
              steamUsername = steamProfileData?.response?.players?.[0]?.personaname || null;
            }
          } catch (e) {
            console.warn(`[sync-all-cs2-steam] Failed to fetch Steam username for user ${user_id} (non-blocking):`, e);
          }
          
          const now = new Date().toISOString();
          const { data: newLink, error: createError } = await supabase
            .from("game_account_links")
            .insert({
              user_id: user_id,
              game_id: game_id,
              provider: "steam",
              external_account_id: steamid,
              username: steamUsername || steamid,
              linked_at: now,
              revoked_at: null,
            })
            .select("id")
            .single();

          if (createError) {
            if (createError.code === "23505") {
              console.log(`[sync-all-cs2-steam] Link already exists for user ${user_id} (race condition), fetching it`);
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
                console.error(`[sync-all-cs2-steam] Error creating game_account_link for user ${user_id}:`, createError);
                failed++;
                continue;
              }
            } else {
              console.error(`[sync-all-cs2-steam] Error creating game_account_link for user ${user_id}:`, createError);
              failed++;
              continue;
            }
          } else {
            existingLink = newLink;
            console.log(`[sync-all-cs2-steam] Successfully created game_account_link for user ${user_id}`);
          }
        }

        const { error: deleteError } = await supabase
          .from("game_performances_verified")
          .delete()
          .eq("user_id", user_id)
          .eq("game_id", game_id);

        if (deleteError) {
          console.error(`[sync-all-cs2-steam] Delete error for user ${user_id}:`, deleteError);
          failed++;
          continue;
        }

        const statsArray = performances.map(p => ({
          title: p.title,
          value: p.value,
        }));

        const insertRow = {
          user_id,
          game_id: game_id,
          stats: statsArray,
        };

        console.log(`[sync-all-cs2-steam] Inserting stats for user ${user_id}:`, JSON.stringify(insertRow));

        const { error: insertError } = await supabase
          .from("game_performances_verified")
          .insert(insertRow);

        if (insertError) {
          console.error(`[sync-all-cs2-steam] Insert error for user ${user_id}:`, insertError);
          console.error(`[sync-all-cs2-steam] Insert error code: ${insertError.code}, message: ${insertError.message}`);
          console.error(`[sync-all-cs2-steam] Insert error details:`, JSON.stringify(insertError));
          failed++;
          continue;
        }

        console.log(`[sync-all-cs2-steam] CS2 stats synced successfully for user ${user_id}`);
        synced++;
      } catch (e) {
        console.error(`[sync-all-cs2-steam] Error syncing user ${user_id}:`, e);
        failed++;
      }
    }

    console.log(`[sync-all-cs2-steam] Sync complete: ${synced} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({ total: links.length, synced, failed }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[sync-all-cs2-steam] Fatal error:", e);
    return new Response("Internal server error", { status: 500 });
  }
});
