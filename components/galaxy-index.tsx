'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import { getQuoteOfTheDay, quotationCollection } from '@/data/transmissions';
import { destinations } from '@/data/worlds';

const portraitUrl = 'https://avatars.githubusercontent.com/u/129180138?v=4';

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

export function GalaxyIndex() {
  const stageRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLButtonElement>(null);
  const activeIndexRef = useRef(0);
  const previewIndexRef = useRef(0);
  const expandedRef = useRef(false);
  const cameraModeRef = useRef<'default' | 'expanded' | 'manual'>('default');
  const ambientMotionRef = useRef(true);
  const coreExposureRef = useRef(0.92);
  const resetGalaxyRef = useRef<() => void>(() => undefined);
  const focusRotationRef = useRef<number | null>(
    destinations[0].angle - Math.PI / 2,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [ambientMotion, setAmbientMotion] = useState(true);
  const [coreExposure, setCoreExposure] = useState(0.92);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dockTransmission, setDockTransmission] = useState(0);
  const [menuHighlight, setMenuHighlight] = useState(0);
  const active = destinations[activeIndex];
  const preview = destinations[previewIndex];
  const dailyQuote = getQuoteOfTheDay();

  const previewDestination = (index: number) => {
    if (expandedRef.current) return;
    previewIndexRef.current = index;
    setPreviewIndex(index);
  };

  const expandDestination = (index: number) => {
    activeIndexRef.current = index;
    previewIndexRef.current = index;
    expandedRef.current = true;
    cameraModeRef.current = 'expanded';
    focusRotationRef.current = destinations[index].angle - Math.PI / 2;
    setActiveIndex(index);
    setPreviewIndex(index);
    setExpanded(true);
  };

  const collapseDestination = () => {
    expandedRef.current = false;
    cameraModeRef.current = 'default';
    setExpanded(false);
  };

  const toggleAmbientMotion = () => {
    setAmbientMotion((current) => {
      ambientMotionRef.current = !current;
      return !current;
    });
  };

  const updateCoreExposure = (value: number) => {
    const nextValue = THREE.MathUtils.clamp(value, 0.55, 1);
    coreExposureRef.current = nextValue;
    setCoreExposure(nextValue);
    try {
      window.localStorage.setItem('afshan-core-exposure-v2', String(nextValue));
    } catch {
      // The visual control still works when storage is unavailable.
    }
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const storedExposure = Number(
          window.localStorage.getItem('afshan-core-exposure-v2'),
        );
        if (storedExposure >= 0.55 && storedExposure <= 1) {
          coreExposureRef.current = storedExposure;
          setCoreExposure(storedExposure);
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
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const cores = navigator.hardwareConcurrency ?? 4;
    const starCount = isCompact || cores <= 4 ? 8800 : 17600;
    const backdropCount = isCompact ? 3000 : 7200;
    const maxPixelRatio = isCompact || cores <= 4 ? 1.1 : 1.45;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020308);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const cameraLookTarget = new THREE.Vector3(0.7, 0, 0);
    const defaultCameraDistance = isCompact ? 25.5 : 20.5;
    const expandedCameraDistance = isCompact ? 21.8 : 17.25;
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
    const hitGeometry = new THREE.SphereGeometry(0.72, 8, 6);
    const hitMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthTest: false,
      depthWrite: false,
    });
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

      const hitArea = new THREE.Mesh(hitGeometry, hitMaterial);
      hitArea.position.copy(position);
      hitArea.userData.destinationIndex = index;
      galaxy.add(hitArea);

      return { marker, signalWaves, hitArea, position };
    });

    const portraitGroup = new THREE.Group();
    galaxy.add(portraitGroup);
    const portraitSprites: Array<{
      sprite: THREE.Sprite;
      velocity: THREE.Vector3;
      spin: number;
      life: number;
    }> = [];
    let portraitTexture: THREE.Texture | null = null;
    let pendingBurst = false;
    let burstCooldown = 0;

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    textureLoader.load(
      portraitUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        portraitTexture = texture;
        if (pendingBurst) {
          pendingBurst = false;
          burstPortraits();
        }
      },
      undefined,
      () => {
        pendingBurst = false;
      },
    );

    function burstPortraits() {
      if (burstCooldown > 0) return;
      if (!portraitTexture) {
        pendingBurst = true;
        return;
      }

      portraitSprites.forEach(({ sprite }) => {
        portraitGroup.remove(sprite);
        sprite.material.dispose();
      });
      portraitSprites.length = 0;
      const random = seededRandom(Date.now());

      for (let index = 0; index < 10; index += 1) {
        const material = new THREE.SpriteMaterial({
          map: portraitTexture,
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

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(4, 4);
    const labelPosition = new THREE.Vector3();
    const previewPosition = new THREE.Vector3();
    const cameraFollowPosition = new THREE.Vector3();
    let hoveredIndex = -1;
    let isDragging = false;
    let pointerId = -1;
    let lastX = 0;
    let lastY = 0;
    let dragDistance = 0;
    let angularVelocity = 0;
    let tiltVelocity = 0;
    let fastSpinTravel = 0;
    let frame = 0;
    let animationFrame = 0;
    let isVisible = true;
    let disposed = false;
    let previousTime = 0;

    const updatePointer = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    };

    const onPointerDown = (event: PointerEvent) => {
      isDragging = true;
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
      isDragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      if (dragDistance < 8 && hoveredIndex >= 0) {
        angularVelocity = 0;
        expandDestination(hoveredIndex);
      } else if (dragDistance < 8 && hoveredIndex < 0 && expandedRef.current) {
        collapseDestination();
      }
      pointerId = -1;
    };

    const onPointerLeave = () => {
      if (!isDragging) {
        pointer.set(4, 4);
        renderer.domElement.style.cursor = 'grab';
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
      angularVelocity = 0;
      tiltVelocity = 0;
      fastSpinTravel = 0;
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
          if (
            ambientMotionRef.current &&
            !reduceMotion &&
            Math.abs(angularVelocity) < 0.0012
          ) {
            galaxy.rotation.y += 0.00018 * delta;
          }
        }
      }

      if (fastSpinTravel >= Math.PI * 8) {
        burstPortraits();
        fastSpinTravel = 0;
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
      if (ambientMotionRef.current && !reduceMotion) {
        backdrop.rotation.y -= 0.00006 * delta;
        distantGalaxies.forEach((points, index) => {
          const rotationSpeed =
            index === 0 ? 0.00022 : index % 2 === 0 ? 0.000035 : -0.000028;
          points.rotation.z += rotationSpeed * delta;
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

      if (!isDragging && frame % 2 === 0) {
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(
          nodes.map(({ hitArea }) => hitArea),
          false,
        )[0];
        if (hit) {
          const nextIndex = hit.object.userData.destinationIndex as number;
          if (
            nextIndex !== hoveredIndex &&
            !expandedRef.current &&
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
        }
      } else if (isDragging) {
        renderer.domElement.style.cursor = 'grabbing';
      }

      nodes.forEach(({ marker, signalWaves }, index) => {
        const destination = destinations[index];
        const isSelected = expandedRef.current && index === selectedIndex;
        const isPreviewed =
          !expandedRef.current && index === previewIndexRef.current;
        const isHovered = index === hoveredIndex;
        const shimmer = reduceMotion
          ? 1
          : 0.96 + Math.sin(time * 0.0042 + index * 1.71) * 0.04;
        const pulse =
          reduceMotion || (!isSelected && !isPreviewed)
            ? shimmer
            : 1 + Math.sin(time * 0.0035) * 0.045;
        const markerTarget =
          destination.size *
          (isSelected ? 0.82 : isHovered || isPreviewed ? 0.56 : 0.51) *
          pulse;
        marker.scale.x += (markerTarget - marker.scale.x) * 0.11;
        marker.scale.y += (markerTarget - marker.scale.y) * 0.11;
        marker.material.opacity +=
          ((isSelected ? 1 : isHovered || isPreviewed ? 0.92 : 0.82) -
            marker.material.opacity) *
          0.11;
        marker.material.rotation += (0.00016 + index * 0.000025) * delta;

        signalWaves.forEach((wave, waveIndex) => {
          const progress = reduceMotion
            ? (waveIndex + 1) / 4
            : (time * 0.00022 + wave.userData.phase + index * 0.117) % 1;
          const waveScale =
            destination.size *
            (0.49 + THREE.MathUtils.smoothstep(progress, 0, 1) * 0.7);
          const envelope = Math.pow(Math.sin(progress * Math.PI), 1.3);
          const prominence =
            isSelected || isHovered || isPreviewed ? 0.22 : 0.62;
          wave.scale.setScalar(waveScale);
          wave.material.opacity = envelope * prominence;
          wave.material.rotation = -time * 0.000025 * (waveIndex + 1);
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
        const panelX = isCompact
          ? 10
          : THREE.MathUtils.clamp(screenX - 90, 220, bounds.width - 650);
        const panelY = isCompact
          ? bounds.height - 238
          : THREE.MathUtils.clamp(screenY - 94, 240, bounds.height - 205);
        detail.style.transform = `translate3d(${panelX}px, ${panelY}px, 0)`;
        detail.style.opacity = labelPosition.z > 1 ? '0' : '1';
      }

      const previewElement = previewRef.current;
      if (previewElement && !expandedRef.current) {
        const previewedIndex = previewIndexRef.current;
        previewPosition.copy(nodes[previewedIndex].position);
        galaxy.localToWorld(previewPosition);
        previewPosition.project(camera);
        const bounds = renderer.domElement.getBoundingClientRect();
        const screenX = (previewPosition.x * 0.5 + 0.5) * bounds.width;
        const screenY = (-previewPosition.y * 0.5 + 0.5) * bounds.height;
        const previewWidth = previewElement.offsetWidth || 166;
        const opensLeft =
          screenX + previewWidth - 31 > bounds.width - (isCompact ? 8 : 14);
        const anchorOffset = opensLeft ? previewWidth - 31 : 31;
        previewElement.dataset.edge = opensLeft ? 'right' : 'left';
        previewElement.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-${anchorOffset}px, -50%)`;
        previewElement.style.opacity = previewPosition.z > 1 ? '0' : '1';
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
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', endPointer);
      renderer.domElement.removeEventListener('pointercancel', endPointer);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('wheel', onWheel);
      resetGalaxyRef.current = () => undefined;
      portraitSprites.forEach(({ sprite }) => sprite.material.dispose());
      portraitTexture?.dispose();
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
      hitGeometry.dispose();
      hitMaterial.dispose();
      nodes.forEach(({ marker, signalWaves }) => {
        marker.material.dispose();
        signalWaves.forEach(({ material }) => material.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <main
      id="galaxy"
      className="spore-shell relative h-[100svh] min-h-[520px] overflow-hidden"
    >
      <div ref={stageRef} className="absolute inset-0" />
      <div aria-hidden="true" className="spore-vignette absolute inset-0" />

      <header className="spore-corner" aria-label="Main menu">
        <a
          className="sprawl-mark"
          href="#galaxy"
          aria-label="Afshan Software — return to the galaxy"
        >
          afshan
        </a>
        <nav className="spore-menu" aria-label="Primary">
          <a
            className={`spore-menu-item ${menuHighlight === 0 ? 'is-active' : ''}`}
            href="#galaxy"
            aria-current="page"
            onMouseEnter={() => setMenuHighlight(0)}
            onMouseLeave={() => setMenuHighlight(0)}
            onFocus={() => setMenuHighlight(0)}
            onBlur={() => setMenuHighlight(0)}
          >
            <span aria-hidden="true">▶</span>
            Galaxy
          </a>
          <a
            className={`spore-menu-item ${menuHighlight === 1 ? 'is-active' : ''}`}
            href="https://portfolio.alirezaafshan.com"
            onMouseEnter={() => setMenuHighlight(1)}
            onMouseLeave={() => setMenuHighlight(0)}
            onFocus={() => setMenuHighlight(1)}
            onBlur={() => setMenuHighlight(0)}
          >
            <span aria-hidden="true">♙</span>
            Portfolio
          </a>
          <a
            className={`spore-menu-item ${menuHighlight === 2 ? 'is-active' : ''}`}
            href="https://github.com/YesterdaysLemon"
            onMouseEnter={() => setMenuHighlight(2)}
            onMouseLeave={() => setMenuHighlight(0)}
            onFocus={() => setMenuHighlight(2)}
            onBlur={() => setMenuHighlight(0)}
          >
            <span aria-hidden="true">⚙</span>
            Workshop
          </a>
          <a
            className={`spore-menu-item ${menuHighlight === 3 ? 'is-active' : ''}`}
            href="mailto:mail@alirezaafshan.com"
            onMouseEnter={() => setMenuHighlight(3)}
            onMouseLeave={() => setMenuHighlight(0)}
            onFocus={() => setMenuHighlight(3)}
            onBlur={() => setMenuHighlight(0)}
          >
            <span aria-hidden="true">✉</span>
            Signal
          </a>
        </nav>
      </header>

      {!expanded ? (
        <button
          type="button"
          ref={previewRef}
          className="world-preview"
          aria-label={`Inspect ${preview.name}`}
          onClick={() => expandDestination(previewIndex)}
          style={
            {
              '--world-color': `#${preview.color.toString(16).padStart(6, '0')}`,
            } as CSSProperties
          }
        >
          <div className="world-preview-orbit">
            <div className="world-preview-face">
              <span>{preview.glyph}</span>
              {preview.iconSrc ? (
                // Remote favicons are optional interface texture.
                // oxlint-disable-next-line next/no-img-element
                <img
                  key={preview.iconSrc}
                  src={preview.iconSrc}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
            </div>
          </div>
          <span className="world-preview-label">{preview.name}</span>
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
        {settingsOpen ? (
          <dialog
            open
            className="dock-settings"
            id="galaxy-settings"
            aria-label="Galaxy settings"
          >
            <span className="dock-settings-title">galaxy settings</span>
            <button
              type="button"
              className="dock-setting-row"
              onClick={toggleAmbientMotion}
              aria-pressed={ambientMotion}
            >
              <span>galactic drift</span>
              <strong>{ambientMotion ? 'on' : 'off'}</strong>
            </button>
            <label className="dock-slider-row">
              <span>
                <span>core exposure</span>
                <output>{Math.round(coreExposure * 100)}%</output>
              </span>
              <input
                type="range"
                min="0.55"
                max="1"
                step="0.01"
                value={coreExposure}
                aria-label="Galaxy core exposure"
                onChange={(event) =>
                  updateCoreExposure(Number(event.currentTarget.value))
                }
              />
            </label>
            <button
              type="button"
              className="dock-setting-row"
              onClick={() => resetGalaxyRef.current()}
            >
              <span>restore homeworld</span>
              <strong>reset</strong>
            </button>
          </dialog>
        ) : null}

        <button
          type="button"
          aria-label={
            settingsOpen ? 'Close galaxy settings' : 'Open galaxy settings'
          }
          aria-controls="galaxy-settings"
          aria-expanded={settingsOpen}
          className="dock-orb"
          onClick={() => setSettingsOpen((current) => !current)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12.1 11.9c.6-2.3 3.9-2.8 5.3-.8 1.7 2.4.2 5.8-2.7 7-4.2 1.8-9-.9-9.8-5.3-.9-5 3-9.6 7.9-10 5.5-.4 10.2 4.2 9.4 9.7" />
            <path d="M12.1 11.9c-1.4 1.5-4 .8-4.3-1.3-.3-2 1.6-3.7 3.6-3.2 1.7.4 2.6 2.3 1.8 3.8-.7 1.4-2.7 1.8-3.9.8" />
            <circle cx="12" cy="12" r="1.25" />
          </svg>
        </button>
        <div
          className="dock-console"
          data-mode={
            dockTransmission === 1
              ? 'quote'
              : dockTransmission === 2
                ? 'source'
                : 'credit'
          }
        >
          <span className="dock-mode-lights" aria-hidden="true">
            {[0, 1, 2].map((mode) => (
              <i
                key={mode}
                className={dockTransmission === mode ? 'is-active' : undefined}
              />
            ))}
          </span>
          {dockTransmission === 2 ? (
            <a
              id="dock-transmission"
              href={quotationCollection.url}
              className="dock-message"
              data-mode="source"
              aria-label={`Open ${quotationCollection.label}`}
              title={quotationCollection.label}
            >
              open Bartlett&apos;s quotations ↗
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
                  : '© Alireza Afshan · 2026'
              }
            >
              {dockTransmission === 1
                ? `“${dailyQuote.text}” — ${dailyQuote.author}`
                : '© Alireza Afshan · 2026'}
            </output>
          )}
          <button
            type="button"
            aria-label="Show next footer transmission"
            aria-controls="dock-transmission"
            className="dock-tuner"
            onClick={() => setDockTransmission((current) => (current + 1) % 3)}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 7.7a4.3 4.3 0 1 0 0 8.6 4.3 4.3 0 0 0 0-8.6Z" />
              <path d="m9.2 4.2.5-1.7h4.6l.5 1.7 1.5.9 1.7-.4 2.3 4-1.2 1.3v1.8l1.2 1.3-2.3 4-1.7-.4-1.5.9-.5 1.7H9.7l-.5-1.7-1.5-.9-1.7.4-2.3-4 1.2-1.3V10L3.7 8.7l2.3-4 1.7.4 1.5-.9Z" />
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
        </section>
      </noscript>
    </main>
  );
}
