import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Si erreur OAuth, rediriger vers login avec message d'erreur
  if (error) {
    const errorMsg = errorDescription || "Google authentication failed. Please try again.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMsg)}`, requestUrl.origin));
  }

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !data.session?.user) {
      // Erreur lors de l'échange du code
      return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent("Google authentication failed. Please try again."), requestUrl.origin));
    }

    // Vérifier si le profil est complet
    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudo, bio")
      .eq("id", data.session.user.id)
      .single();

    const isProfileComplete = !!(profile && profile.pseudo && profile.bio);

    // Redirection selon l'état du profil
    if (isProfileComplete) {
      // LOGIN : profil complet → redirection vers /feed
      return NextResponse.redirect(new URL("/feed", requestUrl.origin));
    } else {
      // SIGNUP : profil incomplet → redirection vers /onboarding
      return NextResponse.redirect(new URL("/onboarding", requestUrl.origin));
    }
  }

  // En cas d'absence de code, redirection vers login
  return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent("Google authentication failed. Please try again."), requestUrl.origin));
}

