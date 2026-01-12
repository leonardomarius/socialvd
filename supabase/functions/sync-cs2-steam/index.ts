import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * =====================================================
 * SYNC CS2 STEAM - Edge Function (Unitaire)
 * =====================================================
 * 
 * Rôle :
 * - Synchroniser les stats CS2 d'un SEUL utilisateur depuis Steam Web API
 * - Écrire dans latest_game_performances_verified
 * 
 * Paramètres (POST body) :
 * - user_id: UUID de l'utilisateur
 * - game_id: UUID du jeu CS2
 * - steamid: SteamID64 (string)
 * 
 * Sécurité :
 * - verify_jwt = false (appelée par service_role depuis d'autres Edge Functions)
 * - Vérification du lien Steam dans game_account_links
 */

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Parser le body
    const body = await req.json();
    const { user_id, game_id, steamid } = body;

    if (!user_id || !game_id || !steamid) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: user_id, game_id, steamid" }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Vérifier que le lien Steam existe et est valide
    let { data: link, error: linkError } = await adminClient
      .from("game_account_links")
      .select("id, external_account_id")
      .eq("user_id", user_id)
      .eq("game_id", game_id)
      .eq("provider", "steam")
      .eq("external_account_id", steamid)
      .is("revoked_at", null)
      .maybeSingle();

    if (linkError) {
      console.error("Error checking Steam link:", linkError);
      return new Response(
        JSON.stringify({ error: "Database error checking Steam link" }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Si le lien n'existe pas, le créer automatiquement
    if (!link) {
      console.log(`Creating missing game_account_link for user ${user_id}, game ${game_id}, steamid ${steamid}`);
      
      // Récupérer le username Steam depuis l'API (optionnel, non-bloquant)
      let steamUsername: string | null = null;
      const steamApiKey = Deno.env.get("STEAM_WEB_API_KEY");
      
      if (steamApiKey) {
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
      }
      
      const now = new Date().toISOString();
      const { data: newLink, error: createError } = await adminClient
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
        .select("id, external_account_id")
        .single();

      if (createError) {
        // Si l'erreur est une violation de contrainte unique, essayer de récupérer le lien existant
        if (createError.code === "23505") {
          console.log("Link already exists (race condition), fetching it");
          const { data: existingLink } = await adminClient
            .from("game_account_links")
            .select("id, external_account_id")
            .eq("user_id", user_id)
            .eq("game_id", game_id)
            .eq("provider", "steam")
            .is("revoked_at", null)
            .maybeSingle();
          
          if (existingLink) {
            link = existingLink;
          } else {
            console.error("Error creating game_account_link:", createError);
            return new Response(
              JSON.stringify({ error: "Failed to create Steam account link" }),
              { 
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            );
          }
        } else {
          console.error("Error creating game_account_link:", createError);
          return new Response(
            JSON.stringify({ error: "Failed to create Steam account link" }),
            { 
              status: 500,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
      } else {
        link = newLink;
        console.log(`Successfully created game_account_link for user ${user_id}`);
      }
    }

    // Appeler Steam Web API pour récupérer les stats CS2
    // NOTE: Steam Web API nécessite une clé API (STEAM_WEB_API_KEY)
    const steamApiKey = Deno.env.get("STEAM_WEB_API_KEY");
    
    if (!steamApiKey) {
      return new Response(
        JSON.stringify({ error: "STEAM_WEB_API_KEY is not set" }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    
    // Endpoint: ISteamUserStats.GetUserStatsForGame
    // App ID CS2: 730
    let statsData: any = null;
    const steamApiUrl = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?appid=730&key=${steamApiKey}&steamid=${steamid}`;
    
    try {
      const steamResponse = await fetch(steamApiUrl);
      if (steamResponse.ok) {
        statsData = await steamResponse.json();
      } else {
        console.error("Steam API error:", steamResponse.status, await steamResponse.text());
      }
    } catch (e) {
      console.error("Error calling Steam API:", e);
    }

    // Normaliser les stats CS2 depuis la réponse Steam
    const performances: Array<{
      user_id: string;
      game_id: string;
      performance_title: string;
      performance_value: string | null;
    }> = [];

    if (statsData?.playerstats?.stats) {
      // Parser les stats Steam
      const stats = statsData.playerstats.stats;
      
      // Trouver les stats importantes CS2
      const totalKills = stats.find((s: any) => s.name === "total_kills")?.value;
      const totalDeaths = stats.find((s: any) => s.name === "total_deaths")?.value;
      const totalWins = stats.find((s: any) => s.name === "total_wins")?.value;
      const totalRounds = stats.find((s: any) => s.name === "total_rounds_played")?.value;
      
      if (totalKills !== undefined) {
        performances.push({
          user_id,
          game_id,
          performance_title: "Total Kills",
          performance_value: totalKills.toString(),
        });
      }
      
      if (totalDeaths !== undefined && totalKills !== undefined) {
        const kdRatio = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : "0.00";
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
    } else {
      // Si pas de stats disponibles, créer des entrées vides pour maintenir la structure
      console.warn("No CS2 stats available from Steam API");
    }

    // Écrire dans latest_game_performances_verified
    if (performances.length > 0) {
      // Supprimer les anciennes performances CS2 pour cet utilisateur
      await adminClient
        .from("latest_game_performances_verified")
        .delete()
        .eq("user_id", user_id)
        .eq("game_id", game_id);

      // Insérer les nouvelles performances
      const { error: insertError } = await adminClient
        .from("latest_game_performances_verified")
        .insert(performances);

      if (insertError) {
        console.error("Error inserting performances:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to save performances" }),
          { 
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        synced: performances.length,
        user_id,
        game_id,
        steamid,
      }),
      { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error in sync-cs2-steam:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});
