"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

export default function PageTransitionLoader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevPathRef = useRef(pathname); // ✅ Utiliser useRef pour éviter les dépendances instables

  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      // ✅ Afficher le loader seulement pendant la transition réelle
      setIsTransitioning(true);
      prevPathRef.current = pathname; // ✅ Mettre à jour la ref immédiatement

      // ✅ Timeout minimum pour éviter le flash, mais ne pas bloquer indéfiniment
      // Le loader disparaîtra dès que la nouvelle page sera montée
      const minDisplayTime = setTimeout(() => {
        setIsTransitioning(false);
      }, 200); // ✅ Réduit à 200ms pour ne pas masquer les problèmes

      // ✅ Cleanup si le composant est démonté avant la fin du timeout
      return () => {
        clearTimeout(minDisplayTime);
        setIsTransitioning(false);
      };
    }
  }, [pathname]); // ✅ Retirer prevPath des dépendances - on utilise une ref

  return (
    <>
      {isTransitioning && (
        <div className="comet-container">
          <div className="comet"></div>
        </div>
      )}

      {/* ✅ Ne pas dimmer le contenu - laisse les pages gérer leur propre état de chargement */}
      <div className="content">
        {children}
      </div>

      <style jsx>{`
        .content {
          /* ✅ Pas de transition d'opacité - laisse les pages gérer leur propre état */
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
