import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SocialVD",
  description: "Le réseau social gaming arrive très bientôt.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
