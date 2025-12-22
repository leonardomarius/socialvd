// FILE: src/components/hero/sim/Simulation.ts

import * as THREE from "three";
import type { SmokeConfig } from "../SmokeHero";

const advectionShader = `
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform sampler2D uObstacle;
uniform float uDx;
uniform float uDissipation;
uniform float uDt;
varying vec2 vUv;
void main() {
  vec2 coord = vUv - uDt * uDx * texture2D(uVelocity, vUv).xy;
  vec4 obstacle = texture2D(uObstacle, vUv);
  if (obstacle.x > 0.1) {
    gl_FragColor = vec4(0.0);
  } else {
    gl_FragColor = uDissipation * texture2D(uSource, coord);
  }
}
`;

const divergenceShader = `
uniform sampler2D uVelocity;
uniform sampler2D uObstacle;
uniform float uDx;
varying vec2 vUv;
void main() {
  vec2 xOffset = vec2(uDx, 0.0);
  vec2 yOffset = vec2(0.0, uDx);
  float L = texture2D(uVelocity, vUv - xOffset).x;
  float R = texture2D(uVelocity, vUv + xOffset).x;
  float B = texture2D(uVelocity, vUv - yOffset).y;
  float T = texture2D(uVelocity, vUv + yOffset).y;
  vec2 obstacleL = texture2D(uObstacle, vUv - xOffset).xy;
  vec2 obstacleR = texture2D(uObstacle, vUv + xOffset).xy;
  vec2 obstacleB = texture2D(uObstacle, vUv - yOffset).xy;
  vec2 obstacleT = texture2D(uObstacle, vUv + yOffset).xy;
  if (obstacleL.x > 0.1) L = 0.0;
  if (obstacleR.x > 0.1) R = 0.0;
  if (obstacleB.x > 0.1) B = 0.0;
  if (obstacleT.x > 0.1) T = 0.0;
  float div = 0.5 * (R - L + T - B) / uDx;
  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
}
`;

const pressureShader = `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform sampler2D uObstacle;
uniform float uDx;
varying vec2 vUv;
void main() {
  vec2 xOffset = vec2(uDx, 0.0);
  vec2 yOffset = vec2(0.0, uDx);
  float L = texture2D(uPressure, vUv - xOffset).x;
  float R = texture2D(uPressure, vUv + xOffset).x;
  float B = texture2D(uPressure, vUv - yOffset).x;
  float T = texture2D(uPressure, vUv + yOffset).x;
  float div = texture2D(uDivergence, vUv).x;
  vec2 obstacle = texture2D(uObstacle, vUv).xy;
  if (obstacle.x > 0.1) {
    gl_FragColor = vec4(0.0);
  } else {
    gl_FragColor = vec4((L + R + B + T - div * uDx * uDx) * 0.25, 0.0, 0.0, 1.0);
  }
}
`;

const gradientSubtractShader = `
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform sampler2D uObstacle;
uniform float uDx;
varying vec2 vUv;
void main() {
  vec2 xOffset = vec2(uDx, 0.0);
  vec2 yOffset = vec2(0.0, uDx);
  float pL = texture2D(uPressure, vUv - xOffset).x;
  float pR = texture2D(uPressure, vUv + xOffset).x;
  float pB = texture2D(uPressure, vUv - yOffset).x;
  float pT = texture2D(uPressure, vUv + yOffset).x;
  vec2 obstacle = texture2D(uObstacle, vUv).xy;
  vec2 vel = texture2D(uVelocity, vUv).xy;
  if (obstacle.x > 0.1) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    vec2 grad = vec2(pR - pL, pT - pB) * 0.5 / uDx;
    vec2 newVel = vel - grad;
    gl_FragColor = vec4(newVel, 0.0, 1.0);
  }
}
`;

const vorticityShader = `
uniform sampler2D uVelocity;
uniform float uDx;
varying vec2 vUv;
void main() {
  vec2 xOffset = vec2(uDx, 0.0);
  vec2 yOffset = vec2(0.0, uDx);
  float L = texture2D(uVelocity, vUv - xOffset).y;
  float R = texture2D(uVelocity, vUv + xOffset).y;
  float B = texture2D(uVelocity, vUv - yOffset).x;
  float T = texture2D(uVelocity, vUv + yOffset).x;
  float vorticity = (R - L - T + B) * 0.5 / uDx;
  gl_FragColor = vec4(vorticity, 0.0, 0.0, 1.0);
}
`;

