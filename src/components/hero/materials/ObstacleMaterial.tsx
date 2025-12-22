// FILE: src/components/hero/materials/ObstacleMaterial.tsx

"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Simulation } from "../sim/Simulation";
import type { SmokeConfig } from "../SmokeHero";

const letterDVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const letterDFragmentShader = `
uniform vec2 uObstaclePos;
uniform float uObstacleSize;
uniform float uTime;

varying vec2 vUv;

float sdLetterD(vec2 p, float size) {
  p = (p - uObstaclePos) / size;
  p.x *= 0.8;
  p.y *= 1.1;
  
  float d = 1e6;
  
  float vertical = abs(p.x + 0.15) - 0.08;
  float horizontal = abs(p.y) - 0.35;
  float corner = length(max(abs(p + vec2(0.15, 0.0)) - vec2(0.25, 0.35), 0.0)) - 0.08;
  
  float outer = min(min(max(vertical, -horizontal), corner), abs(p.x + 0.15) - 0.45);
  
  float innerV = abs(p.x + 0.15) - 0.16;
  float innerH = abs(p.y) - 0.25;
  float innerC = length(max(abs(p + vec2(0.15, 0.0)) - vec2(0.15, 0.25), 0.0)) - 0.06;
  
  float inner = max(max(innerV, -innerH), innerC);
  
  d = max(outer, -inner);
  
  return d * size;
}

void main() {
  float dist = sdLetterD(vUv, uObstacleSize);
  float alpha = smoothstep(0.003, -0.003, dist);
  
  vec3 color = vec3(1.0, 0.98, 0.92);
  color = mix(color, vec3(1.0, 0.95, 0.85), 0.2);
  
  float edgeGlow = smoothstep(0.008, 0.0, abs(dist)) * 0.3;
  color += vec3(1.0, 0.9, 0.7) * edgeGlow;
  
  gl_FragColor = vec4(color, alpha * 0.95);
}
`;

export function ObstacleMaterial({
  sim,
  config,
}: {
  sim: Simulation;
  config: SmokeConfig;
}) {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: letterDVertexShader,
      fragmentShader: letterDFragmentShader,
      uniforms: {
        uObstaclePos: { value: new THREE.Vector2(...config.obstaclePosition) },
        uObstacleSize: { value: config.obstacleSize },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [config.obstaclePosition, config.obstacleSize]);

  return (
    <mesh scale={[2, 2, 1]} position={[0, 0, 0.001]}>
      <planeGeometry args={[1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

