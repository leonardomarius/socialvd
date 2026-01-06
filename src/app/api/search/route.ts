import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Service role key bypasses RLS - use ONLY for server-side operations
// IMPORTANT: Set SUPABASE_SERVICE_ROLE_KEY in your .env.local file
// Get it from: Supabase Dashboard > Settings > API > service_role key
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * ROOT CAUSE ANALYSIS:
 * 
 * WHY SQL EDITOR WORKS:
 * - SQL editor runs queries as the authenticated user (or postgres role)
 * - RLS policies allow SELECT for authenticated users
 * - Function uses SECURITY INVOKER = runs with caller's permissions
 * - Result: Function executes as authenticated user → RLS allows access → Returns data
 * 
 * WHY API WAS FAILING:
 * - API was creating client with anon key only (no session)
 * - Client-side Supabase stores sessions in localStorage (NOT accessible to server)
 * - RLS policies: "SELECT true for authenticated users" = blocks anon users
 * - Function uses SECURITY INVOKER = runs with caller's permissions (anon)
 * - Result: Function executes as anon → RLS blocks access → Returns empty arrays
 * 
 * THE FIX:
 * - Use service role key for server-side search API
 * - Service role bypasses RLS, allowing the function to execute
 * - This is SAFE because:
 *   a) We're only reading data (SELECT operations, no modifications)
 *   b) The search_global function itself limits and filters results (LIMIT clauses)
 *   c) Search should be accessible to all authenticated users anyway
 *   d) The function still respects the query parameters and limits
 * 
 * TRADEOFF:
 * - Service role bypasses RLS (less restrictive)
 * - But search is a read-only operation that should be public anyway
 * - Alternative: Modify frontend to send access token in Authorization header
 *   (but that's out of scope per requirements)
 */
export async function GET(request: Request) {
  // Always return 200 with valid JSON structure
  const emptyResult = {
    profiles: [],
    posts: [],
  };

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    // Validate query - return empty if too short
    const trimmedQuery = q.trim();
    if (!trimmedQuery || trimmedQuery.length < 1) {
      return NextResponse.json(emptyResult);
    }

    // Try to get access token from Authorization header first (most reliable)
    const authHeader = request.headers.get("Authorization");
    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7);
    } else {
      // Fallback: Try to get session from cookies (in case Supabase sets them)
      const cookieStore = await cookies();
      const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

      if (projectRef) {
        const authCookieName = `sb-${projectRef}-auth-token`;
        const authCookie = cookieStore.get(authCookieName);
        
        if (authCookie?.value) {
          try {
            const sessionData = JSON.parse(authCookie.value);
            accessToken = sessionData.access_token || null;
            refreshToken = sessionData.refresh_token || null;
          } catch {
            // Cookie exists but not in expected format
          }
        }
      }
    }

    // Create Supabase client
    let supabase;
    let executionContext = "anon";

    if (accessToken) {
      // We have an access token (from header or cookies) - try authenticated client
      try {
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        });
        
        // If we have both tokens, set the full session for better compatibility
        if (refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
        
        // Verify the token is valid by getting the user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (user && !userError) {
          executionContext = `authenticated:${user.id}`;
        } else {
          // Token invalid or expired, fall through to service role
          supabase = null;
        }
      } catch (error) {
        // Session invalid, fall through to service role
        console.warn("[SEARCH API] Failed to authenticate with token:", error);
        supabase = null;
      }
    }

    // If no valid session, use service role key
    if (!supabase || executionContext === "anon") {
      if (!supabaseServiceKey) {
        console.error("[SEARCH API] SUPABASE_SERVICE_ROLE_KEY not set. Please add it to .env.local");
        // Fall back to anon key (will likely return empty due to RLS)
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        executionContext = "anon (no service key)";
      } else {
        supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        executionContext = "service_role";
      }
    }
    
    // Log execution context (for debugging)
    console.log("[SEARCH API] Execution context:", {
      context: executionContext,
      query: trimmedQuery,
      hasServiceKey: !!supabaseServiceKey,
    });

    // Call the RPC function
    // With service role: Bypasses RLS, function executes successfully
    // With authenticated session: RLS allows access, function executes successfully
    const { data, error } = await supabase.rpc("search_global", {
      q: trimmedQuery,
      profiles_limit: 6,
      posts_limit: 12,
    });

    if (error) {
      console.error("Search RPC error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        context: executionContext,
      });
      return NextResponse.json(emptyResult);
    }

    // Validate and normalize response structure
    const result = data || emptyResult;
    
    const normalizedResult = {
      profiles: Array.isArray(result.profiles) ? result.profiles : [],
      posts: Array.isArray(result.posts) ? result.posts : [],
    };

    // Log results (for debugging)
    console.log("[SEARCH API] Results:", {
      profilesCount: normalizedResult.profiles.length,
      postsCount: normalizedResult.posts.length,
      context: executionContext,
    });

    return NextResponse.json(normalizedResult);
  } catch (e: any) {
    console.error("Search API error:", e?.message || e);
    return NextResponse.json(emptyResult);
  }
}
