/**
 * CS2 Utilities
 * Helper functions to identify CS2 and handle CS2-specific operations
 */

/**
 * Check if a game name/slug is CS2
 */
export function isCS2(game: string | null | undefined): boolean {
  if (!game) return false;
  const normalized = game.toLowerCase().trim();
  return (
    normalized === "cs2" ||
    normalized === "counter-strike 2" ||
    normalized === "counterstrike 2" ||
    normalized === "cs:2" ||
    normalized === "csgo2"
  );
}

/**
 * Check if a game account is CS2 (by game field)
 */
export function isCS2Account(game: string | null | undefined): boolean {
  return isCS2(game);
}

/**
 * Check if a performance is CS2 (by game_name field)
 */
export function isCS2Performance(gameName: string | null | undefined): boolean {
  return isCS2(gameName);
}

/**
 * Call the CS2 sync Edge Function
 * @param supabaseClient - The Supabase client instance
 * @param userId - The user ID to sync CS2 stats for
 * @returns Promise with success/error information
 */
export async function syncCS2Stats(
  supabaseClient: any,
  userId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data, error } = await supabaseClient.functions.invoke(
      "sync-cs2-steam",
      {
        body: { user_id: userId },
      }
    );

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to sync CS2 stats",
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Unexpected error during sync",
    };
  }
}

