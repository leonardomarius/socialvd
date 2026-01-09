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
 * - Rediriger vers Steam OpenID
 * 
 * Contraintes :
 * - L'utilisateur doit être authentifié (cookie Supabase)
 * - Le front ne fournit PAS le SteamID
 * - Service role uniquement pour DB
 */

serve(async (req) => {
  try {
    // 🔒 Vérifier que la méthode est GET (redirection)
    if (req.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    // 🔐 Récupérer l'utilisateur authentifié depuis les headers
    // Les Edge Functions Supabase reçoivent automatiquement l'Authorization header
    // quand appelées depuis le client Supabase (via functions.invoke ou fetch avec headers)
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - No authentication token" }),
        { 
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Créer le client avec le contexte utilisateur pour vérifier l'auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Vérifier que l'utilisateur est authentifié
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid or missing authentication" }),
        { 
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const userId = user.id;

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
      console.error("CS2 game not found:", gameError);
      return new Response(
        JSON.stringify({ error: "CS2 game not found in database" }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
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

    // 🔄 Rediriger vers Steam
    return new Response(null, {
      status: 302,
      headers: {
        "Location": steamAuthUrl,
      },
    });

  } catch (error) {
    console.error("Error in steam-link-start:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});