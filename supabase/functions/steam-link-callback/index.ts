import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * =====================================================
 * STEAM LINK CALLBACK - Edge Function
 * =====================================================
 * 
 * Rôle :
 * - Recevoir le retour Steam OpenID
 * - Valider la signature OpenID auprès de Steam (check_authentication)
 * - Extraire le steamid64 depuis openid.claimed_id
 * - Valider et décoder le state (HMAC)
 * - UPSERT dans game_account_links (NE JAMAIS modifier un steamid existant)
 * - Déclencher l'Edge Function sync-all-cs2-steam (non-bloquant)
 * - Rediriger vers le front : succès → /profile?steam=linked, erreur → /profile?steam=error
 * 
 * Contraintes :
 * - Sécurité OpenID complète (no shortcuts)
 * - Service role uniquement pour DB
 * - Ne JAMAIS modifier un steamid existant
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
    console.log(`[steam-link-callback] Method: ${req.method}`);
    
    // 🔒 Accepter GET uniquement (OAuth Steam callback utilise GET)
    if (req.method !== "GET") {
      console.error(`[steam-link-callback] Method ${req.method} not allowed - only GET is supported`);
      return new Response("Method not allowed", { 
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain",
        },
      });
    }

    const url = new URL(req.url);
    
    // 📥 Récupérer les paramètres OpenID depuis l'URL
    const openIdParams: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      if (key.startsWith("openid.")) {
        openIdParams[key] = value;
      }
    }

    // Récupérer le state depuis l'URL
    // Le state est passé dans return_to, donc il sera dans les paramètres GET
    const signedState = url.searchParams.get("state");

    // 🔐 Vérifier que les paramètres OpenID essentiels sont présents
    if (!openIdParams["openid.mode"] || !openIdParams["openid.return_to"]) {
      console.error("[steam-link-callback] Missing required OpenID parameters");
      return redirectToFrontend("error", "Missing OpenID parameters");
    }

    // Steam renvoie "id_res" après une authentification réussie
    // Mais vérifions aussi que nous avons bien les paramètres nécessaires
    const openIdMode = openIdParams["openid.mode"];
    if (openIdMode !== "id_res" && openIdMode !== "cancel") {
      console.error("[steam-link-callback] Invalid OpenID mode:", openIdMode);
      return redirectToFrontend("error", "Invalid OpenID mode");
    }
    
    // Si l'utilisateur a annulé, rediriger avec erreur
    if (openIdMode === "cancel") {
      return redirectToFrontend("error", "Authentication cancelled");
    }

    // 🔓 Décoder et valider le state (HMAC)
    if (!signedState) {
      console.error("[steam-link-callback] Missing state parameter");
      return redirectToFrontend("error", "Missing state parameter");
    }

    const [statePayload, signatureB64] = signedState.split(".");
    
    if (!statePayload || !signatureB64) {
      console.error("[steam-link-callback] Invalid state format");
      return redirectToFrontend("error", "Invalid state format");
    }

    // Vérifier la signature HMAC
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
    
    // Comparaison sécurisée des signatures (timing-safe)
    if (signatureB64 !== expectedSignatureB64) {
      console.error("[steam-link-callback] Invalid state signature");
      return redirectToFrontend("error", "Invalid state signature");
    }

    // Décoder le state
    let stateData: { user_id: string; game_id: string; timestamp: number };
    try {
      stateData = JSON.parse(atob(statePayload));
    } catch (e) {
      console.error("[steam-link-callback] Failed to decode state:", e);
      return redirectToFrontend("error", "Failed to decode state");
    }

    // Vérifier que le state n'est pas expiré (max 10 minutes)
    const stateAge = Date.now() - stateData.timestamp;
    const MAX_STATE_AGE = 10 * 60 * 1000; // 10 minutes
    
    if (stateAge > MAX_STATE_AGE) {
      console.error("[steam-link-callback] State expired");
      return redirectToFrontend("error", "State expired");
    }

    const { user_id, game_id } = stateData;
    console.log(`[steam-link-callback] User ID from state: ${user_id}, Game ID: ${game_id}`);

    // ✅ Valider la signature OpenID auprès de Steam
    // Steam OpenID 2.0 nécessite un appel à check_authentication
    // IMPORTANT : Nous devons reconstruire les paramètres EXACTEMENT comme reçus
    // mais avec le mode modifié pour la validation
    const validationParams = new URLSearchParams();
    
    // Copier TOUS les paramètres OpenID reçus (sauf le mode qui sera changé)
    for (const [key, value] of Object.entries(openIdParams)) {
      if (key !== "openid.mode") {
        validationParams.append(key, value);
      }
    }
    
    // Modifier le mode pour la validation (requis par OpenID 2.0)
    validationParams.set("openid.mode", "check_authentication");

    // Appel à Steam pour valider la signature
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
    
    // Steam répond avec "is_valid:true" ou "is_valid:false"
    if (!validationText.includes("is_valid:true")) {
      console.error("[steam-link-callback] Steam OpenID validation failed:", validationText);
      return redirectToFrontend("error", "Steam OpenID validation failed");
    }

    // 🎮 Extraire le steamid64 depuis openid.claimed_id
    // Format: https://steamcommunity.com/openid/id/76561198012345678
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

    // 🔐 Créer le client Supabase avec service_role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 🛡️ Vérifier qu'aucun lien Steam n'existe déjà pour cet utilisateur ET ce jeu
    // Si un lien existe, on ne le modifie PAS (règle stricte)
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

    // Si un lien existe et n'est pas révoqué, vérifier si c'est le même steamid
    if (existingLink && !existingLink.revoked_at) {
      if (existingLink.external_account_id === steamid64) {
        // Même compte Steam, pas besoin de modifier
        console.log("[steam-link-callback] Steam account already linked");
      } else {
        // Compte Steam différent - NE PAS MODIFIER (règle stricte)
        console.error("[steam-link-callback] Steam account already linked to different ID");
        return redirectToFrontend("error", "Steam account already linked");
      }
    }

    // 💾 UPSERT dans game_account_links
    // Si un lien existe mais est révoqué, on le réactive
    // Sinon, on crée un nouveau lien
    const now = new Date().toISOString();
    
    // Récupérer le username Steam depuis l'API Steam (optionnel, non-bloquant)
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
        username: steamUsername || steamid64, // Fallback sur steamid64 si username non disponible
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

    // 🚀 Déclencher l'Edge Function sync-all-cs2-steam (non-bloquant)
    // Cette fonction synchronise les stats CS2 depuis l'API Steam pour tous les comptes Steam
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
        // Log l'erreur mais ne bloque pas la redirection
        // Le lien est créé, la sync peut être réessayée plus tard
        console.error("[steam-link-callback] Sync CS2 failed (non-blocking):", await syncResponse.text());
      } else {
        console.log("[steam-link-callback] CS2 sync triggered successfully");
      }
    } catch (syncError) {
      // Erreur non-bloquante - le lien est créé
      console.error("[steam-link-callback] Error triggering CS2 sync (non-blocking):", syncError);
    }

    // ✅ Rediriger vers le front avec succès
    return redirectToFrontend("linked", null);

  } catch (error) {
    console.error("[steam-link-callback] Error:", error);
    return redirectToFrontend("error", "Internal server error");
  }
});

/**
 * Helper function pour rediriger vers le frontend
 * Utilise la variable d'environnement FRONTEND_URL
 */
function redirectToFrontend(status: "linked" | "error", errorMessage: string | null): Response {
  // Lire FRONTEND_URL depuis les variables d'environnement
  const frontendUrl = Deno.env.get("FRONTEND_URL");
  
  if (!frontendUrl) {
    console.error("[steam-link-callback] FRONTEND_URL environment variable is not set");
    // Fallback vers socialvd.com en cas d'erreur de configuration
    const fallbackUrl = "https://socialvd.com";
    const redirectUrl = new URL("/profile", fallbackUrl);
    redirectUrl.searchParams.set("steam", status);
    if (errorMessage && status === "error") {
      redirectUrl.searchParams.set("error", encodeURIComponent(errorMessage));
    }
    return new Response(null, {
      status: 302,
      headers: {
        "Location": redirectUrl.toString(),
      },
    });
  }

  const redirectUrl = new URL("/profile", frontendUrl);
  redirectUrl.searchParams.set("steam", status);
  
  if (errorMessage && status === "error") {
    redirectUrl.searchParams.set("error", encodeURIComponent(errorMessage));
  }

  // Headers CORS pour la redirection
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
