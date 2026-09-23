import * as THREE from 'three';
import type { SolarSystem } from '../../data/solar-systems';
import { seededRandom, terrainNoise } from '../planet-textures';
import { preparationTurn } from '../planet-preparation';

/** A warm radial glow for the star's corona and the galactic core. */
export function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(128, 128, 2, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,255,230,1)');
  gradient.addColorStop(0.15, 'rgba(255,229,155,.9)');
  gradient.addColorStop(0.3, 'rgba(255,182,66,.35)');
  gradient.addColorStop(0.52, 'rgba(239,126,29,.10)');
  gradient.addColorStop(1, 'rgba(217,104,25,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

async function nebulaTexture(seed: number, signal: AbortSignal) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    if (y % 4 === 0) await preparationTurn(signal);
    for (let x = 0; x < 256; x++) {
      const u = (x - 128) / 128,
        v = (y - 128) / 128;
      const warp = terrainNoise(u * 3, v * 3, 2, seed);
      const cloud =
        terrainNoise(u * 4 + warp, v * 4, 4, seed + 1) * 0.62 +
        terrainNoise(u * 11, v * 11, 8, seed + 2) * 0.26 +
        terrainNoise(u * 29, v * 29, 3, seed + 3) * 0.12;
      const alpha =
        Math.pow(Math.max(0, 1 - u * u - v * v), 1.6) *
        Math.pow(Math.max(0, cloud - 0.24), 1.7) *
        600;
      const i = (y * 256 + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
      image.data[i + 3] = alpha;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function starfield(skyRadius: number, random: () => number) {
  const positions = new Float32Array(2400 * 3),
    colors = new Float32Array(2400 * 3);
  for (let i = 0; i < 2400; i++) {
    const a = random() * Math.PI * 2,
      y = random() * 2 - 1,
      r = Math.sqrt(1 - y * y);
    positions[i * 3] = Math.cos(a) * r * skyRadius;
    positions[i * 3 + 1] = y * skyRadius;
    positions[i * 3 + 2] = Math.sin(a) * r * skyRadius;
    const brightness = 0.15 + Math.pow(random(), 3) * 0.85,
      warm = random();
    colors[i * 3] = brightness * (0.72 + warm * 0.28);
    colors[i * 3 + 1] = brightness * 0.85;
    colors[i * 3 + 2] = brightness * (1 - warm * 0.22);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: skyRadius * 0.0014,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  material.onBeforeCompile = (shader) => {
    // PointsMaterial ignores object scale; preserve star size across the flight's unit rebase.
    shader.vertexShader = shader.vertexShader.replace(
      'gl_PointSize = size;',
      'gl_PointSize = size * length(modelMatrix[0].xyz);',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(0.12, 0.5, length(gl_PointCoord - vec2(0.5)));',
    );
  };
  return new THREE.Points(geometry, material);
}

/**
 * From inside the disc the home galaxy is a luminous band, brightest toward
 * its core. It continues the view the camera just flew through.
 */
function galacticBand(
  skyRadius: number,
  cloud: THREE.Texture,
  glow: THREE.Texture,
  random: () => number,
) {
  const band = new THREE.Group();
  const count = 3200;
  const positions = new Float32Array(count * 3),
    colors = new Float32Array(count * 3);
  const core = new THREE.Color(0xffe6c4),
    rose = new THREE.Color(0xe9a6ff),
    violet = new THREE.Color(0x7a5cff),
    blue = new THREE.Color(0x3b5cff),
    color = new THREE.Color();
  const gaussian = () =>
    Math.sqrt(-2 * Math.log(Math.max(1e-6, random()))) *
    Math.cos(Math.PI * 2 * random());
  for (let i = 0; i < count; i++) {
    // Longitude 0 (+x) faces the galactic core; half the stars crowd it.
    const longitude =
      random() < 0.45 ? gaussian() * 0.75 : (random() * 2 - 1) * Math.PI;
    const towardCore = Math.pow(Math.max(0, Math.cos(longitude)), 2);
    const latitude = gaussian() * (0.05 + towardCore * 0.09);
    const r = skyRadius * 0.97;
    positions[i * 3] = Math.cos(longitude) * Math.cos(latitude) * r;
    positions[i * 3 + 1] = Math.sin(latitude) * r;
    positions[i * 3 + 2] = Math.sin(longitude) * Math.cos(latitude) * r;
    color
      .copy(blue)
      .lerp(violet, Math.min(1, towardCore * 2 + 0.25))
      .lerp(rose, THREE.MathUtils.smoothstep(towardCore, 0.35, 0.8))
      .lerp(core, THREE.MathUtils.smoothstep(towardCore, 0.82, 1));
    const brightness = 0.35 + random() * 0.65;
    colors[i * 3] = color.r * brightness;
    colors[i * 3 + 1] = color.g * brightness;
    colors[i * 3 + 2] = color.b * brightness;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  band.add(
    new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: skyRadius * 0.0024,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  // Broad smoky lanes along the band, and the core's glow above the horizon.
  for (let i = 0; i < 9; i++) {
    const longitude = (i / 9) * Math.PI * 2;
    const towardCore = Math.pow(Math.max(0, Math.cos(longitude)), 2);
    const lane = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cloud,
        color: new THREE.Color(0x3a2f8f).lerp(
          new THREE.Color(0x9a62c8),
          towardCore,
        ),
        transparent: true,
        opacity: 0.55 + towardCore * 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        rotation: Math.PI / 2 + (random() - 0.5) * 0.3,
      }),
    );
    lane.position.set(
      Math.cos(longitude) * skyRadius * 0.9,
      0,
      Math.sin(longitude) * skyRadius * 0.9,
    );
    lane.scale.set(skyRadius * 0.34, skyRadius * 0.95, 1);
    band.add(lane);
  }
  const coreGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glow,
      color: 0xffd9f0,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  coreGlow.position.set(skyRadius * 0.9, skyRadius * 0.02, 0);
  coreGlow.scale.set(skyRadius * 0.95, skyRadius * 0.42, 1);
  band.add(coreGlow);
  return band;
}

/**
 * A system's local sky: stars, nebulae in its own colours, and the galactic
 * band. It is only meaningful after the unit handoff, so it fades separately.
 */
export async function createSky(
  system: SolarSystem,
  glow: THREE.Texture,
  signal: AbortSignal,
) {
  const random = seededRandom(system.seed);
  const skyRadius = Math.max(150, system.extent * 8);
  const sky = new THREE.Group();
  sky.add(starfield(skyRadius, random));
  const clouds: THREE.Texture[] = [];
  for (const seed of [system.seed, system.seed + 51])
    clouds.push(await nebulaTexture(seed, signal));
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: clouds[i % 2],
        color: system.nebula[i % 2],
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        rotation: random() * Math.PI,
      }),
    );
    sprite.position.set(
      Math.cos(angle) * skyRadius * 0.75,
      (random() - 0.5) * skyRadius * 0.9,
      Math.sin(angle) * skyRadius * 0.75,
    );
    sprite.scale.set(
      skyRadius * (0.85 + random() * 0.45),
      skyRadius * (0.55 + random() * 0.4),
      1,
    );
    sky.add(sprite);
  }
  await preparationTurn(signal);
  const band = galacticBand(skyRadius, clouds[0], glow, random);
  sky.add(band);
  return { sky, band, clouds };
}
