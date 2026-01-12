import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * =====================================================
 * STEAM LINK START - Edge Function
 * =====================================================
 * 
 * Rôle :
 * - Générer une redirection Steam OpenID 2.0
 * - Créer un state sécurisé (HMAC) contenant user_id, game_id (CS2), timestamp
 * - Rediriger vers Steam OpenID (HTTP 302)
 * 
 * Sécurité :
 * - verify_jwt = false (accessible sans JWT automatique)
 * - Token JWT via Authorization header OU query param access_token
 * - Vérification du token via supabase.auth.getUser()
 * - State signé HMAC-SHA256 avec expiration 10 minutes
 * - Validation du state dans le callback
 * 
 * Contraintes :
 * - Le front ne fournit PAS le SteamID
 * - Service role uniquement pour DB
 */

serve(async (req) => {
  // Headers CORS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "https://socialvd.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };

  // Gérer les requêtes OPTIONS (preflight CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // 🔒 Logger la méthode reçue
    console.log(`[steam-link-start] Method: ${req.method}`);
    
    // 🔒 Accepter GET uniquement (OAuth Steam nécessite GET depuis le navigateur)
    if (req.method !== "GET") {
      console.error(`[steam-link-start] Method ${req.method} not allowed - only GET is supported`);
      return new Response("Method not allowed", { 
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain",
        },
      });
    }

    // 🔐 Récupérer le token JWT depuis Authorization header OU query param access_token
    const url = new URL(req.url);
    const authHeader = req.headers.get("Authorization");
    let accessToken: string | null = null;
    
    // Essayer d'abord depuis l'header Authorization
    if (authHeader && authHeader.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7); // Enlever "Bearer "
    } else {
      // Sinon, essayer depuis le query param
      accessToken = url.searchParams.get("access_token");
    }
    
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Missing authentication token" }),
        { 
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          }
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Vérifier le token et obtenir l'utilisateur
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await client.auth.getUser(accessToken);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired authentication token" }),
        { 
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          }
        }
      );
    }

    const userId = user.id;
    console.log(`[steam-link-start] User ID: ${userId}`);

    // 🎮 Récupérer le game_id pour CS2 (via slug "cs2")
    // Utiliser service_role pour la lecture DB
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

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

    // 🔐 Générer un state sécurisé (HMAC)
    // Le state contient : user_id, game_id, timestamp
    const timestamp = Date.now();
    const stateData = {
      user_id: userId,
      game_id: gameId,
      timestamp: timestamp,
    };

    // Signer le state avec HMAC en utilisant le service_role_key comme secret
    // Format: base64(json) + "." + hmac(base64(json))
    const statePayload = btoa(JSON.stringify(stateData));
    
    // HMAC-SHA256 avec service_role_key comme secret
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
    
    // State final : payload.signature
    const signedState = `${statePayload}.${signatureB64}`;

    // 🔗 Construire l'URL Steam OpenID 2.0
    // Steam OpenID endpoint
    const steamOpenIdUrl = "https://steamcommunity.com/openid/login";
    
    // URL de callback (cette fonction sera appelée par Steam après auth)
    // IMPORTANT : Steam nécessite une URL absolue pour return_to
    const callbackUrl = `${supabaseUrl}/functions/v1/steam-link-callback`;
    
    // Paramètres OpenID 2.0 requis
    const openIdParams = new URLSearchParams({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": callbackUrl,
      "openid.realm": new URL(supabaseUrl).origin,
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    });

    // Ajouter le state comme paramètre (Steam le renverra dans return_to)
    // On l'ajoute à return_to pour qu'il soit préservé
    const returnToWithState = `${callbackUrl}?state=${encodeURIComponent(signedState)}`;
    openIdParams.set("openid.return_to", returnToWithState);

    const steamAuthUrl = `${steamOpenIdUrl}?${openIdParams.toString()}`;

    console.log(`[steam-link-start] Redirecting to Steam OpenID: ${steamAuthUrl}`);

    // 🔄 Rediriger vers Steam (HTTP 302)
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
          ...corsHeaders,
          "Content-Type": "application/json",
        }
      }
    );
  }
});
