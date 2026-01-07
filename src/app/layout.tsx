import "./globals.css";
import NavWrapper from "@/components/NavWrapper";
import AuthProvider from "@/components/AuthProvider";
import PageTransitionLoader from "@/components/PageTransitionLoader";
import { Inter_Tight } from "next/font/google";

// 👉 AJOUTS
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata = {
  title: "SocialVD",
  description: "Le réseau social gaming",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={interTight.className}>
      <body style={{ minHeight: "100vh", margin: 0 }}>
        {/* ✅ Gestion session Supabase - NE BLOQUE JAMAIS le render */}
        <AuthProvider>
          {/* ✅ Loader transition - non-bloquant */}
          <PageTransitionLoader>
            {/* ✅ Navbar dynamique - non-bloquant */}
            <NavWrapper />

            {/* ✅ Main content - toujours rendu, même si loading */}
            <main
              style={{
                maxWidth: "800px",
                margin: "0 auto",
                padding: "0",
              }}
            >
              {children}
            </main>
          </PageTransitionLoader>
        </AuthProvider>

        {/* 👉 AJOUT : Web Analytics */}
        <Analytics />

        {/* 👉 AJOUT : SpeedInsights */}
        <SpeedInsights />

      </body>
    </html>
  );
}