const vorticityForceShader = `
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlScale;
uniform float uDx;
varying vec2 vUv;
void main() {
  vec2 xOffset = vec2(uDx, 0.0);
  vec2 yOffset = vec2(0.0, uDx);
  float L = texture2D(uCurl, vUv - xOffset).x;
  float R = texture2D(uCurl, vUv + xOffset).x;
  float B = texture2D(uCurl, vUv - yOffset).x;
  float T = texture2D(uCurl, vUv + yOffset).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = vec2(abs(T) - abs(B), abs(R) - abs(L));
  force *= uCurlScale / (length(force) + 1e-5);
  force *= C;
  vec2 vel = texture2D(uVelocity, vUv).xy;
  gl_FragColor = vec4(vel + force * uDx, 0.0, 1.0);
}
`;

const splatShader = `
uniform sampler2D uTarget;
uniform sampler2D uObstacle;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec4 obstacle = texture2D(uObstacle, vUv);
  if (obstacle.x > 0.1) {
    gl_FragColor = vec4(0.0);
  } else {
    vec4 base = texture2D(uTarget, vUv);
    float dist = length(vUv - uPoint);
    float alpha = exp(-dist * dist / uRadius);
    gl_FragColor = base + vec4(uColor * alpha, alpha);
  }
}
`;

