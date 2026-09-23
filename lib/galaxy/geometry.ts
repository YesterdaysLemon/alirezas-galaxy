import * as THREE from 'three';
import { gaussian, seededRandom } from './math';

/** The home galaxy: star clouds and sparks along five logarithmic arms. */
export function createGalaxyGeometry(count: number, arms = 5) {
  const random = seededRandom();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const inner = new THREE.Color(0xfff5d5);
  const rose = new THREE.Color(0xffc7f5);
  const violet = new THREE.Color(0x824cff);
  const blue = new THREE.Color(0x2247ff);
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const normalizedRadius = Math.pow(random(), 0.72);
    const baseRadius = normalizedRadius * 14.2;
    const arm = index % arms;
    const angleNoise = gaussian(random) * (0.065 + normalizedRadius * 0.15);
    const radiusNoise = gaussian(random) * (0.15 + normalizedRadius * 0.74);
    const radius = Math.max(0.04, baseRadius + radiusNoise);
    const angle = (arm / arms) * Math.PI * 2 + radius * 0.49 + angleNoise;
    const offset = index * 3;

    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] =
      gaussian(random) * (0.055 + normalizedRadius * 0.22);
    positions[offset + 2] = Math.sin(angle) * radius;

    if (normalizedRadius < 0.2) {
      color
        .copy(inner)
        .lerp(rose, THREE.MathUtils.smoothstep(normalizedRadius, 0.02, 0.2));
    } else if (normalizedRadius < 0.63) {
      color
        .copy(rose)
        .lerp(violet, THREE.MathUtils.smoothstep(normalizedRadius, 0.2, 0.63));
    } else {
      color
        .copy(violet)
        .lerp(blue, THREE.MathUtils.smoothstep(normalizedRadius, 0.63, 1));
    }

    const warmth = random();
    if (warmth > 0.965) color.lerp(inner, 0.62);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;

    const isCloud = random() < 0.69;
    sizes[index] = isCloud
      ? 8 + random() * (13 + normalizedRadius * 7)
      : 1.3 + random() * 3.1;
    alphas[index] = isCloud ? 0.045 + random() * 0.075 : 0.45 + random() * 0.5;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** The sphere of foreground stars around the galaxy. */
export function createBackdropGeometry(count: number) {
  const random = seededRandom(5118);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const palette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0x88dfff),
    new THREE.Color(0xff9cdc),
    new THREE.Color(0xffdd7a),
    new THREE.Color(0xa68cff),
  ];

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const radius = 23 + random() * 34;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[offset] = radius * Math.sin(phi) * Math.cos(theta);
    positions[offset + 1] = radius * Math.cos(phi);
    positions[offset + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const color = palette[Math.floor(random() * palette.length)];
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    sizes[index] = 2 + Math.pow(random(), 4) * 9.5;
    alphas[index] = 0.55 + random() * 0.45;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** A small three-armed galaxy for the far background. */
export function createDistantGalaxyGeometry(count: number, seed: number) {
  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const core = new THREE.Color(0xffedcf);
  const rose = new THREE.Color(0xe4a9ff);
  const violet = new THREE.Color(0x706cff);
  const color = new THREE.Color();
  const arms = 3;

  for (let index = 0; index < count; index += 1) {
    const normalizedRadius = Math.pow(random(), 0.64);
    const arm = index % arms;
    const radius = Math.max(
      0.015,
      normalizedRadius + gaussian(random) * (0.025 + normalizedRadius * 0.07),
    );
    const angle =
      (arm / arms) * Math.PI * 2 +
      radius * Math.PI * 2.35 +
      gaussian(random) * (0.045 + normalizedRadius * 0.12);
    const offset = index * 3;

    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = Math.sin(angle) * radius;
    positions[offset + 2] = gaussian(random) * 0.035;

    color
      .copy(core)
      .lerp(
        normalizedRadius < 0.38 ? rose : violet,
        normalizedRadius < 0.38
          ? THREE.MathUtils.smoothstep(normalizedRadius, 0.04, 0.38)
          : THREE.MathUtils.smoothstep(normalizedRadius, 0.38, 1),
      );
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    sizes[index] =
      normalizedRadius < 0.14
        ? 4.4 + random() * 4.8
        : 1.2 + random() * (random() > 0.88 ? 4.6 : 2.1);
    alphas[index] =
      normalizedRadius < 0.18 ? 0.58 + random() * 0.38 : 0.25 + random() * 0.52;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.computeBoundingSphere();
  return geometry;
}
