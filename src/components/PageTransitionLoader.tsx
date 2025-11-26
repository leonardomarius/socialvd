"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function PageTransitionLoader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);

  useEffect(() => {
    if (pathname !== prevPath) {
      setLoading(true);

      const timeout = setTimeout(() => {
        setLoading(false);
        setPrevPath(pathname);
      }, 600); // durée d’apparition

      return () => clearTimeout(timeout);
    }
  }, [pathname, prevPath]);

  return (
    <>
      {loading && (
        <div className="comet-container">
          <div className="comet"></div>
        </div>
      )}

      <div className={loading ? "content dimmed" : "content"}>
        {children}
      </div>

      <style jsx>{`
        .content {
          transition: opacity 0.3s ease;
        }

        .dimmed {
          opacity: 0.3;
        }

        /* Conteneur de la comète */
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

        /* La comète */
        .comet {
          position: absolute;
          top: 0;
          height: 100%;
          width: 35%;
          /* Noyau lumineux */
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

        /* Animation : traverse la largeur du site */
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
