import "./globals.css";
import NavWrapper from "@/components/NavWrapper"; // ← ton wrapper client

export const metadata = {
  title: "SocialVD",
  description: "Le réseau social gaming",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ minHeight: "100vh", margin: 0 }}>
        
        {/* Navbar contrôlé par NavWrapper */}
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

      </body>
    </html>
  );
}
