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
    console.log(`[steam-link-start] Method: ${req.method}`);
    
    const url = new URL(req.url);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    let accessToken: string | null = null;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7);
    } else {
      accessToken = url.searchParams.get("access_token");
    }
    
    if (!accessToken && req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        accessToken = body.access_token || null;
      } catch (e) {
        console.warn("[steam-link-start] Could not parse POST body:", e);
      }
    }
    
    if (accessToken) {
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const client = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
      
      if (!authError && user) {
        userId = user.id;
        console.log(`[steam-link-start] User ID from token: ${userId}`);
      } else {
        console.warn("[steam-link-start] Invalid or expired token, proceeding without user context");
      }
    } else {
      console.warn("[steam-link-start] No access token provided, proceeding without user context");
    }

    const { data: cs2Game, error: gameError } = await adminClient
      .from("games")
      .select("id")
      .eq("slug", "cs2")
      .single();

    if (gameError || !cs2Game) {
      console.error("[steam-link-start] CS2 game not found:", gameError);
      return new Response(
        JSON.stringify({ error: "CS2 game not found in database" }),
        { 
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          }
        }
      );
    }

    const gameId = cs2Game.id;

    const timestamp = Date.now();
    const stateData = {
      user_id: userId || "anonymous",
      game_id: gameId,
      timestamp: timestamp,
    };

    const statePayload = btoa(JSON.stringify(stateData));
    
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
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
    
    const signedState = `${statePayload}.${signatureB64}`;

    const steamOpenIdUrl = "https://steamcommunity.com/openid/login";
    const callbackUrl = `${supabaseUrl}/functions/v1/steam-link-callback`;
    
    const openIdParams = new URLSearchParams({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": callbackUrl,
      "openid.realm": new URL(supabaseUrl).origin,
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    });

    const returnToWithState = `${callbackUrl}?state=${encodeURIComponent(signedState)}`;
    openIdParams.set("openid.return_to", returnToWithState);

    const steamAuthUrl = `${steamOpenIdUrl}?${openIdParams.toString()}`;

    console.log(`[steam-link-start] Redirecting to Steam OpenID: ${steamAuthUrl}`);

    return new Response(null, {
      status: 302,
      headers: {
        "Location": steamAuthUrl,
      },
    });

  } catch (error) {
    console.error("[steam-link-start] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "https://socialvd.com",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Content-Type": "application/json",
        }
      }
    );
  }
});
