"use client";

import AmbientGlow from "@/components/background/AmbientGlow";

// ✅ Composant de fallback pour Suspense (affiche un état de chargement pendant que searchParams se charge)
export default function AuthCallbackFallback() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#1a1a1a",
      }}
    >
      <AmbientGlow />
      <main
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "400px",
          width: "100%",
          margin: "60px auto",
          padding: "40px",
          textAlign: "center",
          color: "#ffffff",
        }}
      >
        <h1 style={{ marginBottom: 20, fontSize: "1.5rem", fontWeight: 700 }}>
          Authenticating...
        </h1>
        <p style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.7)" }}>
          Please wait while we complete your authentication.
        </p>
      </main>
    </div>
  );
}
