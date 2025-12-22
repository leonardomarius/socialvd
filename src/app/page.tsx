// FILE: src/app/page.tsx

"use client";

import { useState } from "react";
import AmbientGlow from "@/components/background/AmbientGlow";

export default function HomePage() {
  const [hoverLogin, setHoverLogin] = useState(false);
  const [hoverSignup, setHoverSignup] = useState(false);

  const baseStyle = {
    backgroundColor: "rgba(30, 30, 30, 0.8)",
    color: "#fff",
    padding: "14px 28px",
    borderRadius: "10px",
    textDecoration: "none",
    fontWeight: "bold",
    letterSpacing: "0.5px",
    transition: "0.25s ease",
  };

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
        className="home-animate"
        style={{
          position: "relative",
          zIndex: 10,
          padding: "40px",
          maxWidth: "600px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h1 className="home-animate home-delay-1">
          Welcome to SocialVD
        </h1>
        <p className="home-animate home-delay-2">
          Realize how much gaming is made for you.
        </p>

        <div
          className="home-animate home-delay-3"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "30px",
            marginTop: "30px",
          }}
        >
          <a
            href="/login"
            style={{
              ...baseStyle,
              border: "1px solid rgba(255, 215, 0, 0.3)",
              boxShadow: hoverLogin
                ? "0 2px 8px rgba(255, 215, 0, 0.25), 0 0 20px rgba(255, 215, 0, 0.2)"
                : "0 1px 3px rgba(0, 0, 0, 0.4), 0 0 12px rgba(255, 215, 0, 0.15)",
              transition: "all 0.2s",
            }}
            onMouseEnter={() => setHoverLogin(true)}
            onMouseLeave={() => setHoverLogin(false)}
          >
            Log in
          </a>

          <a
            href="/signup"
            style={{
              ...baseStyle,
              border: "1px solid rgba(255, 215, 0, 0.3)",
              boxShadow: hoverSignup
                ? "0 2px 8px rgba(255, 215, 0, 0.25), 0 0 20px rgba(255, 215, 0, 0.2)"
                : "0 1px 3px rgba(0, 0, 0, 0.4), 0 0 12px rgba(255, 215, 0, 0.15)",
              transition: "all 0.2s",
            }}
            onMouseEnter={() => setHoverSignup(true)}
            onMouseLeave={() => setHoverSignup(false)}
          >
            Sign up
          </a>
        </div>
      </main>
    </div>
  );
}
