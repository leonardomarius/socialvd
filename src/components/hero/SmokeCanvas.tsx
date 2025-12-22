// FILE: src/components/hero/SmokeCanvas.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Simulation } from "./sim/Simulation";
import { SmokeMaterial } from "./materials/SmokeMaterial";
import { ObstacleMaterial } from "./materials/ObstacleMaterial";
import type { SmokeConfig } from "./SmokeHero";
import * as THREE from "three";

const SIM_SIZE = 256;

function SmokeScene({ config }: { config: SmokeConfig }) {
  const { gl } = useThree();
  const simRef = useRef<Simulation | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);

  useEffect(() => {
    const sim = new Simulation(SIM_SIZE, gl);
    simRef.current = sim;
    setSimulation(sim);
    return () => {
      sim.dispose();
    };
  }, [gl]);

  useFrame((state, delta) => {
    if (!simRef.current) return;
    simRef.current.step(delta, config);
  });

  if (!simulation) return null;

  return (
    <>
      <ObstacleMaterial sim={simulation} config={config} />
      <SmokeMaterial sim={simulation} config={config} />
    </>
  );
}

export default function SmokeCanvas({ config }: { config: SmokeConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    const updateDpr = () => {
      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      setDpr(pixelRatio);
    };

    updateDpr();
    window.addEventListener("resize", updateDpr);
    return () => window.removeEventListener("resize", updateDpr);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <Canvas
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: false,
        }}
        dpr={dpr}
        camera={{ position: [0, 0, 1], fov: 75 }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <SmokeScene config={config} />
      </Canvas>
    </div>
  );
}

