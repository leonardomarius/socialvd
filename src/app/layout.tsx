import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "SocialVD",
  description: "Le réseau social gaming",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          // ❗ Ici on enlève backgroundColor blanc/noir
          // pour laisser globals.css gérer le fond SPATIAL
          minHeight: "100vh",
          margin: 0,
        }}
      >
        <Navbar />

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
