import "./globals.css";
import NavWrapper from "@/components/NavWrapper";
import AuthProvider from "@/components/AuthProvider";

export const metadata = {
  title: "SocialVD",
  description: "Le réseau social gaming",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ minHeight: "100vh", margin: 0 }}>
        
        {/* Écoute les changements de connexion */}
        <AuthProvider>

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

        </AuthProvider>

      </body>
    </html>
  );
}