const obstacleShader = `
uniform vec2 uObstaclePos;
uniform float uObstacleSize;
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
  float alpha = smoothstep(0.005, -0.005, dist);
  vec2 normal = vec2(
    sdLetterD(vUv + vec2(0.001, 0.0), uObstacleSize) - sdLetterD(vUv - vec2(0.001, 0.0), uObstacleSize),
    sdLetterD(vUv + vec2(0.0, 0.001), uObstacleSize) - sdLetterD(vUv - vec2(0.0, 0.001), uObstacleSize)
  );
  normal = normalize(normal);
  gl_FragColor = vec4(alpha, normal.x, normal.y, 1.0);
}
`;

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export class Simulation {
  size: number;
  renderer: THREE.WebGLRenderer;
  
  velocity: THREE.WebGLRenderTarget;
  velocityOld: THREE.WebGLRenderTarget;
  density: THREE.WebGLRenderTarget;
  densityOld: THREE.WebGLRenderTarget;
  pressure: THREE.WebGLRenderTarget;
  pressureOld: THREE.WebGLRenderTarget;
  divergence: THREE.WebGLRenderTarget;
  curl: THREE.WebGLRenderTarget;
  obstacle: THREE.WebGLRenderTarget;
  
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  geometry: THREE.PlaneGeometry;
  
  advectionMaterial: THREE.ShaderMaterial;
  divergenceMaterial: THREE.ShaderMaterial;
  pressureMaterial: THREE.ShaderMaterial;
  gradientSubtractMaterial: THREE.ShaderMaterial;
  vorticityMaterial: THREE.ShaderMaterial;
  vorticityForceMaterial: THREE.ShaderMaterial;
  splatMaterial: THREE.ShaderMaterial;
  obstacleMaterial: THREE.ShaderMaterial;
  displayMaterial: THREE.ShaderMaterial;
  
  mesh: THREE.Mesh;
  frame: number = 0;

  constructor(size: number, renderer: THREE.WebGLRenderer) {
    this.size = size;
    this.renderer = renderer;
    
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.geometry = new THREE.PlaneGeometry(2, 2);
    
    const rtOptions: THREE.RenderTargetOptions = {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    };
    
    this.velocity = new THREE.WebGLRenderTarget(size, size, rtOptions);
    this.velocityOld = new THREE.WebGLRenderTarget(size, size, rtOptions);
    this.density = new THREE.WebGLRenderTarget(size, size, rtOptions);
    this.densityOld = new THREE.WebGLRenderTarget(size, size, rtOptions);
    this.pressure = new THREE.WebGLRenderTarget(size, size, rtOptions);
    this.pressureOld = new THREE.WebGLRenderTarget(size, size, rtOptions);
    this.divergence = new THREE.WebGLRenderTarget(size, size, rtOptions);
    this.curl = new THREE.WebGLRenderTarget(size, size, rtOptions);
    this.obstacle = new THREE.WebGLRenderTarget(size, size, rtOptions);
    
    this.advectionMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uVelocity: { value: null },
        uSource: { value: null },
        uObstacle: { value: null },
        uDx: { value: 1.0 / size },
        uDissipation: { value: 0.98 },
        uDt: { value: 1 / 60 },
      },
      vertexShader,
      fragmentShader: advectionShader,
    });
    
    this.divergenceMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uVelocity: { value: null },
        uObstacle: { value: null },
        uDx: { value: 1.0 / size },
      },
      vertexShader,
      fragmentShader: divergenceShader,
    });
    
    this.pressureMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPressure: { value: null },
        uDivergence: { value: null },
        uObstacle: { value: null },
        uDx: { value: 1.0 / size },
      },
      vertexShader,
      fragmentShader: pressureShader,
    });
    
    this.gradientSubtractMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPressure: { value: null },
        uVelocity: { value: null },
        uObstacle: { value: null },
        uDx: { value: 1.0 / size },
      },
      vertexShader,
      fragmentShader: gradientSubtractShader,
    });
    
    this.vorticityMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uVelocity: { value: null },
        uDx: { value: 1.0 / size },
      },
      vertexShader,
      fragmentShader: vorticityShader,
    });
    
    this.vorticityForceMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uVelocity: { value: null },
        uCurl: { value: null },
        uCurlScale: { value: 0.03 },
        uDx: { value: 1.0 / size },
      },
      vertexShader,
      fragmentShader: vorticityForceShader,
    });
    
    this.splatMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTarget: { value: null },
        uObstacle: { value: null },
        uPoint: { value: new THREE.Vector2(0.95, 0.5) },
        uColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        uRadius: { value: 0.01 },
      },
      vertexShader,
      fragmentShader: splatShader,
    });
    
    this.obstacleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uObstaclePos: { value: new THREE.Vector2(0.5, 0.5) },
        uObstacleSize: { value: 0.25 },
      },
      vertexShader,
      fragmentShader: obstacleShader,
    });
    
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
    
    this.displayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uDensity: { value: null },
        uObstacle: { value: null },
        uOpacity: { value: 0.8 },
        uTime: { value: 0 },
      },
      vertexShader,
      fragmentShader: displayFragmentShader,
      transparent: true,
    });
    
    this.mesh = new THREE.Mesh(this.geometry, this.obstacleMaterial);
    this.scene.add(this.mesh);
    
    this.initObstacle();
    this.initFields();
  }

  initObstacle() {
    this.obstacleMaterial.uniforms.uObstaclePos.value.set(0.5, 0.5);
    this.obstacleMaterial.uniforms.uObstacleSize.value = 0.25;
    this.renderer.setRenderTarget(this.obstacle);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
  }

  initFields() {
    const clearMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const clearMesh = new THREE.Mesh(this.geometry, clearMaterial);
    const clearScene = new THREE.Scene();
    clearScene.add(clearMesh);
    
    this.renderer.setRenderTarget(this.velocity);
    this.renderer.render(clearScene, this.camera);
    this.renderer.setRenderTarget(this.velocityOld);
    this.renderer.render(clearScene, this.camera);
    this.renderer.setRenderTarget(this.density);
    this.renderer.render(clearScene, this.camera);
    this.renderer.setRenderTarget(this.densityOld);
    this.renderer.render(clearScene, this.camera);
    this.renderer.setRenderTarget(this.pressure);
    this.renderer.render(clearScene, this.camera);
    this.renderer.setRenderTarget(this.pressureOld);
    this.renderer.render(clearScene, this.camera);
    this.renderer.setRenderTarget(this.divergence);
    this.renderer.render(clearScene, this.camera);
    this.renderer.setRenderTarget(this.curl);
    this.renderer.render(clearScene, this.camera);
    this.renderer.setRenderTarget(null);
  }

  step(dt: number, config: SmokeConfig) {
    this.frame++;
    
    this.updateObstacle(config);
    
    this.splatMaterial.uniforms.uTarget.value = this.velocity.texture;
    this.splatMaterial.uniforms.uObstacle.value = this.obstacle.texture;
    this.splatMaterial.uniforms.uPoint.value.set(
      0.95,
      0.5 + Math.sin(this.frame * 0.02) * 0.15
    );
    this.splatMaterial.uniforms.uColor.value.set(
      -config.speed * 0.5,
      0,
      0
    );
    this.splatMaterial.uniforms.uRadius.value = 0.015 * config.emissionRate;
    this.mesh.material = this.splatMaterial;
    this.renderer.setRenderTarget(this.velocityOld);
    this.renderer.render(this.scene, this.camera);
    this.swapVelocity();
    
    this.advectionMaterial.uniforms.uVelocity.value = this.velocity.texture;
    this.advectionMaterial.uniforms.uSource.value = this.velocity.texture;
    this.advectionMaterial.uniforms.uObstacle.value = this.obstacle.texture;
    this.advectionMaterial.uniforms.uDissipation.value = config.dissipation;
    this.advectionMaterial.uniforms.uDt.value = dt;
    this.mesh.material = this.advectionMaterial;
    this.renderer.setRenderTarget(this.velocityOld);
    this.renderer.render(this.scene, this.camera);
    this.swapVelocity();
    
    if (config.curl > 0) {
      this.vorticityMaterial.uniforms.uVelocity.value = this.velocity.texture;
      this.mesh.material = this.vorticityMaterial;
      this.renderer.setRenderTarget(this.curl);
      this.renderer.render(this.scene, this.camera);
      
      this.vorticityForceMaterial.uniforms.uVelocity.value = this.velocity.texture;
      this.vorticityForceMaterial.uniforms.uCurl.value = this.curl.texture;
      this.vorticityForceMaterial.uniforms.uCurlScale.value = config.curl;
      this.mesh.material = this.vorticityForceMaterial;
      this.renderer.setRenderTarget(this.velocityOld);
      this.renderer.render(this.scene, this.camera);
      this.swapVelocity();
    }
    
    this.divergenceMaterial.uniforms.uVelocity.value = this.velocity.texture;
    this.divergenceMaterial.uniforms.uObstacle.value = this.obstacle.texture;
    this.mesh.material = this.divergenceMaterial;
    this.renderer.setRenderTarget(this.divergence);
    this.renderer.render(this.scene, this.camera);
    
    this.pressureMaterial.uniforms.uDivergence.value = this.divergence.texture;
    this.pressureMaterial.uniforms.uObstacle.value = this.obstacle.texture;
    
    for (let i = 0; i < 20; i++) {
      this.pressureMaterial.uniforms.uPressure.value = this.pressure.texture;
      this.mesh.material = this.pressureMaterial;
      this.renderer.setRenderTarget(this.pressureOld);
      this.renderer.render(this.scene, this.camera);
      this.swapPressure();
    }
    
    this.gradientSubtractMaterial.uniforms.uPressure.value = this.pressure.texture;
    this.gradientSubtractMaterial.uniforms.uVelocity.value = this.velocity.texture;
    this.gradientSubtractMaterial.uniforms.uObstacle.value = this.obstacle.texture;
    this.mesh.material = this.gradientSubtractMaterial;
    this.renderer.setRenderTarget(this.velocityOld);
    this.renderer.render(this.scene, this.camera);
    this.swapVelocity();
    
    this.splatMaterial.uniforms.uTarget.value = this.density.texture;
    this.splatMaterial.uniforms.uColor.value.set(
      config.emissionRate * 2.0,
      config.emissionRate * 2.0,
      config.emissionRate * 2.0
    );
    this.mesh.material = this.splatMaterial;
    this.renderer.setRenderTarget(this.densityOld);
    this.renderer.render(this.scene, this.camera);
    this.swapDensity();
    
    this.advectionMaterial.uniforms.uVelocity.value = this.velocity.texture;
    this.advectionMaterial.uniforms.uSource.value = this.density.texture;
    this.advectionMaterial.uniforms.uDissipation.value = config.dissipation;
    this.mesh.material = this.advectionMaterial;
    this.renderer.setRenderTarget(this.densityOld);
    this.renderer.render(this.scene, this.camera);
    this.swapDensity();
    
    this.renderer.setRenderTarget(null);
  }

  updateObstacle(config: SmokeConfig) {
    this.obstacleMaterial.uniforms.uObstaclePos.value.set(...config.obstaclePosition);
    this.obstacleMaterial.uniforms.uObstacleSize.value = config.obstacleSize;
    this.renderer.setRenderTarget(this.obstacle);
    this.mesh.material = this.obstacleMaterial;
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
  }

  private swapVelocity() {
    const temp = this.velocity;
    this.velocity = this.velocityOld;
    this.velocityOld = temp;
  }
  
  private swapDensity() {
    const temp = this.density;
    this.density = this.densityOld;
    this.densityOld = temp;
  }
  
  private swapPressure() {
    const temp = this.pressure;
    this.pressure = this.pressureOld;
    this.pressureOld = temp;
  }

  dispose() {
    this.velocity.dispose();
    this.velocityOld.dispose();
    this.density.dispose();
    this.densityOld.dispose();
    this.pressure.dispose();
    this.pressureOld.dispose();
    this.divergence.dispose();
    this.curl.dispose();
    this.obstacle.dispose();
    
    this.geometry.dispose();
    this.advectionMaterial.dispose();
    this.divergenceMaterial.dispose();
    this.pressureMaterial.dispose();
    this.gradientSubtractMaterial.dispose();
    this.vorticityMaterial.dispose();
    this.vorticityForceMaterial.dispose();
    this.splatMaterial.dispose();
    this.obstacleMaterial.dispose();
    this.displayMaterial.dispose();
  }

  getDensityTexture() {
    return this.density.texture;
  }

  getObstacleTexture() {
    return this.obstacle.texture;
  }

  getDisplayMaterial() {
    return this.displayMaterial;
  }
}
