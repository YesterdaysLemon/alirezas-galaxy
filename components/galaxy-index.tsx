'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
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

function createMarkerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.translate(128, 128);
  const aura = context.createRadialGradient(0, 0, 2, 0, 0, 104);
  aura.addColorStop(0, 'rgba(255,255,255,1)');
  aura.addColorStop(0.035, 'rgba(255,243,177,.98)');
  aura.addColorStop(0.08, 'rgba(255,235,196,.35)');
  aura.addColorStop(0.18, 'rgba(255,210,131,.06)');
  aura.addColorStop(0.31, 'rgba(255,255,255,0)');
  aura.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = aura;
  context.fillRect(-128, -128, 256, 256);

  context.strokeStyle = 'rgba(255, 244, 194, .94)';
  context.lineWidth = 4;
  [44, 67, 91].forEach((radius, index) => {
    context.globalAlpha = 1 - index * 0.24;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.stroke();
  });
  context.globalAlpha = 0.9;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-43, 0);
  context.lineTo(43, 0);
  context.moveTo(0, -43);
  context.lineTo(0, 43);
  context.stroke();
  context.globalAlpha = 1;

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
  const activeIndexRef = useRef(0);
  const ambientMotionRef = useRef(true);
  const resetGalaxyRef = useRef<() => void>(() => undefined);
  const focusRotationRef = useRef<number | null>(
    destinations[0].angle - Math.PI / 2,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [ambientMotion, setAmbientMotion] = useState(true);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const active = destinations[activeIndex];

  const selectDestination = (index: number) => {
    activeIndexRef.current = index;
    focusRotationRef.current = destinations[index].angle - Math.PI / 2;
    setActiveIndex(index);
  };

  const toggleAmbientMotion = () => {
    setAmbientMotion((current) => {
      ambientMotionRef.current = !current;
      return !current;
    });
  };

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
      queueMicrotask(() => setReady(true));
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
    const defaultCameraDistance = isCompact ? 25.5 : 20.5;
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
    scene.add(backdrop);

    const galaxy = new THREE.Group();
    galaxy.rotation.x = -0.08;
    galaxy.rotation.y = 0.16;
    galaxy.position.y = 1.35;
    galaxy.scale.setScalar(1.08);
    scene.add(galaxy);

    const galaxyGeometry = createGalaxyGeometry(starCount);
    const galaxyMaterial = createPointsMaterial(pixelRatio);
    const galaxyPoints = new THREE.Points(galaxyGeometry, galaxyMaterial);
    galaxy.add(galaxyPoints);

    // A second pass over the same compact buffer turns the points into the
    // broad, smoky ribbons that made the original menu read from across a room.
    const galaxyMistMaterial = createPointsMaterial(pixelRatio, 0.32, 2.45);
    galaxyMistMaterial.depthTest = false;
    const galaxyMist = new THREE.Points(galaxyGeometry, galaxyMistMaterial);
    galaxyMist.scale.set(1.012, 1, 1.012);
    galaxyMist.rotation.y = 0.018;
    galaxy.add(galaxyMist);

    const glowTexture = createGlowTexture();
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
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
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    );
    softGlow.scale.set(25, 12.4, 1);
    softGlow.position.y = -0.05;
    galaxy.add(softGlow);

    scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x190f36, 1.35));
    const keyLight = new THREE.PointLight(0xffe7ba, 18, 24, 1.4);
    keyLight.position.set(0, 5, 0);
    galaxy.add(keyLight);

    const markerTexture = createMarkerTexture();
    const planetGeometry = new THREE.SphereGeometry(0.25, 18, 12);
    const nodes = destinations.map((destination, index) => {
      const position = new THREE.Vector3(
        Math.cos(destination.angle) * destination.radius,
        0.38 + index * 0.018,
        Math.sin(destination.angle) * destination.radius,
      );
      const planetMaterial = new THREE.MeshStandardMaterial({
        color: destination.color,
        emissive: destination.color,
        emissiveIntensity: index === 0 ? 0.38 : 0.2,
        roughness: 0.82,
        metalness: 0.05,
      });
      const planet = new THREE.Mesh(planetGeometry, planetMaterial);
      planet.position.copy(position);
      planet.scale.setScalar(index === 0 ? 0.7 : 0.38);
      planet.userData.destinationIndex = index;
      galaxy.add(planet);

      const markerMaterial = new THREE.SpriteMaterial({
        map: markerTexture,
        color: destination.color,
        transparent: true,
        opacity: index === 0 ? 1 : 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });
      const marker = new THREE.Sprite(markerMaterial);
      marker.position.copy(position);
      marker.scale.setScalar(destination.size * (index === 0 ? 0.48 : 0.35));
      marker.userData.destinationIndex = index;
      marker.renderOrder = 8;
      galaxy.add(marker);

      return { planet, marker, position };
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
        activeIndexRef.current = hoveredIndex;
        focusRotationRef.current =
          destinations[hoveredIndex].angle - Math.PI / 2;
        setActiveIndex(hoveredIndex);
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
      cameraDistance = THREE.MathUtils.clamp(
        cameraDistance + event.deltaY * 0.01,
        18,
        31,
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
      activeIndexRef.current = 0;
      focusRotationRef.current = destinations[0].angle - Math.PI / 2;
      setActiveIndex(0);
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
          }
        } else {
          const appliedRotation = angularVelocity * delta;
          galaxy.rotation.y += appliedRotation;
          fastSpinTravel += Math.abs(appliedRotation);
          angularVelocity *= Math.pow(0.968, delta);
          tiltVelocity *= Math.pow(0.93, delta);
        }
      }

      if (fastSpinTravel >= Math.PI * 8) {
        burstPortraits();
        fastSpinTravel = 0;
      }

      burstCooldown = Math.max(0, burstCooldown - elapsedMs / 1000);
      camera.position.y += (cameraDistance * 0.37 - camera.position.y) * 0.055;
      camera.position.z += (cameraDistance * 0.93 - camera.position.z) * 0.055;
      camera.lookAt(0.7, 0, 0);
      if (ambientMotionRef.current && !reduceMotion) {
        galaxyPoints.rotation.y += 0.00034 * delta;
        galaxyMist.rotation.y += 0.00029 * delta;
        backdrop.rotation.y -= 0.00006 * delta;
      }

      if (!isDragging && frame % 2 === 0) {
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(
          nodes.map(({ marker }) => marker),
          false,
        )[0];
        if (hit) {
          const nextIndex = hit.object.userData.destinationIndex as number;
          hoveredIndex = nextIndex;
          renderer.domElement.style.cursor = 'pointer';
        } else {
          hoveredIndex = -1;
          renderer.domElement.style.cursor = 'grab';
        }
      } else if (isDragging) {
        renderer.domElement.style.cursor = 'grabbing';
      }

      const selectedIndex = activeIndexRef.current;
      nodes.forEach(({ planet, marker }, index) => {
        const destination = destinations[index];
        const isSelected = index === selectedIndex;
        const isHovered = index === hoveredIndex;
        const pulse =
          reduceMotion || !isSelected ? 1 : 1 + Math.sin(time * 0.0035) * 0.07;
        const markerTarget =
          destination.size *
          (isSelected ? 0.48 : isHovered ? 0.43 : 0.35) *
          pulse;
        const planetTarget = isSelected ? 0.7 : isHovered ? 0.5 : 0.38;
        marker.scale.x += (markerTarget - marker.scale.x) * 0.11;
        marker.scale.y += (markerTarget - marker.scale.y) * 0.11;
        marker.material.opacity +=
          ((isSelected ? 1 : isHovered ? 0.88 : 0.68) -
            marker.material.opacity) *
          0.11;
        planet.scale.x += (planetTarget - planet.scale.x) * 0.11;
        planet.scale.y += (planetTarget - planet.scale.y) * 0.11;
        planet.scale.z += (planetTarget - planet.scale.z) * 0.11;
        planet.rotation.y += (0.0022 + index * 0.00025) * delta;
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
          ? bounds.width / 2
          : THREE.MathUtils.clamp(screenX, 310, bounds.width - 310);
        const panelY = isCompact
          ? bounds.height - 160
          : THREE.MathUtils.clamp(screenY, 300, bounds.height - 165);
        detail.style.transform = `translate3d(${panelX}px, ${panelY}px, 0) translate(-50%, -50%)`;
        detail.style.opacity = labelPosition.z > 1 ? '0' : '1';
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

    queueMicrotask(() => {
      if (!disposed) setReady(true);
    });
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
      glowMaterial.dispose();
      softGlow.material.dispose();
      galaxyGeometry.dispose();
      galaxyMaterial.dispose();
      galaxyMistMaterial.dispose();
      backdropGeometry.dispose();
      backdropMaterial.dispose();
      planetGeometry.dispose();
      nodes.forEach(({ planet, marker }) => {
        planet.material.dispose();
        marker.material.dispose();
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
          <a className="spore-menu-item is-active" href="#galaxy">
            <span aria-hidden="true">▶</span>
            Galaxy
          </a>
          <a
            className="spore-menu-item"
            href="https://portfolio.alirezaafshan.com"
          >
            <span aria-hidden="true">♙</span>
            Portfolio
          </a>
          <a
            className="spore-menu-item"
            href="https://github.com/YesterdaysLemon"
          >
            <span aria-hidden="true">⚙</span>
            Workshop
          </a>
          <a className="spore-menu-item" href="mailto:mail@alirezaafshan.com">
            <span aria-hidden="true">✉</span>
            Signal
          </a>
        </nav>
      </header>

      <p className="spore-invitation">
        Choose a world, then launch it!
        <span>Drag the galaxy to look around. Spin it if you must.</span>
      </p>

      <section
        ref={detailRef}
        className="world-detail"
        aria-label={`Selected world: ${active.name}`}
        style={
          {
            '--world-color': `#${active.color.toString(16).padStart(6, '0')}`,
          } as CSSProperties
        }
      >
        <div className="world-copy">
          <span className="world-kind">{active.kind}</span>
          <h2>{active.name}</h2>
          <p>{active.description}</p>
        </div>

        <div className="world-stage">
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
      </section>

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
          aria-label="Restore the homeworld view"
          className="dock-orb"
          onClick={() => resetGalaxyRef.current()}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M19 8a8 8 0 1 0 1 6" />
            <path d="M16 4h4v4" />
            <circle cx="12" cy="12" r="2.2" />
          </svg>
        </button>
        <div className="dock-signal-group">
          <button
            type="button"
            aria-label="Open galaxy settings"
            aria-controls="galaxy-settings"
            aria-expanded={settingsOpen}
            className="dock-grid"
            onClick={() => setSettingsOpen((current) => !current)}
          >
            ⚙
          </button>
          <a href="mailto:mail@alirezaafshan.com" className="dock-pill">
            send a signal
          </a>
        </div>
      </div>

      <div className="spore-status" aria-hidden="true">
        <span className={ready ? 'is-online' : ''} />
        {ready ? `${destinations.length} worlds mapped` : 'mapping galaxy'}
      </div>

      <nav className="sr-only" aria-label="Website worlds">
        {destinations.map((destination, index) => (
          <button
            type="button"
            key={destination.url}
            onFocus={() => selectDestination(index)}
            onClick={() => selectDestination(index)}
          >
            {destination.name}: {destination.description}
          </button>
        ))}
      </nav>

      <p className="sr-only" aria-live="polite">
        Selected world: {active.name}. {active.description}
      </p>
    </main>
  );
}
