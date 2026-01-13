import { SupabaseClient } from "@supabase/supabase-js";

export type GameAccount = {
  id: string;
  user_id: string;
  game: string;
  username: string;
  platform: string | null;
  verified: boolean;
};

export async function loadGameAccounts(
  supabase: SupabaseClient,
  userId: string
): Promise<GameAccount[]> {
  try {
    // Check session first - DO NOT query if session is not ready
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return [];
    }

    // Step 1: Fetch game_account_links
    const { data: links, error: linksError } = await supabase
      .from("game_account_links")
      .select("id, user_id, game_id, provider, external_account_id, username, linked_at")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .order("linked_at", { ascending: false });

    if (Array.isArray(links)) {
      // Data is valid, ignore error object even if present
      if (links.length === 0) {
        return [];
      }
      // Continue to step 2 with valid data
    } else {
      // Data is not valid, check if there's a real error
      if (linksError) {
        const errorMessage = linksError.message;
        const errorCode = linksError.code;
        const errorDetails = linksError.details;
        const errorHint = linksError.hint;

        const hasRealError =
          (errorMessage && typeof errorMessage === "string" && errorMessage.trim().length > 0) ||
          (errorCode && typeof errorCode === "string" && errorCode.trim().length > 0) ||
          (errorDetails && typeof errorDetails === "string" && errorDetails.trim().length > 0) ||
          (errorHint && typeof errorHint === "string" && errorHint.trim().length > 0);

        if (hasRealError) {
          const errorObj: any = {};
          if (errorMessage && typeof errorMessage === "string" && errorMessage.trim().length > 0) errorObj.message = errorMessage;
          if (errorCode && typeof errorCode === "string" && errorCode.trim().length > 0) errorObj.code = errorCode;
          if (errorDetails && typeof errorDetails === "string" && errorDetails.trim().length > 0) errorObj.details = errorDetails;
          if (errorHint && typeof errorHint === "string" && errorHint.trim().length > 0) errorObj.hint = errorHint;
          console.error("[loadGameAccounts] Error fetching game_account_links:", errorObj);
        }
      }
      return [];
    }

    // Step 2: Fetch games for the game_ids
    const gameIds = [...new Set(links.map((link) => link.game_id).filter(Boolean))];
    if (gameIds.length === 0) {
      return [];
    }

    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("id, name, slug")
      .in("id", gameIds);

    if (!Array.isArray(games)) {
      // Data is not valid, check if there's a real error
      if (gamesError) {
        const errorMessage = gamesError.message;
        const errorCode = gamesError.code;
        const errorDetails = gamesError.details;
        const errorHint = gamesError.hint;

        const hasRealError =
          (errorMessage && typeof errorMessage === "string" && errorMessage.trim().length > 0) ||
          (errorCode && typeof errorCode === "string" && errorCode.trim().length > 0) ||
          (errorDetails && typeof errorDetails === "string" && errorDetails.trim().length > 0) ||
          (errorHint && typeof errorHint === "string" && errorHint.trim().length > 0);

        if (hasRealError) {
          const errorObj: any = {};
          if (errorMessage && typeof errorMessage === "string" && errorMessage.trim().length > 0) errorObj.message = errorMessage;
          if (errorCode && typeof errorCode === "string" && errorCode.trim().length > 0) errorObj.code = errorCode;
          if (errorDetails && typeof errorDetails === "string" && errorDetails.trim().length > 0) errorObj.details = errorDetails;
          if (errorHint && typeof errorHint === "string" && errorHint.trim().length > 0) errorObj.hint = errorHint;
          console.error("[loadGameAccounts] Error fetching games:", errorObj);
        }
      }
      return [];
    }

    // Step 3: Merge and map to GameAccount type
    const gamesMap = new Map((games || []).map((game) => [game.id, game]));

    const accounts: GameAccount[] = links.map((link) => {
      const game = gamesMap.get(link.game_id);
      return {
        id: link.id,
        user_id: link.user_id,
        game: game?.name || game?.slug || "Unknown",
        username: link.username || link.external_account_id,
        platform: link.provider === "steam" ? "Steam" : link.provider || null,
        verified: link.provider === "steam",
      };
    });

    return accounts;
  } catch (error: any) {
    console.error("[loadGameAccounts] Exception:", error);
    return [];
  }
}
