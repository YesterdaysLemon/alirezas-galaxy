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

function hash(x: number, y: number, z: number, seed: number) {
  let h =
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(z, 1274126177) ^
    seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function smooth(a: number, b: number, n: number) {
  const t = THREE.MathUtils.clamp((n - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Continuous sphere-space noise: geometry, coastlines and bump share coordinates. */
export function terrainNoise(x: number, y: number, z: number, seed: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fx = smooth(0, 1, x - ix),
    fy = smooth(0, 1, y - iy),
    fz = smooth(0, 1, z - iz);
  return mix(
    mix(
      mix(hash(ix, iy, iz, seed), hash(ix + 1, iy, iz, seed), fx),
      mix(hash(ix, iy + 1, iz, seed), hash(ix + 1, iy + 1, iz, seed), fx),
      fy,
    ),
    mix(
      mix(hash(ix, iy, iz + 1, seed), hash(ix + 1, iy, iz + 1, seed), fx),
      mix(
        hash(ix, iy + 1, iz + 1, seed),
        hash(ix + 1, iy + 1, iz + 1, seed),
        fx,
      ),
      fy,
    ),
    fz,
  );
}
function noise(x: number, y: number, z: number, scale: number, seed: number) {
  return terrainNoise(x * scale + 7, y * scale + 11, z * scale + 3, seed);
}

export function surfaceHeight(
  x: number,
  y: number,
  z: number,
  planet: PlanetRecipe,
) {
  const seed = planet.seed;
  const broad = planet.terrain === 'gas' ? 0 : noise(x, y, z, 2.8, seed);
  const detail = noise(x, y, z, 14, seed + 51);
  const warp = planet.terrain === 'ocean' ? 0 : noise(x, y, z, 5.2, seed + 11);
  if (planet.terrain === 'gas') {
    // Warped zonal jets and a spherical storm, not straight latitude stripes.
    const storm = Math.exp(
      -((x - 0.65) ** 2 + (y + 0.25) ** 2 + (z - 0.68) ** 2) * 24,
    );
    const latitude = y * 32 + (warp - 0.5) * 5 + storm * 4;
    return (
      0.5 +
      Math.sin(latitude) * 0.18 +
      Math.sin(latitude * 3.7 + detail) * 0.065 +
      (detail - 0.5) * 0.12
    );
  }
  if (planet.terrain === 'folds') {
    const ridge =
      1 - Math.abs(Math.sin((x * 1.4 + z * 0.7 + warp * 1.9 + broad) * 16));
    return 0.24 + Math.pow(ridge, 1.6) * 0.48 + broad * 0.2 + detail * 0.08;
  }
  if (planet.terrain === 'ocean') {
    return (
      broad * 0.26 +
      noise(x, y, z, 6.8, seed + 24) * 0.43 +
      detail * 0.23 +
      noise(x, y, z, 37, seed + 93) * 0.08
    );
  }
  if (planet.terrain === 'culture') {
    const colonies = Math.abs(Math.sin(warp * 30 + broad * 8));
    return broad * 0.28 + Math.pow(colonies, 7) * 0.38 + detail * 0.18 + 0.1;
  }
  if (planet.terrain === 'desert') {
    const dunes = Math.pow(
      0.5 + Math.sin(y * 52 + warp * 15 + x * 12) * 0.5,
      2,
    );
    return broad * 0.54 + dunes * 0.2 + detail * 0.11 + 0.1;
  }
  const valleys = Math.pow(1 - Math.abs(warp * 2 - 1), 16);
  return (
    broad * 0.56 +
    detail * 0.2 +
    noise(x, y, z, 7, seed + 24) * 0.24 -
    valleys * 0.13
  );
}

/** Water is a level surface; raised geometry and painted shore use the same datum. */
export function surfaceElevation(height: number, planet: PlanetRecipe) {
  if (planet.terrain === 'gas') return 0;
  if (planet.terrain === 'ocean') return Math.max(0, height - 0.565) * 0.15;
  if (planet.terrain === 'garden') return Math.max(0, height - 0.4) * 0.1;
  return (height - 0.42) * (planet.terrain === 'folds' ? 0.14 : 0.09);
}

/** Transferable CPU output; the worker and cooperative fallback run the same generator. */
export type PlanetBuffers = {
  width: number;
  maps: Uint8ClampedArray[];
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  index: Uint16Array | Uint32Array;
};

export function* generatePlanetBuffers(
  planet: PlanetRecipe,
  width = 768,
): Generator<void, PlanetBuffers> {
  const height = width / 2;
  const maps = Array.from(
    { length: 5 },
    () => new Uint8ClampedArray(width * height * 4),
  );
  const [colorData, bumpData, cloudData, roughData, emissionData] = maps.map(
    (data) => ({ data }),
  );
  const palette = planet.colors.map((hex) => new THREE.Color(hex));
  const vegetation = new THREE.Color('#438c67');
  const shade = new THREE.Color();
  const hasClouds =
    planet.terrain !== 'gas' &&
    planet.terrain !== 'folds' &&
    planet.terrain !== 'culture';
  for (let v = 0; v < height; v++) {
    const lat = (v / (height - 1)) * Math.PI;
    for (let u = 0; u < width; u++) {
      const lon = (u / (width - 1)) * Math.PI * 2;
      // SphereGeometry uses -cos(phi) for X. CanvasTexture flips V on upload.
      const x = -Math.sin(lat) * Math.cos(lon),
        y = Math.cos(lat),
        z = Math.sin(lat) * Math.sin(lon);
      const h = surfaceHeight(x, y, z, planet);
      const grain = noise(x, y, z, 95, planet.seed + 192);
      let roughness = 0.88;
      if (planet.terrain === 'ocean') {
        if (h < 0.53)
          shade.copy(palette[0]).lerp(palette[1], smooth(0.28, 0.53, h));
        else if (h < 0.565)
          shade.copy(palette[1]).lerp(palette[2], smooth(0.53, 0.565, h));
        else if (h < 0.579)
          shade.copy(palette[2]).lerp(palette[3], smooth(0.565, 0.577, h));
        else
          shade
            .copy(palette[3])
            .lerp(vegetation, smooth(0.579, 0.613, h))
            .multiplyScalar(1 - smooth(0.66, 0.82, h) * 0.3);
        roughness = h < 0.565 ? 0.24 : 0.9;
      } else {
        let value = THREE.MathUtils.clamp((h - 0.23) * 2.2, 0, 0.999);
        if (planet.terrain === 'garden')
          value =
            h < 0.4
              ? smooth(0.2, 0.4, h) * 0.14
              : 0.34 + smooth(0.4, 0.77, h) * 0.64;
        if (planet.terrain === 'gas')
          value = THREE.MathUtils.clamp((h - 0.23) * 1.85, 0, 0.999);
        value *= 3;
        shade
          .copy(palette[Math.floor(value)])
          .lerp(palette[Math.min(3, Math.floor(value) + 1)], value % 1);
        if (planet.terrain === 'garden' && h < 0.4) roughness = 0.32;
      }
      shade.multiplyScalar(0.92 + grain * 0.14);
      if (
        (planet.terrain === 'garden' || planet.terrain === 'ocean') &&
        Math.abs(y) > 0.965 + noise(x, y, z, 8, planet.seed) * 0.018
      )
        shade.lerp(palette[3], 0.55);
      shade.convertLinearToSRGB();
      const index = (v * width + u) * 4;
      colorData.data[index] = shade.r * 255;
      colorData.data[index + 1] = shade.g * 255;
      colorData.data[index + 2] = shade.b * 255;
      colorData.data[index + 3] = 255;
      const water =
        (planet.terrain === 'ocean' && h < 0.565) ||
        (planet.terrain === 'garden' && h < 0.4);
      const relief = water ? 0.4 : h * 0.9 + grain * 0.1;
      const vapor = hasClouds
        ? noise(
            x + noise(x, y, z, 3, planet.seed + 702) * 0.14,
            y,
            z,
            9,
            planet.seed + 700,
          ) *
            0.7 +
          noise(x, y, z, 23, planet.seed + 701) * 0.3
        : 0;
      const cloud =
        planet.terrain === 'gas' ||
        planet.terrain === 'folds' ||
        planet.terrain === 'culture'
          ? 0
          : smooth(0.64, 0.83, vapor) *
            (planet.terrain === 'desert' ? 45 : 135);
      const emission =
        planet.terrain === 'culture' ? smooth(0.66, 0.79, h) * 90 : 0;
      for (let channel = 0; channel < 3; channel++) {
        bumpData.data[index + channel] = relief * 255;
        cloudData.data[index + channel] = 240;
        roughData.data[index + channel] = roughness * 255;
        emissionData.data[index + channel] =
          (colorData.data[index + channel] * emission) / 255;
      }
      bumpData.data[index + 3] =
        roughData.data[index + 3] =
        emissionData.data[index + 3] =
          255;
      cloudData.data[index + 3] = cloud;
      if (u % 128 === 127) yield;
    }
    yield;
  }

  const geometry = new THREE.SphereGeometry(planet.radius, 128, 80);
  const positions = geometry.getAttribute('position');
  const p = new THREE.Vector3();
  if (planet.terrain !== 'gas') {
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i).normalize();
      const h = surfaceHeight(p.x, p.y, p.z, planet);
      p.multiplyScalar(planet.radius * (1 + surfaceElevation(h, planet)));
      positions.setXYZ(i, p.x, p.y, p.z);
      if (i % 129 === 128) yield;
    }
    geometry.computeVertexNormals();
    const normals = geometry.getAttribute('normal');
    for (let row = 0; row <= 80; row++) {
      const first = row * 129,
        last = first + 128;
      p.set(
        normals.getX(first) + normals.getX(last),
        normals.getY(first) + normals.getY(last),
        normals.getZ(first) + normals.getZ(last),
      ).normalize();
      normals.setXYZ(first, p.x, p.y, p.z);
      normals.setXYZ(last, p.x, p.y, p.z);
    }
  }
  const result: PlanetBuffers = {
    width,
    maps,
    position: positions.array as Float32Array,
    normal: geometry.getAttribute('normal').array as Float32Array,
    uv: geometry.getAttribute('uv').array as Float32Array,
    index: geometry.index!.array as Uint16Array | Uint32Array,
  };
  geometry.dispose();
  return result;
}

export function adoptPlanetBuffers(buffers: PlanetBuffers) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(buffers.position, 3),
  );
  geometry.setAttribute('normal', new THREE.BufferAttribute(buffers.normal, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(buffers.uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(buffers.index, 1));
  const [map, bumpMap, cloudMap, roughnessMap, emissiveMap] = buffers.maps.map(
    (data) => {
      const texture = new THREE.DataTexture(
        new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
        buffers.width,
        buffers.width / 2,
      );
      // Match CanvasTexture's vertical orientation and filtered, mipmapped seams.
      texture.flipY = true;
      texture.wrapS = THREE.RepeatWrapping;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      return texture;
    },
  );
  map.colorSpace =
    cloudMap.colorSpace =
    emissiveMap.colorSpace =
      THREE.SRGBColorSpace;
  return {
    geometry,
    textures: { map, bumpMap, cloudMap, roughnessMap, emissiveMap },
  };
}
