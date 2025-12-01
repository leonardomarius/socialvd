"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function PageTransitionLoader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);

  useEffect(() => {
  // ⛔ Si le pathname n’a pas changé → NE PAS lancer le loader
  if (pathname === prevPath) return;

  // ✔ Si le pathname change réellement → charger
  setLoading(true);

  const timeout = setTimeout(() => {
    setLoading(false);
    setPrevPath(pathname);
  }, 600);

  return () => clearTimeout(timeout);
}, [pathname, prevPath]);

  return (
    <>
      {/* ← La comète uniquement */}
      {loading && (
        <div className="comet-container">
          <div className="comet"></div>
        </div>
      )}

      {/* ← SUPPRESSION TOTALE DU DIMMING */}
      <div className="content-no-dim">{children}</div>

      <style jsx>{`
        .content-no-dim {
          /* On ne touche plus l'opacité */
          opacity: 1 !important;
        }

        .comet-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 4px;
          overflow: hidden;
          pointer-events: none;
          z-index: 9999;
        }

        .comet {
          position: absolute;
          top: 0;
          height: 100%;
          width: 35%;
          background: linear-gradient(
            90deg,
            rgba(135, 132, 132, 0.9) 0%,
            rgba(95, 95, 82, 0.8) 40%,
            rgba(69, 69, 67, 0.5) 100%
          );
          border-radius: 10px;
          box-shadow:
            0 0 8px rgba(255, 255, 220, 0.7),
            0 0 14px rgba(255, 240, 180, 0.4);
          animation: cometMove 0.6s ease-out forwards;
        }

        @keyframes cometMove {
          0% {
            transform: translateX(-120%);
            opacity: 0.6;
          }
          40% {
            opacity: 1;
          }
          100% {
            transform: translateX(200%);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
