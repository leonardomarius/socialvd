import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "https://socialvd.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log(`[steam-link-callback] Method: ${req.method}`);

    const url = new URL(req.url);
    
    const openIdParams: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      if (key.startsWith("openid.")) {
        openIdParams[key] = value;
      }
    }

    const signedState = url.searchParams.get("state");

    if (!openIdParams["openid.mode"] || !openIdParams["openid.return_to"]) {
      console.error("[steam-link-callback] Missing required OpenID parameters");
      return redirectToFrontend("error", "Missing OpenID parameters");
    }

    const openIdMode = openIdParams["openid.mode"];
    if (openIdMode !== "id_res" && openIdMode !== "cancel") {
      console.error("[steam-link-callback] Invalid OpenID mode:", openIdMode);
      return redirectToFrontend("error", "Invalid OpenID mode");
    }
    
    if (openIdMode === "cancel") {
      return redirectToFrontend("error", "Authentication cancelled");
    }

    if (!signedState) {
      console.error("[steam-link-callback] Missing state parameter");
      return redirectToFrontend("error", "Missing state parameter");
    }

    const [statePayload, signatureB64] = signedState.split(".");
    
    if (!statePayload || !signatureB64) {
      console.error("[steam-link-callback] Invalid state format");
      return redirectToFrontend("error", "Invalid state format");
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(serviceRoleKey);
    const payloadData = encoder.encode(statePayload);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, payloadData);
    const expectedSignatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
    
    if (signatureB64 !== expectedSignatureB64) {
      console.error("[steam-link-callback] Invalid state signature");
      return redirectToFrontend("error", "Invalid state signature");
    }

    let stateData: { user_id: string; game_id: string; timestamp: number };
    try {
      stateData = JSON.parse(atob(statePayload));
    } catch (e) {
      console.error("[steam-link-callback] Failed to decode state:", e);
      return redirectToFrontend("error", "Failed to decode state");
    }

    const stateAge = Date.now() - stateData.timestamp;
    const MAX_STATE_AGE = 10 * 60 * 1000;
    
    if (stateAge > MAX_STATE_AGE) {
      console.error("[steam-link-callback] State expired");
      return redirectToFrontend("error", "State expired");
    }

    const { user_id, game_id } = stateData;
    console.log(`[steam-link-callback] User ID from state: ${user_id}, Game ID: ${game_id}`);

    const validationParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(openIdParams)) {
      if (key !== "openid.mode") {
        validationParams.append(key, value);
      }
    }
    
    validationParams.set("openid.mode", "check_authentication");

    const validationUrl = "https://steamcommunity.com/openid/login";
    const validationResponse = await fetch(validationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: validationParams.toString(),
    });

    if (!validationResponse.ok) {
      console.error("[steam-link-callback] Steam validation request failed:", validationResponse.status);
      return redirectToFrontend("error", "Steam validation failed");
    }

    const validationText = await validationResponse.text();
    
    if (!validationText.includes("is_valid:true")) {
      console.error("[steam-link-callback] Steam OpenID validation failed:", validationText);
      return redirectToFrontend("error", "Steam OpenID validation failed");
    }

    const claimedId = openIdParams["openid.claimed_id"];
    if (!claimedId) {
      console.error("[steam-link-callback] Missing openid.claimed_id");
      return redirectToFrontend("error", "Missing Steam ID");
    }

    const steamIdMatch = claimedId.match(/\/id\/(\d+)$/);
    if (!steamIdMatch || !steamIdMatch[1]) {
      console.error("[steam-link-callback] Invalid Steam ID format:", claimedId);
      return redirectToFrontend("error", "Invalid Steam ID format");
    }

    const steamid64 = steamIdMatch[1];
    console.log(`[steam-link-callback] Steam ID received: ${steamid64}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: existingLink, error: checkError } = await adminClient
      .from("game_account_links")
      .select("id, external_account_id, revoked_at")
      .eq("user_id", user_id)
      .eq("game_id", game_id)
      .eq("provider", "steam")
      .maybeSingle();

    if (checkError) {
      console.error("[steam-link-callback] Error checking existing link:", checkError);
      return redirectToFrontend("error", "Database error");
    }

    if (existingLink && !existingLink.revoked_at) {
      if (existingLink.external_account_id === steamid64) {
        console.log("[steam-link-callback] Steam account already linked");
      } else {
        console.error("[steam-link-callback] Steam account already linked to different ID");
        return redirectToFrontend("error", "Steam account already linked");
      }
    }

    const now = new Date().toISOString();
    
    let steamUsername: string | null = null;
    const steamApiKey = Deno.env.get("STEAM_WEB_API_KEY");
    
    if (steamApiKey) {
      try {
        const steamProfileUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${steamid64}`;
        const steamProfileResponse = await fetch(steamProfileUrl);
        
        if (steamProfileResponse.ok) {
          const steamProfileData = await steamProfileResponse.json();
          steamUsername = steamProfileData?.response?.players?.[0]?.personaname || null;
        }
      } catch (e) {
        console.warn("[steam-link-callback] Failed to fetch Steam username (non-blocking):", e);
      }
    }
    
    const { error: upsertError } = await adminClient
      .from("game_account_links")
      .upsert({
        user_id: user_id,
        game_id: game_id,
        provider: "steam",
        external_account_id: steamid64,
        username: steamUsername || steamid64,
        linked_at: now,
        revoked_at: null,
      }, {
        onConflict: "user_id,game_id,provider",
      });

    if (upsertError) {
      console.error(`[steam-link-callback] Error upserting game_account_link for user ${user_id}:`, upsertError);
      return redirectToFrontend("error", "Failed to link Steam account");
    }

    console.log(`[steam-link-callback] Successfully linked Steam account ${steamid64} for user ${user_id}`);

    try {
      const syncResponse = await fetch(
        `${supabaseUrl}/functions/v1/sync-all-cs2-steam`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
        }
      );

      if (!syncResponse.ok) {
        console.error("[steam-link-callback] Sync CS2 failed (non-blocking):", await syncResponse.text());
      } else {
        console.log("[steam-link-callback] CS2 sync triggered successfully");
      }
    } catch (syncError) {
      console.error("[steam-link-callback] Error triggering CS2 sync (non-blocking):", syncError);
    }

    return redirectToFrontend("linked", null);

  } catch (error) {
    console.error("[steam-link-callback] Error:", error);
    return redirectToFrontend("error", "Internal server error");
  }
});

function redirectToFrontend(status: "linked" | "error", errorMessage: string | null): Response {
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://socialvd.com";
  
  const redirectUrl = new URL("/profile", frontendUrl);
  redirectUrl.searchParams.set("steam", status);
  
  if (errorMessage && status === "error") {
    redirectUrl.searchParams.set("error", encodeURIComponent(errorMessage));
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "https://socialvd.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      "Location": redirectUrl.toString(),
    },
  });
}
