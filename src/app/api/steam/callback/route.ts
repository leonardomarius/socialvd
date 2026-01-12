import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    if (!supabaseUrl) {
      return NextResponse.redirect("https://socialvd.com/profile?steam=error");
    }

    const callbackUrl = new URL(`${supabaseUrl}/functions/v1/steam-link-callback`);
    
    for (const [key, value] of searchParams.entries()) {
      callbackUrl.searchParams.set(key, value);
    }

    const response = await fetch(callbackUrl.toString(), {
      method: "GET",
      headers: {
        "User-Agent": req.headers.get("User-Agent") || "Next.js",
      },
      redirect: "manual",
    });

    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get("Location");
      if (location) {
        return NextResponse.redirect(location);
      }
    }

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "text/plain",
      },
    });
  } catch (error: any) {
    console.error("[steam-callback] Error:", error);
    return NextResponse.redirect("https://socialvd.com/profile?steam=error");
  }
}
