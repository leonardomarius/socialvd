"use client";

import { useState } from "react";

export default function HomePage() {
  // states for hover effects
  const [hoverLogin, setHoverLogin] = useState(false);
  const [hoverSignup, setHoverSignup] = useState(false);

  const baseStyle = {
    backgroundColor: "rgba(0,0,0,0.85)",
    color: "#fff",
    padding: "14px 28px",
    borderRadius: "10px",
    textDecoration: "none",
    fontWeight: "bold",
    letterSpacing: "0.5px",
    border: "1px solid rgba(255,255,255,0.1)",
    transition: "0.25s ease",
  };

  return (
    <main
      style={{
        padding: "40px",
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Welcome to SocialVD</h1>
      <p>Realize how much gaming is made for you.</p>

      {/* Buttons side by side */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "30px",
          marginTop: "30px",
        }}
      >
        {/* LOGIN */}
        <a
          href="/login"
          style={{
            ...baseStyle,
            boxShadow: hoverLogin
              ? "0 0 18px rgba(0, 255, 255, 0.35)"
              : "none",
          }}
          onMouseEnter={() => setHoverLogin(true)}
          onMouseLeave={() => setHoverLogin(false)}
        >
          Log in
        </a>

        {/* SIGNUP */}
        <a
          href="/signup"
          style={{
            ...baseStyle,
            boxShadow: hoverSignup
              ? "0 0 18px rgba(0, 255, 255, 0.35)"
              : "none",
          }}
          onMouseEnter={() => setHoverSignup(true)}
          onMouseLeave={() => setHoverSignup(false)}
        >
          Sign up
        </a>
      </div>
    </main>
  );
}
