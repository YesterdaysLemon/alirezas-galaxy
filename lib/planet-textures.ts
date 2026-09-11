import * as THREE from 'three';
import type { PlanetRecipe } from '../data/solar-systems';

export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Continuous 3D noise sampled on a sphere: no longitude seam, no polar pinching.
export function terrainNoise(x: number, y: number, z: number, seed: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const fx = smooth(x - ix),
    fy = smooth(y - iy),
    fz = smooth(z - iz);
  const hash = (a: number, b: number, c: number) => {
    let h =
      Math.imul(a, 374761393) ^
      Math.imul(b, 668265263) ^
      Math.imul(c, 1274126177) ^
      seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return mix(
    mix(
      mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx),
      mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx),
      fy,
    ),
    mix(
      mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx),
      mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx),
      fy,
    ),
    fz,
  );
}

export function surfaceHeight(
  x: number,
  y: number,
  z: number,
  planet: PlanetRecipe,
) {
  const n = (scale: number, salt = 0) =>
    terrainNoise(
      x * scale + 7,
      y * scale + 11,
      z * scale + 3,
      planet.seed + salt,
    );
  const land =
    n(2.7) * 0.58 + n(6.5, 11) * 0.27 + n(17, 51) * 0.1 + n(42, 93) * 0.05;
  if (planet.terrain === 'folds')
    return (
      0.3 +
      Math.abs(Math.sin((x * 2 + y * 0.8 + n(4) * 2.6) * 10)) * 0.33 +
      land * 0.25
    );
  if (planet.terrain === 'gas')
    return (
      0.5 +
      Math.sin(y * 35 + n(7) * 3.5) * 0.19 +
      Math.sin(y * 91 + n(12) * 5) * 0.07
    );
  if (planet.terrain === 'culture')
    return land * 0.64 + Math.pow(Math.max(0, Math.sin(n(4) * 36)), 5) * 0.29;
  if (planet.terrain === 'desert')
    return land * 0.85 + Math.sin(y * 26 + n(5) * 8) * 0.08;
  return land;
}

export function createPlanetTextures(planet: PlanetRecipe, width = 512) {
  const height = width / 2;
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  const clouds = document.createElement('canvas');
  [color, bump, clouds].forEach((canvas) => {
    canvas.width = width;
    canvas.height = height;
  });
  const colorCtx = color.getContext('2d')!,
    bumpCtx = bump.getContext('2d')!,
    cloudCtx = clouds.getContext('2d')!;
  const colorData = colorCtx.createImageData(width, height),
    bumpData = bumpCtx.createImageData(width, height),
    cloudData = cloudCtx.createImageData(width, height);
  const palette = planet.colors.map((hex) => new THREE.Color(hex));
  const shade = new THREE.Color();
  for (let v = 0; v < height; v++) {
    const lat = (v / (height - 1)) * Math.PI;
    for (let u = 0; u < width; u++) {
      const lon = (u / (width - 1)) * Math.PI * 2;
      const x = Math.sin(lat) * Math.cos(lon),
        y = Math.cos(lat),
        z = Math.sin(lat) * Math.sin(lon);
      const h = surfaceHeight(x, y, z, planet);
      let value = THREE.MathUtils.clamp((h - 0.24) * 2.05, 0, 0.999);
      if (planet.terrain === 'ocean')
        value = h < 0.53 ? (h - 0.27) * 1.5 : 0.72 + (h - 0.53) * 2;
      if (planet.terrain === 'garden')
        value = h < 0.39 ? 0.08 : 0.36 + (h - 0.39) * 1.9;
      value = THREE.MathUtils.clamp(value, 0, 0.999) * 3;
      shade
        .copy(palette[Math.floor(value)])
        .lerp(palette[Math.min(3, Math.floor(value) + 1)], value % 1);
      if (
        planet.terrain !== 'gas' &&
        Math.abs(y) >
          0.94 + terrainNoise(x * 7, y * 7, z * 7, planet.seed) * 0.035
      )
        shade.lerp(palette[3], 0.7);
      shade.convertLinearToSRGB();
      const index = (v * width + u) * 4;
      colorData.data.set(
        [shade.r * 255, shade.g * 255, shade.b * 255, 255],
        index,
      );
      const relief = planet.terrain === 'ocean' && h < 0.53 ? 0.45 : h;
      bumpData.data.set([relief * 255, relief * 255, relief * 255, 255], index);
      const vapor =
        terrainNoise(x * 5 + 2, y * 6, z * 5, planet.seed + 700) * 0.7 +
        terrainNoise(x * 14, y * 14, z * 14, planet.seed + 701) * 0.3;
      cloudData.data.set(
        [235, 247, 255, THREE.MathUtils.clamp((vapor - 0.57) * 550, 0, 145)],
        index,
      );
    }
  }
  colorCtx.putImageData(colorData, 0, 0);
  bumpCtx.putImageData(bumpData, 0, 0);
  cloudCtx.putImageData(cloudData, 0, 0);
  const map = new THREE.CanvasTexture(color),
    bumpMap = new THREE.CanvasTexture(bump),
    cloudMap = new THREE.CanvasTexture(clouds);
  map.colorSpace = THREE.SRGBColorSpace;
  cloudMap.colorSpace = THREE.SRGBColorSpace;
  [map, bumpMap, cloudMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  });
  return { map, bumpMap, cloudMap };
}
