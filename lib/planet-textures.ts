import * as THREE from 'three';
import type { PlanetRecipe, SurfaceTuning } from '../data/solar-systems';

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
function clamp01(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
function smooth(a: number, b: number, n: number) {
  const t = clamp01((n - a) / (b - a));
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

/** Fractal value noise, normalized to roughly 0..1 with its mean near 0.5. */
function fbm(
  x: number,
  y: number,
  z: number,
  octaves: number,
  scale: number,
  seed: number,
) {
  let sum = 0,
    amplitude = 0.5,
    total = 0,
    frequency = scale;
  for (let i = 0; i < octaves; i++) {
    sum +=
      terrainNoise(
        x * frequency + 7.1 * (i + 1),
        y * frequency + 3.3 * (i + 1),
        z * frequency + 5.7 * (i + 1),
        seed + i * 101,
      ) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / total;
}

/** Sharp crests where the noise crosses its midline: ridges, seams, cracks. */
function ridged(
  x: number,
  y: number,
  z: number,
  octaves: number,
  scale: number,
  seed: number,
) {
  let sum = 0,
    amplitude = 0.5,
    total = 0,
    frequency = scale;
  for (let i = 0; i < octaves; i++) {
    const n = terrainNoise(
      x * frequency + 1.7 * (i + 1),
      y * frequency + 9.2 * (i + 1),
      z * frequency + 4.4 * (i + 1),
      seed + i * 131,
    );
    const crest = 1 - Math.abs(n * 2 - 1);
    sum += crest * crest * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }
  return sum / total;
}

/** Distance to the nearest scattered cell center, and that cell's own random value. */
function cells(x: number, y: number, z: number, scale: number, seed: number) {
  const px = x * scale,
    py = y * scale,
    pz = z * scale;
  const ix = Math.floor(px),
    iy = Math.floor(py),
    iz = Math.floor(pz);
  let best = 9,
    id = 0;
  for (let dz = -1; dz <= 1; dz++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx,
          cy = iy + dy,
          cz = iz + dz;
        const ox = cx + hash(cx, cy, cz, seed) - px,
          oy = cy + hash(cx, cy, cz, seed + 1) - py,
          oz = cz + hash(cx, cy, cz, seed + 2) - pz;
        const d = ox * ox + oy * oy + oz * oz;
        if (d < best) {
          best = d;
          id = hash(cx, cy, cz, seed + 3);
        }
      }
  return { distance: Math.sqrt(best), id };
}

type RGB = [number, number, number];
function toLinear(hex: string): RGB {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >>> 16) & 255, (n >>> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as RGB;
}
export function linearToSrgb(c: number) {
  const v = clamp01(c);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}
function set(out: RGB, c: RGB) {
  out[0] = c[0];
  out[1] = c[1];
  out[2] = c[2];
}
function blend(out: RGB, c: RGB, t: number) {
  out[0] += (c[0] - out[0]) * t;
  out[1] += (c[1] - out[1]) * t;
  out[2] += (c[2] - out[2]) * t;
}
function scale(out: RGB, k: number) {
  out[0] *= k;
  out[1] *= k;
  out[2] *= k;
}

export type { SurfaceTuning };

type Context = {
  planet: PlanetRecipe;
  seed: number;
  pal: RGB[];
  sea: number;
  continents: number;
  ice: number;
  clouds: number;
  relief: number;
  detail: number;
  atmosphere: RGB;
  /** The landmass value below which `sea` of the surface lies. */
  seaLevel: number;
};

const defaults: Record<PlanetRecipe['terrain'], Required<SurfaceTuning>> = {
  ocean: {
    sea: 0.68,
    continents: 1.5,
    ice: 0.16,
    clouds: 0.55,
    relief: 1,
    detail: 0.5,
  },
  garden: {
    sea: 0.3,
    continents: 1.35,
    ice: 0.2,
    clouds: 0.5,
    relief: 1,
    detail: 0.5,
  },
  desert: {
    sea: 0.12,
    continents: 1.4,
    ice: 0.08,
    clouds: 0.12,
    relief: 1,
    detail: 0.6,
  },
  folds: {
    sea: 0.26,
    continents: 1.6,
    ice: 1,
    clouds: 0.22,
    relief: 1,
    detail: 0.6,
  },
  culture: {
    sea: 0.38,
    continents: 1.3,
    ice: 0.1,
    clouds: 0.3,
    relief: 1,
    detail: 0.55,
  },
  gas: {
    sea: 0,
    continents: 1,
    ice: 0,
    clouds: 0,
    relief: 0,
    detail: 0.5,
  },
};

export function surfaceTuning(planet: PlanetRecipe): Required<SurfaceTuning> {
  return { ...defaults[planet.terrain], ...planet.surface };
}

const levels = new Map<string, number>();

export function surfaceContext(planet: PlanetRecipe): Context {
  const tuning = surfaceTuning(planet);
  const ctx: Context = {
    planet,
    seed: planet.seed,
    pal: planet.colors.map(toLinear),
    atmosphere: toLinear(planet.atmosphere),
    ...tuning,
    seaLevel: 0.5,
  };
  if (planet.terrain !== 'gas') {
    // Measure this world's own landmass distribution, so `sea` is the
    // actual fraction of surface below sea level rather than a raw threshold.
    const key = `${planet.seed}/${tuning.continents}/${tuning.sea}`;
    let level = levels.get(key);
    if (level === undefined) {
      const samples: number[] = [];
      const count = 900;
      for (let i = 0; i < count; i++) {
        const y = 1 - ((i + 0.5) / count) * 2;
        const r = Math.sqrt(1 - y * y);
        const a = i * 2.399963229728653;
        samples.push(landmass(Math.cos(a) * r, y, Math.sin(a) * r, ctx));
      }
      samples.sort((a, b) => a - b);
      level =
        samples[Math.min(count - 1, Math.floor(clamp01(tuning.sea) * count))];
      if (levels.size > 256) levels.clear();
      levels.set(key, level);
    }
    ctx.seaLevel = level;
  }
  return ctx;
}

export type SurfaceSample = {
  color: RGB;
  /** 0..1 relief for the bump map; seas are level. */
  relief: number;
  /** Radial displacement as a fraction of radius. */
  lift: number;
  roughness: number;
  emission: number;
  cloud: number;
  water: boolean;
};

export function createSample(): SurfaceSample {
  return {
    color: [0, 0, 0],
    relief: 0.4,
    lift: 0,
    roughness: 0.9,
    emission: 0,
    cloud: 0,
    water: false,
  };
}

const GREEN: RGB = toLinear('#3d7a3a');
const FOREST: RGB = toLinear('#23502f');
const ROCK: RGB = toLinear('#6d6154');
const SNOW: RGB = toLinear('#f4f6f8');
const SAND: RGB = toLinear('#d9c48f');
const LAGOON: RGB = toLinear('#3fa3ad');

/** Garden palettes describe land; their seas are derived from the first stop. */
const gardenSeas = new WeakMap<Context, RGB[]>();
function gardenWater(ctx: Context): RGB[] {
  let seas = gardenSeas.get(ctx);
  if (!seas) {
    const base = ctx.pal[0];
    const deep: RGB = [base[0] * 0.5, base[1] * 0.55, base[2] * 0.7];
    const shallow: RGB = [...base];
    blend(shallow, LAGOON, 0.55);
    seas = [deep, base, shallow, ctx.pal[3]];
    gardenSeas.set(ctx, seas);
  }
  return seas;
}

/** Shared broad landmass field: domain-warped fbm stretched for contrast. */
function landmass(x: number, y: number, z: number, ctx: Context) {
  const s = ctx.continents;
  const wx = fbm(x, y, z, 2, 1.1 * s, ctx.seed + 5) - 0.5,
    wy = fbm(x, y, z, 2, 1.1 * s, ctx.seed + 6) - 0.5,
    wz = fbm(x, y, z, 2, 1.1 * s, ctx.seed + 7) - 0.5;
  const c = fbm(x + wx * 0.9, y + wy * 0.9, z + wz * 0.9, 5, s, ctx.seed);
  return clamp01((c - 0.5) * 1.9 + 0.5);
}

function terrestrial(
  x: number,
  y: number,
  z: number,
  ctx: Context,
  out: SurfaceSample,
) {
  const garden = ctx.planet.terrain === 'garden';
  const [deep, mid, shallow] = garden ? gardenWater(ctx) : ctx.pal;
  const [, vegetation, dry, light] = ctx.pal;
  const land = landmass(x, y, z, ctx);
  const detail = fbm(x, y, z, 3, 9, ctx.seed + 31);
  const h = land + (detail - 0.5) * 0.08;
  const sea = ctx.seaLevel;
  const latitude = Math.abs(y);
  const c = out.color;
  if (h < sea) {
    const depth = (sea - h) / Math.max(0.05, sea);
    set(c, shallow);
    blend(c, mid, smooth(0.0, 0.18, depth));
    blend(c, deep, smooth(0.14, 0.6, depth));
    out.water = true;
    out.roughness = 0.22;
    out.relief = 0.4;
    out.lift = 0;
  } else {
    const e = clamp01((h - sea) / Math.max(0.05, 1 - sea));
    const moisture = fbm(x, y, z, 2, 2.6, ctx.seed + 77);
    const dryBelt = Math.exp(-(((latitude - 0.32) / 0.13) ** 2));
    const dryness = clamp01((1 - moisture) * 0.9 + dryBelt * 0.55 - 0.25);
    // Lowland vegetation: the world's own green for gardens, a natural green
    // tinted toward the palette's light stop for ocean worlds.
    set(c, garden ? vegetation : GREEN);
    if (!garden) blend(c, light, 0.12);
    blend(c, FOREST, smooth(0.45, 0.8, moisture) * 0.55);
    blend(c, garden ? dry : SAND, smooth(0.35, 0.75, dryness));
    if (!garden) blend(c, SAND, smooth(0, 0.025, 0.025 - e) * 0.45);
    // Ranges follow ridge lines inland rather than capping whole plateaus.
    const range = ridged(x, y, z, 3, 3.4, ctx.seed + 50) * smooth(0.25, 0.7, e);
    blend(c, ROCK, smooth(0.48, 0.7, range) * 0.75);
    blend(c, SNOW, smooth(0.7, 0.84, range) * 0.85);
    scale(c, 0.9 + detail * 0.2);
    out.water = false;
    out.roughness = 0.92;
    out.relief = clamp01(0.45 + e * 0.3 + range * 0.35);
    out.lift = (e * 0.016 + range * 0.018) * ctx.relief;
  }
  // Polar caps reach down to a ragged latitude that grows with `ice`.
  const cap =
    1 -
    ctx.ice * 0.34 +
    (fbm(x, y, z, 2, 5, ctx.seed + 90) - 0.5) * 0.08 -
    (out.water ? 0 : 0.03);
  const polar = smooth(cap, cap + 0.025, latitude);
  if (polar > 0) {
    blend(c, SNOW, polar * 0.92);
    out.roughness = mix(out.roughness, 0.55, polar);
    out.relief = mix(out.relief, 0.5, polar);
  }
  const swirl = fbm(x, y, z, 2, 2.2, ctx.seed + 702) - 0.5;
  const vapor = fbm(
    x + swirl * 0.5,
    y * 1.8,
    z + swirl * 0.5,
    4,
    3.2,
    ctx.seed + 700,
  );
  out.cloud = smooth(0.68 - ctx.clouds * 0.2, 0.84 - ctx.clouds * 0.14, vapor);
  out.emission = 0;
}

function desert(
  x: number,
  y: number,
  z: number,
  ctx: Context,
  out: SurfaceSample,
) {
  const [rust, orange, sand, pale] = ctx.pal;
  const basin = landmass(x, y, z, ctx);
  const warp = fbm(x, y, z, 3, 3, ctx.seed + 12);
  // Dune seas: long crests whose heading drifts across the world.
  const heading = warp * 6;
  const dunes =
    0.5 +
    0.5 *
      Math.sin(
        (x * Math.cos(heading) + z * Math.sin(heading) + y * 0.6) *
          (40 + ctx.detail * 50) +
          warp * 10,
      );
  const seams = ridged(x, y, z, 4, 2.4, ctx.seed + 40);
  const canyon = smooth(0.8 - ctx.detail * 0.08, 0.93, seams);
  const c = out.color;
  set(c, orange);
  blend(c, sand, smooth(0.35, 0.7, basin));
  blend(c, pale, smooth(0.72, 0.95, basin) * 0.8);
  const lowland = smooth(ctx.seaLevel + 0.08, ctx.seaLevel - 0.04, basin);
  blend(c, rust, lowland * 0.75);
  const duneField = smooth(0.4, 0.62, basin) * (1 - lowland);
  scale(c, 1 + (dunes - 0.5) * 0.14 * duneField);
  blend(c, rust, canyon * 0.85);
  const latitude = Math.abs(y);
  const frost = smooth(1 - ctx.ice * 0.4, 1.02 - ctx.ice * 0.38, latitude);
  blend(c, pale, frost * 0.8);
  out.water = false;
  out.roughness = 0.96;
  out.relief = clamp01(
    0.3 + basin * 0.5 + dunes * duneField * 0.12 - canyon * 0.3,
  );
  out.lift = ((basin - 0.45) * 0.03 - canyon * 0.012) * ctx.relief;
  out.cloud =
    smooth(0.72, 0.9, fbm(x, y * 2.4, z, 4, 3, ctx.seed + 700)) *
    ctx.clouds *
    1.6;
  out.emission = 0;
}

function iceWorld(
  x: number,
  y: number,
  z: number,
  ctx: Context,
  out: SurfaceSample,
) {
  const [slate, blue, grey, ivory] = ctx.pal;
  const sheet = landmass(x, y, z, ctx);
  const ridges = ridged(
    x,
    y,
    z,
    4,
    3.2 * (0.7 + ctx.detail * 0.6),
    ctx.seed + 44,
  );
  const cracks = ridged(x, y, z, 3, 11, ctx.seed + 45);
  const sea = ctx.seaLevel;
  const c = out.color;
  if (sheet < sea) {
    // Dark open leads between the plates, skinned with new grey ice.
    const depth = (sea - sheet) / Math.max(0.05, sea);
    set(c, blue);
    blend(c, slate, smooth(0.02, 0.3, depth));
    blend(c, grey, smooth(0.8, 0.95, cracks) * 0.4);
    out.water = true;
    out.roughness = 0.2;
    out.relief = 0.36;
    out.lift = 0;
  } else {
    const e = clamp01((sheet - sea) / Math.max(0.05, 1 - sea));
    set(c, grey);
    blend(c, ivory, smooth(0.1, 0.5, e));
    // Pressure folds: pale crests with blue shadowed troughs.
    blend(c, ivory, smooth(0.55, 0.85, ridges) * 0.7);
    blend(c, blue, smooth(0.35, 0.05, ridges) * 0.35);
    blend(c, blue, smooth(0.9, 0.97, cracks) * 0.5);
    out.water = false;
    out.roughness = 0.5;
    out.relief = clamp01(0.45 + ridges * 0.45 + e * 0.1);
    out.lift = (e * 0.012 + ridges * 0.014) * ctx.relief;
  }
  out.cloud =
    smooth(0.7, 0.88, fbm(x, y * 1.6, z, 4, 3.4, ctx.seed + 700)) *
    ctx.clouds *
    2;
  out.emission = 0;
}

function colonies(
  x: number,
  y: number,
  z: number,
  ctx: Context,
  out: SurfaceSample,
) {
  const [dark, violet, pink, cream] = ctx.pal;
  const land = landmass(x, y, z, ctx);
  const sea = ctx.seaLevel;
  const c = out.color;
  const grain = fbm(x, y, z, 3, 14, ctx.seed + 9);
  if (land < sea) {
    set(c, violet);
    blend(c, dark, smooth(0, 0.25, (sea - land) / Math.max(0.05, sea)));
    scale(c, 0.9 + grain * 0.2);
    out.water = true;
    out.roughness = 0.18;
    out.relief = 0.38;
    out.lift = 0;
    out.emission = 0;
  } else {
    // Round colonies, each with a pale core and concentric growth rings.
    const cell = cells(x, y, z, 2.6 + ctx.detail * 3.2, ctx.seed + 60);
    // Not every cell is colonized; the ones that are vary widely in size.
    const size = cell.id < 0.28 ? 0 : 0.3 + cell.id * 0.32;
    const inside = size ? smooth(size, size - 0.04, cell.distance) : 0;
    const rings =
      0.5 +
      0.5 *
        Math.cos(
          (cell.distance / Math.max(size, 0.01)) * Math.PI * 5 + cell.id * 9,
        );
    set(c, violet);
    blend(c, dark, (1 - smooth(sea, sea + 0.25, land)) * 0.35);
    scale(c, 0.85 + grain * 0.3);
    blend(c, pink, inside * (0.55 + rings * 0.35));
    blend(c, cream, inside * smooth(size * 0.55, size * 0.1, cell.distance));
    out.water = false;
    out.roughness = 0.8;
    out.relief = 0.45 + inside * (0.2 + rings * 0.15);
    out.lift = ((land - sea) * 0.02 + inside * 0.006) * ctx.relief;
    out.emission = inside * (0.35 + rings * 0.4);
  }
  out.cloud =
    smooth(0.74, 0.9, fbm(x, y * 1.8, z, 4, 3, ctx.seed + 700)) *
    ctx.clouds *
    1.8;
}

function gasGiant(
  x: number,
  y: number,
  z: number,
  ctx: Context,
  out: SurfaceSample,
) {
  const pal = ctx.pal;
  const turbulence = fbm(x, y, z, 5, 4, ctx.seed + 3) - 0.5;
  const fine = fbm(x, y * 3, z, 3, 9, ctx.seed + 4) - 0.5;
  // A single storm oval, sheared into the flow around it.
  const sx = x - 0.62,
    sy = (y + 0.28) * 1.9,
    sz = z - 0.62;
  const storm = Math.exp(-(sx * sx + sy * sy + sz * sz) * 18);
  const latitude =
    y * (7 + ctx.detail * 6) + turbulence * 1.6 + fine * 0.5 + storm * 2.5;
  const band = 0.5 + 0.5 * Math.sin(latitude * Math.PI);
  const shear = 0.5 + 0.5 * Math.sin(latitude * Math.PI * 2.7 + turbulence * 4);
  const c = out.color;
  set(c, pal[1]);
  blend(c, pal[2], band);
  blend(c, pal[3], smooth(0.6, 0.95, shear) * 0.45);
  blend(c, pal[0], smooth(0.75, 0.98, 1 - band) * 0.55);
  blend(c, pal[0], storm * 0.6);
  blend(c, pal[3], smooth(0.35, 0.8, storm) * 0.5);
  out.water = false;
  out.roughness = 1;
  out.relief = 0.5;
  out.lift = 0;
  out.cloud = 0;
  out.emission = 0;
}

/** One sampler for textures, geometry, portraits and the planet lab. */
export function sampleSurface(
  x: number,
  y: number,
  z: number,
  ctx: Context,
  out: SurfaceSample,
) {
  switch (ctx.planet.terrain) {
    case 'gas':
      gasGiant(x, y, z, ctx, out);
      break;
    case 'desert':
      desert(x, y, z, ctx, out);
      break;
    case 'folds':
      iceWorld(x, y, z, ctx, out);
      break;
    case 'culture':
      colonies(x, y, z, ctx, out);
      break;
    default:
      terrestrial(x, y, z, ctx, out);
  }
  return out;
}

/** Scalar relief of a world at a direction, continuous across the seam. */
export function surfaceHeight(
  x: number,
  y: number,
  z: number,
  planet: PlanetRecipe,
) {
  const out = sampleSurface(x, y, z, surfaceContext(planet), createSample());
  return out.relief;
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
  const [colorData, bumpData, cloudData, roughData, emissionData] = maps;
  const ctx = surfaceContext(planet);
  const sample = createSample();
  for (let v = 0; v < height; v++) {
    const lat = (v / (height - 1)) * Math.PI;
    for (let u = 0; u < width; u++) {
      const lon = (u / (width - 1)) * Math.PI * 2;
      // SphereGeometry uses -cos(phi) for X. CanvasTexture flips V on upload.
      const x = -Math.sin(lat) * Math.cos(lon),
        y = Math.cos(lat),
        z = Math.sin(lat) * Math.sin(lon);
      sampleSurface(x, y, z, ctx, sample);
      const index = (v * width + u) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const srgb = linearToSrgb(sample.color[channel]) * 255;
        colorData[index + channel] = srgb;
        bumpData[index + channel] = sample.relief * 255;
        cloudData[index + channel] = 244;
        roughData[index + channel] = sample.roughness * 255;
        emissionData[index + channel] = srgb * sample.emission;
      }
      colorData[index + 3] =
        bumpData[index + 3] =
        roughData[index + 3] =
        emissionData[index + 3] =
          255;
      cloudData[index + 3] = sample.cloud * 235;
      if (u % 96 === 95) yield;
    }
    yield;
  }

  const geometry = new THREE.SphereGeometry(planet.radius, 128, 80);
  const positions = geometry.getAttribute('position');
  const p = new THREE.Vector3();
  if (planet.terrain !== 'gas') {
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i).normalize();
      sampleSurface(p.x, p.y, p.z, ctx, sample);
      p.multiplyScalar(planet.radius * (1 + sample.lift));
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

/** The spin that shows a balanced face of land and sea (or colonies) to the viewer. */
export function portraitTurn(planet: PlanetRecipe) {
  if (planet.terrain === 'gas' || planet.terrain === 'desert') return 0.9;
  const ctx = surfaceContext(planet);
  const sample = createSample();
  let best = 0.9,
    bestScore = Infinity;
  for (let step = 0; step < 12; step++) {
    const turn = (step / 12) * Math.PI * 2;
    let water = 0,
      count = 0;
    for (let v = -0.8; v <= 0.8; v += 0.2)
      for (let u = -0.8; u <= 0.8; u += 0.2) {
        if (u * u + v * v > 0.8) continue;
        const z = Math.sqrt(1 - u * u - v * v);
        sampleSurface(
          u * Math.cos(turn) + z * Math.sin(turn),
          v,
          -u * Math.sin(turn) + z * Math.cos(turn),
          ctx,
          sample,
        );
        water += sample.water ? 1 : 0;
        count++;
      }
    const score = Math.abs(
      water / count - (planet.terrain === 'ocean' ? 0.55 : 0.35),
    );
    if (score < bestScore) {
      bestScore = score;
      best = turn;
    }
  }
  return best;
}

/**
 * A lit, orthographic portrait from the same sampler: day side, terminator,
 * water glint, clouds and an atmospheric limb. Pixels are premultiplied-free RGBA.
 */
export function renderPlanetPortrait(
  planet: PlanetRecipe,
  size: number,
  turn = portraitTurn(planet),
): ImageData {
  const image = new ImageData(size, size);
  const ctx = surfaceContext(planet);
  const sample = createSample();
  // Key light from the upper left, a little in front.
  const lx = -0.55,
    ly = 0.5,
    lz = 0.67;
  const cosT = Math.cos(turn),
    sinT = Math.sin(turn);
  const tilt = 0.32,
    cosA = Math.cos(tilt),
    sinA = Math.sin(tilt);
  const atmosphere = ctx.atmosphere;
  for (let v = 0; v < size; v++)
    for (let u = 0; u < size; u++) {
      const sx = (u + 0.5 - size / 2) / (size / 2 - 0.75);
      const sy = (size / 2 - v - 0.5) / (size / 2 - 0.75);
      const r2 = sx * sx + sy * sy;
      const index = (v * size + u) * 4;
      if (r2 >= 1) continue;
      const sz = Math.sqrt(1 - r2);
      // View → body: tilt the pole toward the viewer, then spin.
      const ty = sy * cosA + sz * sinA,
        tz = -sy * sinA + sz * cosA;
      const bx = sx * cosT + tz * sinT,
        bz = -sx * sinT + tz * cosT;
      sampleSurface(bx, ty, bz, ctx, sample);
      const lambert = Math.max(0, sx * lx + sy * ly + sz * lz);
      const light = 0.07 + 0.93 * smooth(-0.05, 0.6, lambert);
      let r = sample.color[0] * light,
        g = sample.color[1] * light,
        b = sample.color[2] * light;
      if (sample.water) {
        // Half-vector toward the viewer for a soft sun glint.
        const hx = lx,
          hy = ly,
          hz = lz + 1;
        const hl = Math.hypot(hx, hy, hz);
        const glint =
          Math.pow(Math.max(0, (sx * hx + sy * hy + sz * hz) / hl), 220) * 0.45;
        r += glint;
        g += glint;
        b += glint;
      }
      const cloud = sample.cloud * light;
      r = mix(r, 0.95 * light, cloud);
      g = mix(g, 0.95 * light, cloud);
      b = mix(b, 0.97 * light, cloud);
      r += sample.emission * 0.25 * (1 - light);
      g += sample.emission * 0.18 * (1 - light);
      b += sample.emission * 0.22 * (1 - light);
      const limb = Math.pow(1 - sz, 2.4) * (0.3 + 0.7 * light);
      r += atmosphere[0] * limb * 0.9;
      g += atmosphere[1] * limb * 0.9;
      b += atmosphere[2] * limb * 0.9;
      image.data[index] = linearToSrgb(r) * 255;
      image.data[index + 1] = linearToSrgb(g) * 255;
      image.data[index + 2] = linearToSrgb(b) * 255;
      // Antialiased rim.
      image.data[index + 3] = clamp01((1 - Math.sqrt(r2)) * size * 0.5) * 255;
    }
  return image;
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
