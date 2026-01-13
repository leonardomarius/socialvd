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
    // Step 1: Fetch game_account_links
    // Select ONLY public columns to avoid 403 (access_token, refresh_token are private)
    const { data: links, error: linksError } = await supabase
      .from("game_account_links")
      .select(`
        id,
        user_id,
        game_id,
        provider,
        external_account_id,
        username,
        linked_at,
        revoked_at
      `)
      .eq("user_id", userId)
      .is("revoked_at", null)
      .order("linked_at", { ascending: false });

    // RULE: Error is real ONLY if error?.message exists
    if (linksError?.message) {
      console.error("[loadGameAccounts] Error fetching game_account_links:", linksError);
      return [];
    }


    // Use data if available, otherwise empty array
    const validLinks = links ?? [];
    if (validLinks.length === 0) {
      return [];
    }

    // Step 2: Fetch games for the game_ids
    const gameIds = [...new Set(validLinks.map((link) => link.game_id).filter(Boolean))];
    if (gameIds.length === 0) {
      return [];
    }

    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("id, name, slug")
      .in("id", gameIds);

    // RULE: Error is real ONLY if error?.message exists
    if (gamesError?.message) {
      console.error("[loadGameAccounts] Error fetching games:", gamesError);
      return [];
    }

    // Step 3: Merge and map to GameAccount type
    const validGames = games ?? [];
    const gamesMap = new Map(validGames.map((game) => [game.id, game]));

    const accounts: GameAccount[] = validLinks.map((link) => {
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
