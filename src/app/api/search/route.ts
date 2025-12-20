import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

    // Create server client
    // The RPC function uses SECURITY INVOKER, so it runs with the caller's permissions
    // We'll pass the auth token via Authorization header if available
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Try to get auth token from request headers or cookies
    const authHeader = request.headers.get("authorization");
    let accessToken: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7);
    } else {
      // Try to get from cookies (Supabase client-side stores session in localStorage/cookies)
      // For server-side, we'll rely on RLS policies which allow authenticated users
      const cookieStore = await cookies();
      // Supabase may store tokens in various cookie formats
      // Since we can't reliably parse them without @supabase/ssr, we'll use anon key
      // RLS policies on the RPC function will handle permissions
    }

    // If we have an access token, set it
    if (accessToken) {
      try {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: "", // Not needed for RPC calls
        });
      } catch (sessionError) {
        // Continue without session - RLS will handle it
        console.warn("Could not set session from token");
      }
    }

    // Call the RPC function with explicit parameter types
    const { data, error } = await supabase.rpc("search_global", {
      q: trimmedQuery,
      profiles_limit: 6,
      posts_limit: 12,
    });

    if (error) {
      console.error("Search RPC error:", error.message || error);
      // Return empty results instead of error - never throw
      return NextResponse.json(emptyResult);
    }

    // Validate and normalize response structure
    const result = data || emptyResult;
    
    // Ensure profiles and posts are arrays
    const normalizedResult = {
      profiles: Array.isArray(result.profiles) ? result.profiles : [],
      posts: Array.isArray(result.posts) ? result.posts : [],
    };

    return NextResponse.json(normalizedResult);
  } catch (e: any) {
    // Catch all errors and return empty results - never throw
    console.error("Search API error:", e?.message || e);
    return NextResponse.json(emptyResult);
  }
}

