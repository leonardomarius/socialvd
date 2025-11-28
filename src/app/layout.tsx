import "./globals.css";
import NavWrapper from "@/components/NavWrapper";
import AuthProvider from "@/components/AuthProvider";
import PageTransitionLoader from "@/components/PageTransitionLoader";
import { Inter_Tight } from "next/font/google";

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
    <html lang="eng" className={interTight.className}>
      
      <body style={{ minHeight: "100vh", margin: 0 }}>
        {/* Gestion session Supabase */}
        <AuthProvider>
          {/* Loader transition */}
          <PageTransitionLoader>
            {/* Navbar dynamique */}
            <NavWrapper />

            <main
              style={{
                maxWidth: "800px",
                margin: "0 auto",
                padding: "20px",
              }}
            >
              {children}
            </main>
          </PageTransitionLoader>
        </AuthProvider>
      </body>
    </html>
  );
}
