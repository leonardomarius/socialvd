// FILE: src/components/background/AmbientGlow.tsx
// FORCE-VERCEL-REBUILD-123

"use client";

import { useEffect, useRef, useState } from "react";

interface Light {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
}

export default function AmbientGlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number | null>(null);
  const lightsRef = useRef<Light[]>([]);
  const lastTimeRef = useRef<number>(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMotionPreference = () => {
      const motionPreference = localStorage.getItem("motion");
      setReducedMotion(motionPreference === "off");
    };
    
    checkMotionPreference();
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const setCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    setCanvasSize();

    const initLights = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const lights: Light[] = [];
      
      const positions = [
        { x: 0.25, y: 0.3, dirX: 0.8, dirY: 0.6 },
        { x: 0.75, y: 0.2, dirX: -0.7, dirY: 0.9 },
        { x: 0.4, y: 0.7, dirX: 0.9, dirY: -0.5 },
        { x: 0.6, y: 0.5, dirX: -0.6, dirY: -0.8 },
        { x: 0.15, y: 0.6, dirX: 0.7, dirY: 0.7 },
        { x: 0.85, y: 0.8, dirX: -0.9, dirY: 0.4 },
        { x: 0.5, y: 0.15, dirX: 0.5, dirY: 0.9 },
      ];

      positions.forEach((pos) => {
        const dirLength = Math.sqrt(pos.dirX * pos.dirX + pos.dirY * pos.dirY);
        lights.push({
          x: width * pos.x,
          y: height * pos.y,
          dirX: pos.dirX / dirLength,
          dirY: pos.dirY / dirLength,
        });
      });

      lightsRef.current = lights;
    };

    if (lightsRef.current.length === 0) {
      initLights();
    }

    const speed = 80;
    let rafId: number;

    const animate = (currentTime: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const pixelWidth = canvas.width / (Math.min(window.devicePixelRatio, 2));
      const pixelHeight = canvas.height / (Math.min(window.devicePixelRatio, 2));

      if (!reducedMotion) {
        const deltaTime = currentTime - lastTimeRef.current;
        const deltaSeconds = Math.min(deltaTime / 1000, 0.1);
        lastTimeRef.current = currentTime;

        const margin = Math.max(width, height) * 0.15;

        lightsRef.current.forEach((light) => {
          light.x += light.dirX * speed * deltaSeconds;
          light.y += light.dirY * speed * deltaSeconds;

          if (light.x < margin || light.x > width - margin) {
            light.dirX *= -1;
            light.x = Math.max(margin, Math.min(width - margin, light.x));
          }
          if (light.y < margin || light.y > height - margin) {
            light.dirY *= -1;
            light.y = Math.max(margin, Math.min(height - margin, light.y));
          }
        });
      }

      if (reducedMotion) {
        ctx.clearRect(0, 0, pixelWidth, pixelHeight);
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
        ctx.fillRect(0, 0, pixelWidth, pixelHeight);
      }

      const coreRadius = Math.max(width, height) * 0.008;

      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 1;

      lightsRef.current.forEach((light) => {
        const coreGradient = ctx.createRadialGradient(
          light.x,
          light.y,
          0,
          light.x,
          light.y,
          coreRadius * 2
        );
        coreGradient.addColorStop(0, "rgba(255, 215, 0, 0.95)");
        coreGradient.addColorStop(0.5, "rgba(255, 220, 50, 0.4)");
        coreGradient.addColorStop(1, "rgba(255, 230, 100, 0)");

        ctx.fillStyle = coreGradient;
        ctx.fillRect(0, 0, width, height);
      });

      rafId = requestAnimationFrame(animate);
      animationIdRef.current = rafId;
    };

    lastTimeRef.current = performance.now();
    rafId = requestAnimationFrame(animate);
    animationIdRef.current = rafId;

    const handleResize = () => {
      setCanvasSize();
      const width = window.innerWidth;
      const height = window.innerHeight;
      lightsRef.current.forEach((light) => {
        light.x = Math.min(light.x, width * 0.9);
        light.y = Math.min(light.y, height * 0.9);
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [mounted, reducedMotion]);

  if (!mounted) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
