'use client';

/* oxlint-disable next/no-img-element -- Keep the local SVG unmodified in Vinext. */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import { portraitUrls } from '@/data/portraits';
import { getQuoteOfTheDay, quotationCollection } from '@/data/transmissions';
import { destinations } from '@/data/worlds';
import { webring } from '@/data/webring';
import { WebringPanel } from './webring-panel';

const pointsVertexShader = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uPointScale;
  uniform float uOpacity;
  attribute float aSize;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = color;
    vAlpha = aAlpha * uOpacity;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    float perspective = clamp(24.0 / max(1.0, -viewPosition.z), 0.32, 2.5);
    gl_PointSize = max(1.0, aSize * uPointScale * uPixelRatio * perspective);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const pointsFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5)) * 2.0;
    if (distanceToCenter > 1.0) discard;
    float haze = 1.0 - smoothstep(0.06, 1.0, distanceToCenter);
    float spark = 1.0 - smoothstep(0.0, 0.22, distanceToCenter);
    float alpha = (haze * haze * 0.8 + spark * 0.48) * vAlpha;
    gl_FragColor = vec4(vColor * (0.82 + spark * 1.35), alpha);
  }
`;

function seededRandom(seed = 9173) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random: () => number) {
  const first = Math.max(0.000001, random());
  const second = Math.max(0.000001, random());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(Math.PI * 2 * second);
}

function createGalaxyGeometry(count: number) {
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
  const arms = 5;

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

function createBackdropGeometry(count: number) {
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

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const glow = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  glow.addColorStop(0, 'rgba(255, 255, 244, 1)');
  glow.addColorStop(0.09, 'rgba(255, 247, 197, .98)');
  glow.addColorStop(0.22, 'rgba(255, 207, 160, .76)');
  glow.addColorStop(0.46, 'rgba(245, 145, 245, .25)');
  glow.addColorStop(0.72, 'rgba(103, 81, 255, .08)');
  glow.addColorStop(1, 'rgba(27, 21, 92, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createDistantGalaxyGeometry(count: number, seed: number) {
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

function createMarkerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.translate(128, 128);
  const aura = context.createRadialGradient(0, 0, 1, 0, 0, 108);
  aura.addColorStop(0, 'rgba(255,255,255,1)');
  aura.addColorStop(0.025, 'rgba(255,247,193,1)');
  aura.addColorStop(0.075, 'rgba(255,235,196,.42)');
  aura.addColorStop(0.2, 'rgba(255,210,131,.08)');
  aura.addColorStop(0.34, 'rgba(255,255,255,0)');
  aura.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = aura;
  context.fillRect(-128, -128, 256, 256);

  const lens = context.createRadialGradient(-8, -10, 2, 0, 0, 39);
  lens.addColorStop(0, 'rgba(34,37,55,.48)');
  lens.addColorStop(0.58, 'rgba(7,9,18,.9)');
  lens.addColorStop(1, 'rgba(0,1,7,.98)');
  context.fillStyle = lens;
  context.beginPath();
  context.arc(0, 0, 38, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = 'rgba(255, 247, 207, .98)';
  context.lineWidth = 4.6;
  [43, 61].forEach((radius, index) => {
    context.globalAlpha = 1 - index * 0.2;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.stroke();
  });

  context.globalAlpha = 1;
  context.strokeStyle = 'rgba(255,255,241,.96)';
  context.shadowColor = 'rgba(255,246,182,1)';
  context.shadowBlur = 10;
  context.lineWidth = 2.2;
  context.beginPath();
  context.moveTo(-31, 0);
  context.lineTo(31, 0);
  context.moveTo(0, -31);
  context.lineTo(0, 31);
  context.moveTo(-15, -15);
  context.lineTo(15, 15);
  context.moveTo(15, -15);
  context.lineTo(-15, 15);
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = 'white';
  context.beginPath();
  context.arc(0, 0, 3.4, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSignalWaveTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.translate(128, 128);
  context.strokeStyle = 'rgba(255, 247, 205, .96)';
  context.shadowColor = 'rgba(255, 220, 151, .92)';
  context.shadowBlur = 10;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(0, 0, 94, 0, Math.PI * 2);
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPointsMaterial(pixelRatio: number, opacity = 1, pointScale = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uPointScale: { value: pointScale },
      uOpacity: { value: opacity },
    },
    vertexShader: pointsVertexShader,
    fragmentShader: pointsFragmentShader,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });
}

type MenuIconName = 'random' | 'about' | 'github';

function MenuIcon({ name }: { name: MenuIconName }) {
  if (name === 'random') {
    return (
      <svg
        className="menu-icon menu-icon-random"
        data-icon="soft-organic-star"
        aria-hidden="true"
        viewBox="0 0 24 24"
      >
        <path d="M12 2.8c2.2 0 3.1 3.1 3.8 5.2 2.1-.8 5.2-1.2 5.9.9.7 2.1-2 3.8-3.8 5.2 1.5 1.7 3.2 4.4 1.4 5.8-1.8 1.3-4.2-.8-6.1-2-1.2 1.9-3.1 4.5-5 3.3-1.9-1.2-.4-4.2.3-6.3-2.2-.5-5.4-1.4-5.2-3.6.2-2.2 3.5-2.5 5.7-2.5.2-2.3.7-6 3-6Z" />
      </svg>
    );
  }

  if (name === 'about') {
    return (
      <svg
        className="menu-icon menu-icon-about"
        data-icon="little-creature"
        aria-hidden="true"
        viewBox="0 0 24 24"
      >
        <path d="M4 13.5c0-5 3.2-9 8-9s8 4 8 9c0 4.4-3.3 6.5-8 6.5s-8-2.1-8-6.5Z" />
        <circle cx="9" cy="11" r="1.6" />
        <circle cx="15" cy="11" r="1.6" />
        <path d="M9 16c2 1.2 4 1.2 6 0M6.2 7 4.6 4.4M17.8 7l1.6-2.6" />
      </svg>
    );
  }

  return (
    <svg
      className="menu-icon menu-icon-github"
      data-icon="github"
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path d="M12 .9a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.16c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.54 0-1.22.44-2.22 1.16-3-.12-.29-.5-1.43.11-2.97 0 0 .94-.3 3.08 1.15A10.7 10.7 0 0 1 12 6.31c.95 0 1.9.13 2.8.38 2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.68.11 2.97.72.78 1.16 1.78 1.16 3 0 4.31-2.64 5.25-5.15 5.53.4.35.76 1.03.76 2.08v3.07c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .9Z" />
    </svg>
  );
}

function randomNonzeroOffset(itemCount: number) {
  return 1 + Math.floor(Math.random() * (itemCount - 1));
}

export function GalaxyIndex() {
  const stageRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLButtonElement>(null);
  const ringPortalRef = useRef<HTMLButtonElement>(null);
  const ringOpenRef = useRef(false);
  const [ringOpen, setRingOpen] = useState(false);
  const activeIndexRef = useRef(0);
  const previewIndexRef = useRef(0);
  const expandedPreviewIndexRef = useRef<number | null>(null);
  const expandedRef = useRef(false);
  const cameraModeRef = useRef<'default' | 'expanded' | 'manual'>('default');
  const ambientMotionRef = useRef(true);
  const coreExposureRef = useRef(0.92);
  const resetGalaxyRef = useRef<() => void>(() => undefined);
  const spinGalaxyRef = useRef<() => void>(() => undefined);
  const dockGalaxyIconRef = useRef<HTMLImageElement>(null);
  const focusRotationRef = useRef<number | null>(
    destinations[0].angle - Math.PI / 2,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [expandedPreviewIndex, setExpandedPreviewIndex] = useState<
    number | null
  >(null);
  const [expanded, setExpanded] = useState(false);
  const [dockTransmission, setDockTransmission] = useState(0);
  const [menuHighlight, setMenuHighlight] = useState(0);
  const active = destinations[activeIndex];
  const preview = destinations[previewIndex];
  const floatingPreviewIndex = expanded ? expandedPreviewIndex : previewIndex;
  const floatingPreview =
    floatingPreviewIndex === null ? null : destinations[floatingPreviewIndex];
  const dailyQuote = getQuoteOfTheDay();

  const previewDestination = (index: number) => {
    if (expandedRef.current) return;
    previewIndexRef.current = index;
    setPreviewIndex(index);
  };

  const expandDestination = (index: number) => {
    ringOpenRef.current = false;
    setRingOpen(false);
    activeIndexRef.current = index;
    previewIndexRef.current = index;
    expandedPreviewIndexRef.current = null;
    expandedRef.current = true;
    cameraModeRef.current = 'expanded';
    focusRotationRef.current = destinations[index].angle - Math.PI / 2;
    setActiveIndex(index);
    setPreviewIndex(index);
    setExpandedPreviewIndex(null);
    setExpanded(true);
  };

  const expandRandomDestination = () => {
    const currentIndex = expandedRef.current
      ? activeIndexRef.current
      : previewIndexRef.current;
    const offset = randomNonzeroOffset(destinations.length);
    expandDestination((currentIndex + offset) % destinations.length);
  };

  const collapseDestination = () => {
    expandedPreviewIndexRef.current = null;
    expandedRef.current = false;
    cameraModeRef.current = 'default';
    setExpandedPreviewIndex(null);
    setExpanded(false);
  };

  const openWebring = () => {
    collapseDestination();
    ringOpenRef.current = true;
    setRingOpen(true);
  };

  const closeWebring = () => {
    ringOpenRef.current = false;
    setRingOpen(false);
    ringPortalRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (ringOpenRef.current) closeWebring();
      else if (expandedRef.current) collapseDestination();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const storedExposure = Number(
          window.localStorage.getItem('afshan-core-exposure-v2'),
        );
        if (storedExposure >= 0.55 && storedExposure <= 1) {
          coreExposureRef.current = storedExposure;
        }
      } catch {
        // Keep the tuned default when storage is unavailable.
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const sceneShell = stage.parentElement!;
    const portraitBurstTarget = stage;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        depth: true,
        stencil: false,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    const isCompact = window.matchMedia('(max-width: 720px)').matches;
    let compactViewport = isCompact;
    const reducedMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );
    let reduceMotion = reducedMotionQuery.matches;
    const setMotionProfile = (matches: boolean) => {
      reduceMotion = matches;
      stage.dataset.motionProfile = matches ? 'gentle' : 'full';
    };
    const onReducedMotionChange = (event: MediaQueryListEvent) => {
      setMotionProfile(event.matches);
    };
    setMotionProfile(reduceMotion);
    reducedMotionQuery.addEventListener('change', onReducedMotionChange);
    const cores = navigator.hardwareConcurrency ?? 4;
    const starCount = isCompact || cores <= 4 ? 8800 : 17600;
    const backdropCount = isCompact ? 3000 : 7200;
    const maxPixelRatio = isCompact || cores <= 4 ? 1.1 : 1.45;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020308);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const cameraLookTarget = new THREE.Vector3(0.7, 0, 0);
    let defaultCameraDistance = isCompact ? 25.5 : 20.5;
    let expandedCameraDistance = isCompact ? 21.8 : 17.25;
    let cameraDistance = defaultCameraDistance;
    camera.position.set(-0.45, cameraDistance * 0.37, cameraDistance * 0.93);
    camera.lookAt(0.7, 0, 0);

    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.setAttribute('data-galaxy-canvas', '');
    stage.appendChild(renderer.domElement);

    const backdropGeometry = createBackdropGeometry(backdropCount);
    const backdropMaterial = createPointsMaterial(pixelRatio);
    backdropMaterial.depthTest = false;
    const backdrop = new THREE.Points(backdropGeometry, backdropMaterial);
    backdrop.renderOrder = -4;
    scene.add(backdrop);

    const distantGalaxySpecs = [
      { position: [4.9, 6.1, -20], scale: [3.2, 1.06], opacity: 0.88 },
      { position: [-3.7, -4.8, -25], scale: [1.45, 0.5], opacity: 0.42 },
      { position: [4.2, -5.7, -29], scale: [1.02, 0.37], opacity: 0.38 },
      { position: [-2.8, 8.8, -31], scale: [0.75, 0.27], opacity: 0.35 },
      { position: [1.8, -9.2, -34], scale: [0.55, 0.2], opacity: 0.32 },
      { position: [-4.5, 3.1, -38], scale: [0.44, 0.16], opacity: 0.3 },
    ] as const;
    const nearGalaxyGeometry = createDistantGalaxyGeometry(
      isCompact ? 620 : 1050,
      8317,
    );
    const farGalaxyGeometry = createDistantGalaxyGeometry(
      isCompact ? 210 : 340,
      1911,
    );
    const distantGalaxies = distantGalaxySpecs.map((spec, index) => {
      const material = createPointsMaterial(
        pixelRatio,
        spec.opacity,
        index === 0 ? 1.58 : 0.92,
      );
      material.depthTest = false;
      const points = new THREE.Points(
        index === 0 ? nearGalaxyGeometry : farGalaxyGeometry,
        material,
      );
      points.position.set(spec.position[0], spec.position[1], spec.position[2]);
      points.scale.set(spec.scale[0], spec.scale[1], 1);
      points.rotation.z = index * 0.71 - 0.38;
      points.renderOrder = -2;
      scene.add(points);
      return points;
    });

    // The nearby galaxy is still built from points; this small additive core
    // supplies the bloom and central light source those particles scatter.
    const distantCoreTexture = createGlowTexture();
    const distantCoreMaterial = new THREE.SpriteMaterial({
      map: distantCoreTexture,
      color: 0xffe0cf,
      transparent: true,
      opacity: 0.54,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const distantCore = new THREE.Sprite(distantCoreMaterial);
    distantCore.position.set(4.9, 6.1, -19.96);
    distantCore.scale.set(2.45, 0.82, 1);
    distantCore.renderOrder = -1;
    scene.add(distantCore);

    const galaxy = new THREE.Group();
    galaxy.rotation.x = -0.08;
    galaxy.rotation.y = 0.16;
    galaxy.position.y = 1.35;
    galaxy.scale.setScalar(1.08);
    scene.add(galaxy);

    const galaxyGeometry = createGalaxyGeometry(starCount);
    const galaxyMaterial = createPointsMaterial(pixelRatio);
    const galaxyPoints = new THREE.Points(galaxyGeometry, galaxyMaterial);
    galaxyPoints.renderOrder = 1;
    galaxy.add(galaxyPoints);

    // A second pass over the same compact buffer turns the points into the
    // broad, smoky ribbons that made the original menu read from across a room.
    const galaxyMistMaterial = createPointsMaterial(pixelRatio, 0.32, 2.45);
    galaxyMistMaterial.depthTest = false;
    const galaxyMist = new THREE.Points(galaxyGeometry, galaxyMistMaterial);
    galaxyMist.scale.set(1.012, 1, 1.012);
    galaxyMist.rotation.y = 0.018;
    galaxyMist.renderOrder = 0;
    galaxy.add(galaxyMist);

    const glowTexture = createGlowTexture();
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffffff,
      transparent: true,
      opacity: coreExposureRef.current,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.set(17.5, 8.2, 1);
    glow.position.y = 0.22;
    glow.renderOrder = 3;
    galaxy.add(glow);

    const softGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x7d5dff,
        transparent: true,
        opacity: 0.3 * coreExposureRef.current,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    );
    softGlow.scale.set(25, 12.4, 1);
    softGlow.position.y = -0.05;
    softGlow.renderOrder = 2;
    galaxy.add(softGlow);

    scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x190f36, 1.35));
    const keyLight = new THREE.PointLight(0xffe7ba, 18, 24, 1.4);
    keyLight.position.set(0, 5, 0);
    galaxy.add(keyLight);

    const markerTexture = createMarkerTexture();
    const signalWaveTexture = createSignalWaveTexture();
    const nodes = destinations.map((destination, index) => {
      const position = new THREE.Vector3(
        Math.cos(destination.angle) * destination.radius,
        0.38 + index * 0.018,
        Math.sin(destination.angle) * destination.radius,
      );
      const markerMaterial = new THREE.SpriteMaterial({
        map: markerTexture,
        color: new THREE.Color(destination.color).lerp(
          new THREE.Color(0xffe6a6),
          0.58,
        ),
        transparent: true,
        opacity: index === 0 ? 0.92 : 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });
      const marker = new THREE.Sprite(markerMaterial);
      marker.position.copy(position);
      marker.scale.setScalar(destination.size * (index === 0 ? 0.56 : 0.51));
      marker.userData.destinationIndex = index;
      marker.renderOrder = 8;
      galaxy.add(marker);

      const signalWaves = Array.from({ length: 3 }, (_, waveIndex) => {
        const material = new THREE.SpriteMaterial({
          map: signalWaveTexture,
          color: new THREE.Color(destination.color).lerp(
            new THREE.Color(0xffe9ac),
            0.68,
          ),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        });
        const wave = new THREE.Sprite(material);
        wave.position.copy(position);
        wave.scale.setScalar(destination.size * 0.5);
        wave.renderOrder = 7;
        wave.userData.phase = waveIndex / 3;
        galaxy.add(wave);
        return wave;
      });

      return { marker, signalWaves, position, occluded: false };
    });

    const portraitGroup = new THREE.Group();
    galaxy.add(portraitGroup);
    const portraitSprites: Array<{
      sprite: THREE.Sprite;
      velocity: THREE.Vector3;
      spin: number;
      life: number;
    }> = [];
    const portraitTextures: THREE.Texture[] = [];
    let portraitsLoading = false;
    let portraitsReady = false;
    let pendingBurst = false;
    let burstCooldown = 0;

    const textureLoader = new THREE.TextureLoader();

    function loadPortraitTextures() {
      if (portraitsLoading || portraitsReady) return;
      portraitsLoading = true;
      let unsettledTextures = portraitUrls.length;

      const settleTexture = () => {
        unsettledTextures -= 1;
        if (unsettledTextures > 0) return;

        portraitsReady = true;
        portraitsLoading = false;
        if (pendingBurst && portraitTextures.length > 0) {
          pendingBurst = false;
          burstPortraits();
        } else {
          pendingBurst = false;
        }
      };

      portraitUrls.forEach((url) => {
        textureLoader.load(
          url,
          (texture) => {
            if (disposed) {
              texture.dispose();
            } else {
              texture.colorSpace = THREE.SRGBColorSpace;
              portraitTextures.push(texture);
            }
            settleTexture();
          },
          undefined,
          settleTexture,
        );
      });
    }

    function burstPortraits() {
      if (burstCooldown > 0) return;
      if (!portraitsReady) {
        pendingBurst = true;
        loadPortraitTextures();
        return;
      }
      if (portraitTextures.length === 0) return;

      portraitBurstCount += 1;
      portraitBurstTarget.dataset.portraitBursts = String(portraitBurstCount);

      portraitSprites.forEach(({ sprite }) => {
        portraitGroup.remove(sprite);
        sprite.material.dispose();
      });
      portraitSprites.length = 0;
      const random = seededRandom(Date.now());

      for (let index = 0; index < 10; index += 1) {
        const material = new THREE.SpriteMaterial({
          map: portraitTextures[Math.floor(random() * portraitTextures.length)],
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        const angle = (index / 10) * Math.PI * 2 + random() * 0.38;
        const speed = 0.065 + random() * 0.08;
        sprite.position.set(0, 0.82, 0);
        sprite.scale.setScalar(0.01);
        sprite.renderOrder = 20;
        portraitGroup.add(sprite);
        portraitSprites.push({
          sprite,
          velocity: new THREE.Vector3(
            Math.cos(angle) * speed,
            0.015 + random() * 0.04,
            Math.sin(angle) * speed,
          ),
          spin: (random() - 0.5) * 0.1,
          life: 1,
        });
      }
      burstCooldown = 5;
    }

    const portraitPreloadTimer = window.setTimeout(
      loadPortraitTextures,
      isCompact ? 2600 : 1700,
    );

    const pointer = new THREE.Vector2(4, 4);
    const labelPosition = new THREE.Vector3();
    const previewPosition = new THREE.Vector3();
    const cameraFollowPosition = new THREE.Vector3();
    const ringPosition = new THREE.Vector3();
    const projectedHit = new THREE.Vector3();
    let stageWidth = stage.clientWidth;
    let stageHeight = stage.clientHeight;
    let bottomInset = 0;
    let rightInset = 0;
    let leftInset = 0;
    let touchPointer = false;
    let lastDetailIndex = -1;
    let chromeRects: DOMRect[] = [];
    let hoveredIndex = -1;
    let isDragging = false;
    let pointerId = -1;
    let lastX = 0;
    let lastY = 0;
    let dragDistance = 0;
    let angularVelocity = 0;
    let tiltVelocity = 0;
    let fastSpinTravel = 0;
    let portraitBurstCount = 0;
    let dockSpinPresses = 0;
    let frame = 0;
    let animationFrame = 0;
    let isVisible = true;
    let disposed = false;
    let previousTime = 0;

    portraitBurstTarget.dataset.portraitBursts = '0';

    spinGalaxyRef.current = () => {
      focusRotationRef.current = null;
      const direction = angularVelocity < -0.002 ? -1 : 1;
      dockSpinPresses += 1;
      const stagedMagnitude = Math.min(0.16, dockSpinPresses * 0.022);
      angularVelocity =
        direction *
        THREE.MathUtils.clamp(
          Math.max(Math.abs(angularVelocity) + 0.012, stagedMagnitude),
          0.022,
          0.16,
        );

      if (Math.abs(angularVelocity) >= 0.12 && burstCooldown <= 0) {
        burstPortraits();
        fastSpinTravel = 0;
        angularVelocity *= 0.58;
        dockSpinPresses = 0;
      }
    };

    const updatePointer = (event: PointerEvent) => {
      touchPointer = event.pointerType === 'touch';
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    };

    const destinationAtPointer = () => {
      // Pick the nearest visible star in screen space. World-sized spheres
      // shrink into tiny touch targets at the back of the spiral.
      let nearest = -1;
      let nearestDistance = touchPointer ? 28 : 22;
      nodes.forEach(({ position, occluded }, index) => {
        if (occluded) return;
        projectedHit.copy(position);
        galaxy.localToWorld(projectedHit);
        projectedHit.project(camera);
        if (projectedHit.z > 1 || projectedHit.z < -1) return;
        const distance = Math.hypot(
          ((projectedHit.x - pointer.x) * stageWidth) / 2,
          ((projectedHit.y - pointer.y) * stageHeight) / 2,
        );
        if (distance < nearestDistance) {
          nearest = index;
          nearestDistance = distance;
        }
      });
      return nearest;
    };

    const onPointerDown = (event: PointerEvent) => {
      isDragging = true;
      if (expandedPreviewIndexRef.current !== null) {
        expandedPreviewIndexRef.current = null;
        setExpandedPreviewIndex(null);
      }
      focusRotationRef.current = null;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      dragDistance = 0;
      renderer.domElement.setPointerCapture(event.pointerId);
      updatePointer(event);
    };

    const onPointerMove = (event: PointerEvent) => {
      updatePointer(event);
      if (!isDragging || event.pointerId !== pointerId) return;
      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      dragDistance += Math.abs(deltaX) + Math.abs(deltaY);
      const targetVelocity = THREE.MathUtils.clamp(
        deltaX * 0.0032,
        -0.16,
        0.16,
      );
      angularVelocity += (targetVelocity - angularVelocity) * 0.34;
      tiltVelocity +=
        (THREE.MathUtils.clamp(deltaY * 0.0012, -0.018, 0.018) - tiltVelocity) *
        0.3;
      const appliedRotation = angularVelocity * 0.68;
      galaxy.rotation.y += appliedRotation;
      fastSpinTravel += Math.abs(appliedRotation);
      galaxy.rotation.x = THREE.MathUtils.clamp(
        galaxy.rotation.x + tiltVelocity,
        -0.33,
        0.24,
      );
    };

    const endPointer = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const isTap = event.type === 'pointerup' && dragDistance < 8;
      if (isTap) updatePointer(event);
      const tappedIndex = isTap ? destinationAtPointer() : -1;
      isDragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      if (tappedIndex >= 0) {
        angularVelocity = 0;
        expandDestination(tappedIndex);
      } else if (isTap && expandedRef.current) {
        collapseDestination();
      }
      pointerId = -1;
    };

    const onPointerLeave = () => {
      if (!isDragging) {
        pointer.set(4, 4);
        renderer.domElement.style.cursor = 'grab';
        if (expandedPreviewIndexRef.current !== null) {
          expandedPreviewIndexRef.current = null;
          setExpandedPreviewIndex(null);
        }
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      cameraModeRef.current = 'manual';
      cameraDistance = THREE.MathUtils.clamp(
        cameraDistance + event.deltaY * 0.01,
        expandedRef.current ? 15.5 : 18,
        expandedRef.current ? 24 : 31,
      );
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', endPointer);
    renderer.domElement.addEventListener('pointercancel', endPointer);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    resetGalaxyRef.current = () => {
      ringOpenRef.current = false;
      setRingOpen(false);
      angularVelocity = 0;
      tiltVelocity = 0;
      fastSpinTravel = 0;
      dockSpinPresses = 0;
      cameraDistance = defaultCameraDistance;
      galaxy.rotation.x = -0.08;
      galaxy.rotation.y = destinations[0].angle - Math.PI / 2;
      galaxyPoints.rotation.y = 0;
      galaxyMist.rotation.y = 0.018;
      cameraLookTarget.set(0.7, 0, 0);
      activeIndexRef.current = 0;
      previewIndexRef.current = 0;
      expandedRef.current = false;
      cameraModeRef.current = 'default';
      focusRotationRef.current = destinations[0].angle - Math.PI / 2;
      setActiveIndex(0);
      setPreviewIndex(0);
      setExpanded(false);
    };

    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      stageWidth = width;
      stageHeight = height;
      const safeArea = getComputedStyle(sceneShell);
      bottomInset = parseFloat(safeArea.getPropertyValue('--safe-bottom')) || 0;
      rightInset = parseFloat(safeArea.getPropertyValue('--safe-right')) || 0;
      leftInset = parseFloat(safeArea.getPropertyValue('--safe-left')) || 0;
      lastDetailIndex = -1;
      compactViewport = width <= 720 || height <= 500;
      defaultCameraDistance = width <= 720 ? 25.5 : 20.5;
      expandedCameraDistance = width <= 720 ? 21.8 : 17.25;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(stage);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible && !animationFrame) {
        previousTime = 0;
        animationFrame = requestAnimationFrame(animate);
      }
    });
    intersectionObserver.observe(stage);

    const onVisibilityChange = () => {
      isVisible = document.visibilityState === 'visible';
      if (isVisible && !animationFrame) {
        previousTime = 0;
        animationFrame = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    function animate(time: number) {
      animationFrame = 0;
      if (disposed || !isVisible || document.visibilityState === 'hidden') {
        return;
      }

      const elapsedMs =
        previousTime === 0 ? 16.667 : Math.min(time - previousTime, 33.334);
      const delta = elapsedMs / 16.667;
      previousTime = time;
      frame += 1;

      if (!isDragging) {
        const focusRotation = focusRotationRef.current;
        if (focusRotation !== null && Math.abs(angularVelocity) < 0.02) {
          const rotationDelta = Math.atan2(
            Math.sin(focusRotation - galaxy.rotation.y),
            Math.cos(focusRotation - galaxy.rotation.y),
          );
          galaxy.rotation.y += rotationDelta * 0.045 * delta;
          if (Math.abs(rotationDelta) < 0.0018) {
            galaxy.rotation.y = focusRotation;
            focusRotationRef.current = null;
          }
        } else {
          const appliedRotation = angularVelocity * delta;
          galaxy.rotation.y += appliedRotation;
          fastSpinTravel += Math.abs(appliedRotation);
          angularVelocity *= Math.pow(0.968, delta);
          tiltVelocity *= Math.pow(0.93, delta);
          if (ambientMotionRef.current && Math.abs(angularVelocity) < 0.0012) {
            const ambientMotionScale = reduceMotion ? 0.55 : 1;
            galaxy.rotation.y += 0.00018 * ambientMotionScale * delta;
          }
        }
      }

      if (fastSpinTravel >= Math.PI * 8) {
        burstPortraits();
        fastSpinTravel = 0;
      }

      if (dockGalaxyIconRef.current) {
        dockGalaxyIconRef.current.style.transform = `rotate(${-galaxy.rotation.y}rad)`;
      }

      burstCooldown = Math.max(0, burstCooldown - elapsedMs / 1000);
      if (cameraModeRef.current !== 'manual') {
        const desiredCameraDistance = expandedRef.current
          ? expandedCameraDistance
          : defaultCameraDistance;
        cameraDistance +=
          (desiredCameraDistance - cameraDistance) * 0.065 * delta;
      }
      camera.position.y += (cameraDistance * 0.37 - camera.position.y) * 0.055;
      camera.position.z += (cameraDistance * 0.93 - camera.position.z) * 0.055;
      if (ambientMotionRef.current) {
        const ambientMotionScale = reduceMotion ? 0.55 : 1;
        backdrop.rotation.y -= 0.00006 * ambientMotionScale * delta;
        distantGalaxies.forEach((points, index) => {
          const rotationSpeed =
            index === 0 ? 0.00022 : index % 2 === 0 ? 0.000035 : -0.000028;
          points.rotation.z += rotationSpeed * ambientMotionScale * delta;
        });
      }
      glowMaterial.opacity +=
        (coreExposureRef.current - glowMaterial.opacity) * 0.075 * delta;
      softGlow.material.opacity +=
        (coreExposureRef.current * 0.3 - softGlow.material.opacity) *
        0.075 *
        delta;

      const selectedIndex = activeIndexRef.current;
      cameraFollowPosition.copy(nodes[selectedIndex].position);
      galaxy.localToWorld(cameraFollowPosition);
      const followAmount = isDragging ? 0.025 : 0.075;
      const desiredLookX = 0.7 + cameraFollowPosition.x * followAmount;
      const desiredLookY = cameraFollowPosition.y * 0.04;
      const desiredLookZ = cameraFollowPosition.z * 0.025;
      cameraLookTarget.x += (desiredLookX - cameraLookTarget.x) * 0.028 * delta;
      cameraLookTarget.y += (desiredLookY - cameraLookTarget.y) * 0.028 * delta;
      cameraLookTarget.z += (desiredLookZ - cameraLookTarget.z) * 0.028 * delta;
      camera.lookAt(cameraLookTarget);

      // Keep the neighboring galaxy in the open sky, clear of the main menu
      // and mobile browser safe areas. Its particles keep their own rotation.
      const portalX = stageWidth - (compactViewport ? 83 : 132) - rightInset;
      const portalY =
        stageHeight <= 500 && stageWidth > 720
          ? 44
          : compactViewport
            ? 100
            : 105;
      ringPosition
        .set(
          (portalX / stageWidth) * 2 - 1,
          1 - ((portalY - 14) / stageHeight) * 2,
          0.5,
        )
        .unproject(camera);
      ringPosition
        .sub(camera.position)
        .normalize()
        .multiplyScalar(44)
        .add(camera.position);
      distantGalaxies[0].position.copy(ringPosition);
      distantCore.position.copy(ringPosition);
      const unitsPerPixel =
        (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 44) /
        stageHeight;
      const neighborScale = (compactViewport ? 58 : 74) * unitsPerPixel;
      distantGalaxies[0].scale.set(neighborScale, neighborScale * 0.331, 1);
      distantCore.scale.set(neighborScale * 0.77, neighborScale * 0.26, 1);
      const portal = ringPortalRef.current;
      if (portal)
        portal.style.transform = `translate3d(${portalX}px, ${portalY}px, 0) translate(-50%, -50%)`;

      // Sample only actual controls, never the transparent corner/dock
      // wrappers. A beacon behind a real button should not invite a lost tap.
      if (frame % 8 === 1) {
        chromeRects = Array.from(
          sceneShell.querySelectorAll(
            '.spore-corner a, .spore-corner button, .spore-dock a, .spore-dock button, .webring-panel, .webring-portal-label, .world-close, .world-play',
          ),
          (element) => element.getBoundingClientRect(),
        );
      }
      nodes.forEach((node) => {
        projectedHit.copy(node.position);
        galaxy.localToWorld(projectedHit);
        projectedHit.project(camera);
        const x = (projectedHit.x * 0.5 + 0.5) * stageWidth;
        const y = (-projectedHit.y * 0.5 + 0.5) * stageHeight;
        node.occluded = chromeRects.some(
          (rect) =>
            x >= rect.left - 8 &&
            x <= rect.right + 8 &&
            y >= rect.top - 8 &&
            y <= rect.bottom + 8,
        );
      });

      if (!isDragging && frame % 2 === 0) {
        const nextIndex = destinationAtPointer();
        if (nextIndex >= 0) {
          if (expandedRef.current) {
            const nextExpandedPreview =
              nextIndex === activeIndexRef.current ? null : nextIndex;
            if (nextExpandedPreview !== expandedPreviewIndexRef.current) {
              expandedPreviewIndexRef.current = nextExpandedPreview;
              setExpandedPreviewIndex(nextExpandedPreview);
            }
          } else if (
            nextIndex !== hoveredIndex &&
            nextIndex !== previewIndexRef.current
          ) {
            previewIndexRef.current = nextIndex;
            setPreviewIndex(nextIndex);
          }
          hoveredIndex = nextIndex;
          renderer.domElement.style.cursor = 'pointer';
        } else {
          hoveredIndex = -1;
          renderer.domElement.style.cursor = 'grab';
          if (expandedPreviewIndexRef.current !== null) {
            expandedPreviewIndexRef.current = null;
            setExpandedPreviewIndex(null);
          }
        }
      } else if (isDragging) {
        renderer.domElement.style.cursor = 'grabbing';
      }

      nodes.forEach(({ marker, signalWaves, occluded }, index) => {
        const destination = destinations[index];
        const isSelected = expandedRef.current && index === selectedIndex;
        const isPreviewed =
          !expandedRef.current && index === previewIndexRef.current;
        const isHovered = index === hoveredIndex;
        const motionTime = time * (reduceMotion ? 0.72 : 1);
        const shimmerAmplitude = reduceMotion ? 0.025 : 0.04;
        const shimmer =
          0.96 +
          Math.sin(motionTime * 0.0042 + index * 1.71) * shimmerAmplitude;
        const pulse =
          !isSelected && !isPreviewed
            ? shimmer
            : 1 + Math.sin(motionTime * 0.0035) * (reduceMotion ? 0.03 : 0.045);
        const markerTarget =
          destination.size *
          (isSelected ? 0.82 : isHovered || isPreviewed ? 0.56 : 0.51) *
          pulse;
        marker.scale.x += (markerTarget - marker.scale.x) * 0.11;
        marker.scale.y += (markerTarget - marker.scale.y) * 0.11;
        marker.material.opacity +=
          ((occluded
            ? 0
            : isSelected
              ? 1
              : isHovered || isPreviewed
                ? 0.92
                : 0.82) -
            marker.material.opacity) *
          0.11;
        marker.material.rotation +=
          (0.00016 + index * 0.000025) * (reduceMotion ? 0.72 : 1) * delta;

        signalWaves.forEach((wave, waveIndex) => {
          const progress =
            (motionTime * 0.00022 + wave.userData.phase + index * 0.117) % 1;
          const waveScale =
            destination.size *
            (0.49 + THREE.MathUtils.smoothstep(progress, 0, 1) * 0.7);
          const envelope = Math.pow(Math.sin(progress * Math.PI), 1.3);
          const prominence =
            isSelected || isHovered || isPreviewed ? 0.22 : 0.62;
          wave.scale.setScalar(waveScale);
          wave.material.opacity = occluded ? 0 : envelope * prominence;
          wave.material.rotation = -motionTime * 0.000025 * (waveIndex + 1);
        });
      });

      const detail = detailRef.current;
      if (detail) {
        labelPosition.copy(nodes[selectedIndex].position);
        galaxy.localToWorld(labelPosition);
        labelPosition.project(camera);
        const bounds = renderer.domElement.getBoundingClientRect();
        const screenX = (labelPosition.x * 0.5 + 0.5) * bounds.width;
        const screenY = (-labelPosition.y * 0.5 + 0.5) * bounds.height;
        const usesCompactPanel = compactViewport;
        const panelWidth =
          detail.offsetWidth || Math.min(640, bounds.width - 24);
        const panelHeight =
          detail.offsetHeight || (usesCompactPanel ? 178 : 188);
        const horizontalMargin = Math.max(
          usesCompactPanel ? 10 : 14,
          leftInset,
        );
        const bottomClearance = (usesCompactPanel ? 80 : 76) + bottomInset;
        const maximumPanelX = Math.max(
          horizontalMargin,
          bounds.width - panelWidth - Math.max(horizontalMargin, rightInset),
        );
        const minimumPanelX = usesCompactPanel
          ? horizontalMargin
          : Math.min(220, maximumPanelX);
        const maximumPanelY = Math.max(
          10,
          bounds.height - panelHeight - bottomClearance,
        );
        const minimumPanelY = usesCompactPanel
          ? maximumPanelY
          : Math.min(240, maximumPanelY);
        const panelX = usesCompactPanel
          ? bounds.width > 720
            ? maximumPanelX
            : horizontalMargin
          : THREE.MathUtils.clamp(screenX - 90, minimumPanelX, maximumPanelX);
        const panelY = usesCompactPanel
          ? maximumPanelY
          : THREE.MathUtils.clamp(screenY - 94, minimumPanelY, maximumPanelY);
        // Let a person finish aiming at Launch / Close without chasing the
        // orbit. Release the card again when its controls lose hover/focus.
        if (
          lastDetailIndex !== selectedIndex ||
          !detail.matches(':hover, :focus-within')
        ) {
          detail.style.transform = `translate3d(${panelX}px, ${panelY}px, 0)`;
        }
        lastDetailIndex = selectedIndex;
        detail.style.opacity = labelPosition.z > 1 ? '0' : '1';
      }

      const previewElement = previewRef.current;
      if (previewElement) {
        const previewedIndex = expandedRef.current
          ? expandedPreviewIndexRef.current
          : previewIndexRef.current;
        if (previewedIndex !== null) {
          previewPosition.copy(nodes[previewedIndex].position);
          galaxy.localToWorld(previewPosition);
          previewPosition.project(camera);
          const bounds = renderer.domElement.getBoundingClientRect();
          const screenX = (previewPosition.x * 0.5 + 0.5) * bounds.width;
          const screenY = (-previewPosition.y * 0.5 + 0.5) * bounds.height;
          const previewWidth = previewElement.offsetWidth || 166;
          const previewHeight = previewElement.offsetHeight || 62;
          const previewMargin = bounds.width <= 720 ? 8 : 14;
          const opensLeft =
            screenX + previewWidth - 31 > bounds.width - previewMargin;
          const anchorOffset = opensLeft ? previewWidth - 31 : 31;
          const maximumPreviewX = Math.max(
            previewMargin,
            bounds.width - previewWidth - previewMargin,
          );
          const previewX = THREE.MathUtils.clamp(
            screenX - anchorOffset,
            previewMargin,
            maximumPreviewX,
          );
          const previewY = THREE.MathUtils.clamp(
            screenY,
            previewMargin + previewHeight / 2,
            bounds.height - previewMargin - previewHeight / 2,
          );
          previewElement.dataset.edge = opensLeft ? 'right' : 'left';
          previewElement.style.visibility = nodes[previewedIndex].occluded
            ? 'hidden'
            : '';
          previewElement.style.transform = `translate3d(${previewX}px, ${previewY}px, 0) translateY(-50%)`;
          previewElement.style.opacity = previewPosition.z > 1 ? '0' : '1';
        }
      }

      for (let index = portraitSprites.length - 1; index >= 0; index -= 1) {
        const portrait = portraitSprites[index];
        portrait.life -= 0.0085 * delta;
        portrait.sprite.position.addScaledVector(portrait.velocity, delta);
        portrait.sprite.material.rotation += portrait.spin * delta;
        const envelope = Math.sin(Math.max(0, portrait.life) * Math.PI);
        const scale = Math.max(0.01, envelope * 0.96);
        portrait.sprite.scale.set(scale, scale, 1);
        portrait.sprite.material.opacity = Math.min(1, portrait.life * 2);
        if (portrait.life <= 0) {
          portraitGroup.remove(portrait.sprite);
          portrait.sprite.material.dispose();
          portraitSprites.splice(index, 1);
        }
      }

      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    }

    animationFrame = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', endPointer);
      renderer.domElement.removeEventListener('pointercancel', endPointer);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.clearTimeout(portraitPreloadTimer);
      resetGalaxyRef.current = () => undefined;
      spinGalaxyRef.current = () => undefined;
      portraitSprites.forEach(({ sprite }) => sprite.material.dispose());
      portraitTextures.forEach((texture) => texture.dispose());
      glowTexture?.dispose();
      markerTexture?.dispose();
      signalWaveTexture?.dispose();
      glowMaterial.dispose();
      softGlow.material.dispose();
      galaxyGeometry.dispose();
      galaxyMaterial.dispose();
      galaxyMistMaterial.dispose();
      backdropGeometry.dispose();
      backdropMaterial.dispose();
      distantCoreTexture?.dispose();
      distantCoreMaterial.dispose();
      nearGalaxyGeometry.dispose();
      farGalaxyGeometry.dispose();
      distantGalaxies.forEach(({ material }) => material.dispose());
      nodes.forEach(({ marker, signalWaves }) => {
        marker.material.dispose();
        signalWaves.forEach(({ material }) => material.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <main id="galaxy" className="spore-shell relative overflow-hidden">
      <div ref={stageRef} className="absolute inset-0" data-galaxy-stage />
      <div aria-hidden="true" className="spore-vignette absolute inset-0" />

      <WebringPanel
        open={ringOpen}
        onOpen={openWebring}
        onClose={closeWebring}
        portalRef={ringPortalRef}
      />

      <header className="spore-corner" aria-label="Main menu">
        <a
          className="sprawl-mark"
          href="#galaxy"
          aria-label="Alireza Afshan — return home"
          onClick={(event) => {
            event.preventDefault();
            resetGalaxyRef.current();
          }}
        >
          <span>alireza</span>
          <span>afshan</span>
        </a>
        <nav className="spore-menu" aria-label="Primary">
          <button
            type="button"
            className={`spore-menu-item ${menuHighlight === 0 ? 'is-active' : ''}`}
            onClick={expandRandomDestination}
            onMouseEnter={() => setMenuHighlight(0)}
            onMouseLeave={() => setMenuHighlight(0)}
            onFocus={() => setMenuHighlight(0)}
            onBlur={() => setMenuHighlight(0)}
          >
            <MenuIcon name="random" />
            random world
          </button>
          <button
            type="button"
            className={`spore-menu-item ${menuHighlight === 1 ? 'is-active' : ''}`}
            onClick={() => expandDestination(0)}
            onMouseEnter={() => setMenuHighlight(1)}
            onMouseLeave={() => setMenuHighlight(0)}
            onFocus={() => setMenuHighlight(1)}
            onBlur={() => setMenuHighlight(0)}
          >
            <MenuIcon name="about" />
            about
          </button>
          <a
            className={`spore-menu-item ${menuHighlight === 2 ? 'is-active' : ''}`}
            href="https://github.com/YesterdaysLemon"
            onMouseEnter={() => setMenuHighlight(2)}
            onMouseLeave={() => setMenuHighlight(0)}
            onFocus={() => setMenuHighlight(2)}
            onBlur={() => setMenuHighlight(0)}
          >
            <MenuIcon name="github" />
            github
          </a>
        </nav>
      </header>

      {floatingPreview && !ringOpen ? (
        <button
          type="button"
          ref={previewRef}
          className={`world-preview ${expanded ? 'is-hover-hint' : ''}`}
          aria-label={`Inspect ${floatingPreview.name}`}
          aria-hidden={expanded || undefined}
          tabIndex={expanded ? -1 : undefined}
          onClick={() => expandDestination(floatingPreviewIndex!)}
          style={
            {
              '--world-color': `#${floatingPreview.color.toString(16).padStart(6, '0')}`,
            } as CSSProperties
          }
        >
          <div className="world-preview-orbit">
            <div className="world-preview-face">
              <span>{floatingPreview.glyph}</span>
              {floatingPreview.iconSrc ? (
                // Remote favicons are optional interface texture.
                // oxlint-disable-next-line next/no-img-element
                <img
                  key={floatingPreview.iconSrc}
                  src={floatingPreview.iconSrc}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
            </div>
          </div>
          <span className="world-preview-label">{floatingPreview.name}</span>
        </button>
      ) : null}

      {expanded ? (
        <section
          ref={detailRef}
          className="world-detail"
          data-world-id={active.id}
          aria-label={`Selected world: ${active.name}`}
          style={
            {
              '--world-color': `#${active.color.toString(16).padStart(6, '0')}`,
            } as CSSProperties
          }
        >
          <div className="world-detail-wing">
            <span className="world-kind">{active.kind}</span>
            <h2>{active.name}</h2>
            <p>{active.description}</p>
            <span className="world-address">
              {new URL(active.url).hostname.replace(/^www\./, '')}
            </span>

            <a
              href={active.url}
              className="world-play"
              aria-label={`Launch ${active.name}`}
            >
              <span className="play-triangle" aria-hidden="true">
                ▶
              </span>
              <span>
                <small>open world</small>
                <strong>Launch</strong>
              </span>
            </a>
          </div>

          <div className="world-orbit" aria-hidden="true">
            <div className="world-face">
              <span>{active.glyph}</span>
              {active.iconSrc ? (
                // Remote favicons are tiny, optional UI texture—not LCP content.
                // oxlint-disable-next-line next/no-img-element
                <img
                  key={active.iconSrc}
                  src={active.iconSrc}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className="world-close"
            aria-label="Close world details"
            onClick={collapseDestination}
          >
            ×
          </button>
        </section>
      ) : null}

      <div className="spore-dock" aria-label="Galaxy controls">
        <button
          type="button"
          aria-label="Spin the galaxy faster"
          className="dock-orb"
          onClick={() => spinGalaxyRef.current()}
        >
          <img
            ref={dockGalaxyIconRef}
            aria-hidden="true"
            data-icon="spore-main-menu-spiral"
            src="/spiral-galaxy.svg"
            alt=""
            width={44}
            height={44}
          />
        </button>
        <div
          className="dock-console"
          data-mode={
            dockTransmission === 1
              ? 'quote'
              : dockTransmission === 2
                ? 'source'
                : dockTransmission === 3
                  ? 'contact'
                  : 'credit'
          }
        >
          <span className="dock-mode-lights" aria-hidden="true">
            {[0, 1, 2, 3].map((mode) => (
              <i
                key={mode}
                className={dockTransmission === mode ? 'is-active' : undefined}
              />
            ))}
          </span>
          {dockTransmission === 3 ? (
            <a
              id="dock-transmission"
              href="mailto:mail@alirezaafshan.com"
              className="dock-message"
              data-mode="contact"
              aria-label="Contact me by email"
            >
              contact me ↗
            </a>
          ) : dockTransmission === 2 ? (
            <a
              id="dock-transmission"
              href={quotationCollection.url}
              className="dock-message"
              data-mode="source"
              aria-label={`Open ${quotationCollection.label}`}
              title={quotationCollection.label}
            >
              open bartlett&apos;s quotations ↗
            </a>
          ) : (
            <output
              id="dock-transmission"
              className="dock-message"
              data-mode={dockTransmission === 1 ? 'quote' : 'credit'}
              aria-live="polite"
              title={
                dockTransmission === 1
                  ? `“${dailyQuote.text}” — ${dailyQuote.author}`
                  : '© alireza afshan · 2026'
              }
            >
              {dockTransmission === 1
                ? `“${dailyQuote.text}” — ${dailyQuote.author}`
                : '© alireza afshan · 2026'}
            </output>
          )}
          <button
            type="button"
            aria-label="Show next footer transmission"
            aria-controls="dock-transmission"
            className="dock-tuner"
            onClick={() => setDockTransmission((current) => (current + 1) % 4)}
          >
            <svg
              aria-hidden="true"
              data-icon="cycle-transmission"
              viewBox="0 0 24 24"
            >
              <path
                className="tuner-cycle-orbit"
                d="M18.4 8a7.2 7.2 0 1 0 .7 7.1"
              />
              <path className="tuner-cycle-arrow" d="M14.8 7.8h3.9V3.9" />
              <circle className="tuner-cycle-signal" cx="12" cy="12" r="1.65" />
            </svg>
          </button>
        </div>
      </div>

      <nav className="sr-only" aria-label="Website worlds">
        {destinations.map((destination, index) => (
          <button
            type="button"
            key={destination.url}
            data-world-id={destination.id}
            onFocus={() => previewDestination(index)}
            onClick={() => expandDestination(index)}
          >
            {destination.name}: {destination.description}
          </button>
        ))}
      </nav>

      <p className="sr-only" aria-live="polite">
        {expanded
          ? `Selected world: ${active.name}. ${active.description}`
          : `Previewing world: ${preview.name}.`}
      </p>

      <noscript>
        <section className="noscript-catalog" aria-label="Website worlds">
          <h1>Alireza&apos;s Galaxy</h1>
          <p>A small constellation of websites and experiments.</p>
          <ul>
            {destinations.map((destination) => (
              <li key={destination.id}>
                <a href={destination.url}>{destination.name}</a>
                <span>{destination.description}</span>
              </li>
            ))}
          </ul>
          <h2>Web ring</h2>
          <ul>
            {webring.map((neighbor) => (
              <li key={neighbor.id}>
                <a href={neighbor.url}>{neighbor.name}</a>
                <span>{neighbor.description}</span>
              </li>
            ))}
          </ul>
        </section>
      </noscript>
    </main>
  );
}
