import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createMiddlewareClient({ req, res });
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  const pathname = req.nextUrl.pathname;

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/signup");

  // Si pas connecté → redirection vers login
  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Si connecté et sur login/signup → redirection vers /feed
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/feed", req.url));
  }

  return res;
}

// Important : indique à Next.js que ce middleware s'applique à toutes les routes
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
