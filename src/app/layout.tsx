import "./globals.css";
import NavWrapper from "@/components/NavWrapper";
import AuthProvider from "@/components/AuthProvider";
import PageTransitionLoader from "@/components/PageTransitionLoader";

export const metadata = {
  title: "SocialVD",
  description: "Le réseau social gaming",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* POLICE SPACE GROTESK */}
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>

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
