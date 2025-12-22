// FILE: src/components/hero/SmokeHero.tsx

"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const SmokeCanvas = dynamic(() => import("./SmokeCanvas"), {
  ssr: false,
});

export interface SmokeConfig {
  emissionRate: number;
  dissipation: number;
  curl: number;
  noiseScale: number;
  obstacleSize: number;
  obstaclePosition: [number, number];
  opacity: number;
  speed: number;
}

const DEFAULT_CONFIG: SmokeConfig = {
  emissionRate: 0.15,
  dissipation: 0.98,
  curl: 0.03,
  noiseScale: 2.0,
  obstacleSize: 0.25,
  obstaclePosition: [0.5, 0.5],
  opacity: 0.8,
  speed: 1.2,
};

export default function SmokeHero({
  config = DEFAULT_CONFIG,
  className = "",
}: {
  config?: Partial<SmokeConfig>;
  className?: string;
}) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return (
    <div
      className={`hero-container ${className}`}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      {mounted && !reducedMotion && (
        <SmokeCanvas config={finalConfig} />
      )}
      {mounted && reducedMotion && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 50% 50%, rgba(250, 204, 21, 0.03) 0%, transparent 70%)",
            opacity: 0.3,
          }}
        />
      )}
    </div>
  );
}

