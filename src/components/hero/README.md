# Smoke Hero WebGL Component

## Installation

Install required dependencies:

```bash
npm install three @react-three/fiber @types/three
```

## Usage

The `SmokeHero` component is already integrated into `src/app/page.tsx`. It renders a full-bleed WebGL canvas with fluid simulation.

## Configuration

Edit the config object in `src/app/page.tsx` to adjust:

- `emissionRate`: Smoke emission intensity (0-1)
- `dissipation`: How quickly smoke fades (0-1)
- `curl`: Vorticity strength for swirling motion
- `noiseScale`: Noise detail level
- `obstacleSize`: Size of the "D" letter obstacle
- `obstaclePosition`: [x, y] position of obstacle (0-1)
- `opacity`: Overall smoke opacity
- `speed`: Flow speed multiplier

## Architecture

- `SmokeHero.tsx`: Main wrapper component with reduced motion support
- `SmokeCanvas.tsx`: React Three Fiber canvas setup
- `sim/Simulation.ts`: Core fluid simulation with ping-pong FBOs
- `materials/SmokeMaterial.tsx`: Display material for smoke rendering
- `materials/ObstacleMaterial.tsx`: Material for "D" letter obstacle

## Technical Details

- 2D Navier-Stokes fluid simulation
- GPU-based ping-pong render targets
- SDF-based obstacle collision
- Advection, divergence, pressure solving, vorticity confinement
- Film grain and dithering for visual quality

