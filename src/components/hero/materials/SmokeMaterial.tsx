// FILE: src/components/hero/materials/SmokeMaterial.tsx

"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Simulation } from "../sim/Simulation";
import type { SmokeConfig } from "../SmokeHero";

const displayVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const displayFragmentShader = `
uniform sampler2D uDensity;
uniform sampler2D uObstacle;
uniform float uOpacity;
uniform float uTime;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float grain(vec2 uv) {
  return noise(uv * 512.0 + uTime * 0.1) * 0.02;
}

float dither(vec2 uv) {
  return (hash(uv + uTime * 0.01) - 0.5) / 256.0;
}

void main() {
  vec4 density = texture2D(uDensity, vUv);
  vec4 obstacle = texture2D(uObstacle, vUv);
  
  float smoke = density.r;
  smoke = pow(smoke, 1.5);
  smoke *= uOpacity;
  
  vec3 color = vec3(0.95, 0.97, 1.0);
  color = mix(color, vec3(1.0, 0.95, 0.85), smoke * 0.1);
  
  color += grain(vUv);
  color += dither(vUv);
  
  float alpha = smoke;
  
  if (obstacle.x > 0.1) {
    alpha = 0.0;
  }
  
  gl_FragColor = vec4(color, alpha);
}
`;

export function SmokeMaterial({
  sim,
  config,
}: {
  sim: Simulation;
  config: SmokeConfig;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(0);

  const material = useMemo(() => {
    const mat = sim.getDisplayMaterial();
    mat.uniforms.uOpacity.value = config.opacity;
    return mat;
  }, [sim, config.opacity]);

  useFrame((state, delta) => {
    if (!materialRef.current) return;
    timeRef.current += delta;
    materialRef.current.uniforms.uTime.value = timeRef.current;
    materialRef.current.uniforms.uDensity.value = sim.getDensityTexture();
    materialRef.current.uniforms.uObstacle.value = sim.getObstacleTexture();
    materialRef.current.uniforms.uOpacity.value = config.opacity;
  });

  return (
    <mesh scale={[2, 2, 1]} position={[0, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={displayVertexShader}
        fragmentShader={displayFragmentShader}
        uniforms={{
          uDensity: { value: sim.getDensityTexture() },
          uObstacle: { value: sim.getObstacleTexture() },
          uOpacity: { value: config.opacity },
          uTime: { value: 0 },
        }}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

