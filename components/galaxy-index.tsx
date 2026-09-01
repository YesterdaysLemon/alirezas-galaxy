'use client';

import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Destination = {
  name: string;
  label: string;
  url: string;
  description: string;
  color: number;
  radius: number;
  angle: number;
  scale: number;
};

const destinations: Destination[] = [
  {
    name: 'Alireza Afshan',
    label: 'Portfolio',
    url: 'https://alirezaafshan.com',
    description:
      'Selected work, experiments, and the person at the center of it all.',
    color: 0xc8ff4a,
    radius: 3.5,
    angle: 0.38,
    scale: 1.18,
  },
  {
    name: 'Learn2Design',
    label: 'Research',
    url: 'https://www.learn2design2026.com/',
    description: 'Open, reproducible optimizer research for Learn2Design 2026.',
    color: 0xffa64d,
    radius: 6.05,
    angle: 2.72,
    scale: 0.86,
  },
  {
    name: 'Conspiracy',
    label: 'Experiment',
    url: 'https://yesterdayslemon.github.io/conspiracy/',
    description: 'A tactile noir evidence board for humans and WebMCP agents.',
    color: 0xe4dcff,
    radius: 7.8,
    angle: 4.62,
    scale: 0.78,
  },
  {
    name: 'Codex Continuity',
    label: 'Developer tool',
    url: 'https://codex-continuity.alirezaafshan4.chatgpt.site',
    description:
      'Keep long-running Codex work alive through desktop app updates.',
    color: 0x72c7ff,
    radius: 9.55,
    angle: 5.68,
    scale: 0.72,
  },
];

const portraitUrl = 'https://avatars.githubusercontent.com/u/129180138?v=4';

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

function createGalaxyGeometry(count: number) {
  const random = seededRandom();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const core = new THREE.Color(0xfff0c2);
  const edge = new THREE.Color(0x83a6ff);
  const color = new THREE.Color();
  const arms = 5;

  for (let index = 0; index < count; index += 1) {
    const radius = Math.pow(random(), 0.62) * 12;
    const arm = index % arms;
    const branchAngle = (arm / arms) * Math.PI * 2;
    const spinAngle = radius * 0.61;
    const spread = Math.pow(radius / 12, 1.15) * 1.35 + 0.08;
    const jitter = (random() - 0.5) * spread;
    const angle = branchAngle + spinAngle + jitter;
    const offset = index * 3;

    positions[offset] = Math.cos(angle) * radius + (random() - 0.5) * spread;
    positions[offset + 1] = (random() - 0.5) * (0.18 + radius * 0.045);
    positions[offset + 2] =
      Math.sin(angle) * radius + (random() - 0.5) * spread;

    color.copy(core).lerp(edge, Math.min(1, radius / 12));
    const brightness = 0.66 + random() * 0.42;
    colors[offset] = color.r * brightness;
    colors[offset + 1] = color.g * brightness;
    colors[offset + 2] = color.b * brightness;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function createBackdropGeometry(count: number) {
  const random = seededRandom(5118);
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const radius = 22 + random() * 25;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[offset] = radius * Math.sin(phi) * Math.cos(theta);
    positions[offset + 1] = radius * Math.cos(phi);
    positions[offset + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 246, 206, 1)');
  gradient.addColorStop(0.16, 'rgba(255, 208, 124, .72)');
  gradient.addColorStop(0.42, 'rgba(143, 126, 255, .2)');
  gradient.addColorStop(1, 'rgba(44, 37, 90, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function GalaxyIndex() {
  const stageRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const active = destinations[activeIndex];

  const selectDestination = (index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
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
    const starCount = isCompact || cores <= 4 ? 6200 : 11800;
    const maxPixelRatio = isCompact || cores <= 4 ? 1.15 : 1.5;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);
    scene.fog = new THREE.FogExp2(0x05060a, 0.018);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    let cameraDistance = isCompact ? 25 : 22;
    camera.position.set(0, cameraDistance * 0.46, cameraDistance * 0.88);
    camera.lookAt(0, 0, 0);

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, maxPixelRatio),
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.setAttribute('data-galaxy-canvas', '');
    stage.appendChild(renderer.domElement);

    const backdropGeometry = createBackdropGeometry(isCompact ? 420 : 760);
    const backdropMaterial = new THREE.PointsMaterial({
      color: 0x8992b5,
      size: 0.045,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const backdrop = new THREE.Points(backdropGeometry, backdropMaterial);
    scene.add(backdrop);

    const galaxy = new THREE.Group();
    galaxy.rotation.x = -0.34;
    scene.add(galaxy);

    const galaxyGeometry = createGalaxyGeometry(starCount);
    const galaxyMaterial = new THREE.PointsMaterial({
      size: isCompact ? 0.045 : 0.038,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const galaxyPoints = new THREE.Points(galaxyGeometry, galaxyMaterial);
    galaxy.add(galaxyPoints);

    const glowTexture = createGlowTexture();
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.set(7.5, 7.5, 1);
    glow.position.y = 0.08;
    galaxy.add(glow);

    scene.add(new THREE.HemisphereLight(0xdce8ff, 0x20160e, 1.7));
    const keyLight = new THREE.PointLight(0xffe0a6, 18, 22, 1.7);
    keyLight.position.set(0, 4, 0);
    galaxy.add(keyLight);

    const planetGeometry = new THREE.SphereGeometry(0.52, 20, 14);
    const planets: THREE.Mesh[] = destinations.map((destination, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: destination.color,
        roughness: 0.76,
        metalness: 0.06,
        emissive: destination.color,
        emissiveIntensity: index === 0 ? 0.15 : 0.07,
      });
      const planet = new THREE.Mesh(planetGeometry, material);
      planet.position.set(
        Math.cos(destination.angle) * destination.radius,
        0.34 + index * 0.08,
        Math.sin(destination.angle) * destination.radius,
      );
      planet.scale.setScalar(destination.scale);
      planet.userData.destinationIndex = index;
      galaxy.add(planet);
      return planet;
    });

    const selectionRingGeometry = new THREE.TorusGeometry(0.78, 0.018, 8, 72);
    const selectionRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xf6f4ed,
      transparent: true,
      opacity: 0.7,
    });
    const selectionRing = new THREE.Mesh(
      selectionRingGeometry,
      selectionRingMaterial,
    );
    selectionRing.rotation.x = Math.PI / 2;
    galaxy.add(selectionRing);

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
        (sprite.material as THREE.SpriteMaterial).dispose();
      });
      portraitSprites.length = 0;

      const random = seededRandom(Date.now());
      for (let index = 0; index < 9; index += 1) {
        const material = new THREE.SpriteMaterial({
          map: portraitTexture,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        const angle = (index / 9) * Math.PI * 2 + random() * 0.45;
        const speed = 0.055 + random() * 0.065;
        sprite.position.set(0, 0.7, 0);
        sprite.scale.setScalar(0.01);
        portraitGroup.add(sprite);
        portraitSprites.push({
          sprite,
          velocity: new THREE.Vector3(
            Math.cos(angle) * speed,
            0.01 + random() * 0.035,
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
    let hoveredIndex = 0;
    let isDragging = false;
    let pointerId = -1;
    let lastX = 0;
    let lastY = 0;
    let dragDistance = 0;
    let angularVelocity = 0;
    let tiltVelocity = 0;
    let fastSpinFrames = 0;
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
      angularVelocity = THREE.MathUtils.clamp(deltaX * 0.007, -0.26, 0.26);
      tiltVelocity = THREE.MathUtils.clamp(deltaY * 0.0025, -0.035, 0.035);
      galaxy.rotation.y += angularVelocity;
      galaxy.rotation.x = THREE.MathUtils.clamp(
        galaxy.rotation.x + tiltVelocity,
        -0.72,
        0.14,
      );
    };

    const endPointer = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      isDragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      if (dragDistance < 8 && hoveredIndex >= 0) {
        window.location.assign(destinations[hoveredIndex].url);
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
        cameraDistance + event.deltaY * 0.012,
        14,
        30,
      );
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', endPointer);
    renderer.domElement.addEventListener('pointercancel', endPointer);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

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
        galaxy.rotation.y += angularVelocity * delta;
        angularVelocity *= Math.pow(0.948, delta);
        tiltVelocity *= Math.pow(0.9, delta);
        if (!reduceMotion && Math.abs(angularVelocity) < 0.0012) {
          galaxy.rotation.y += 0.00045 * delta;
        }
      }

      if (Math.abs(angularVelocity) > 0.115) {
        fastSpinFrames += 1;
        if (fastSpinFrames > 9) {
          burstPortraits();
          fastSpinFrames = 0;
        }
      } else {
        fastSpinFrames = Math.max(0, fastSpinFrames - 1);
      }

      burstCooldown = Math.max(0, burstCooldown - elapsedMs / 1000);
      camera.position.x += (0 - camera.position.x) * 0.06;
      camera.position.y += (cameraDistance * 0.46 - camera.position.y) * 0.06;
      camera.position.z += (cameraDistance * 0.88 - camera.position.z) * 0.06;
      camera.lookAt(0, 0, 0);
      backdrop.rotation.y -= 0.00008 * delta;
      selectionRing.rotation.z += 0.003 * delta;

      if (!isDragging && frame % 2 === 0) {
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(planets, false)[0];
        if (hit) {
          const nextIndex = hit.object.userData.destinationIndex as number;
          hoveredIndex = nextIndex;
          renderer.domElement.style.cursor = 'pointer';
          if (activeIndexRef.current !== nextIndex) {
            activeIndexRef.current = nextIndex;
            setActiveIndex(nextIndex);
          }
        } else {
          hoveredIndex = -1;
          renderer.domElement.style.cursor = 'grab';
        }
      } else if (isDragging) {
        renderer.domElement.style.cursor = 'grabbing';
      }

      const selectedIndex = activeIndexRef.current;
      const selectedPlanet = planets[selectedIndex];
      selectionRing.position.copy(selectedPlanet.position);
      selectionRing.scale.setScalar(destinations[selectedIndex].scale);
      selectionRingMaterial.color.setHex(destinations[selectedIndex].color);

      planets.forEach((planet, index) => {
        const destination = destinations[index];
        const pulse = reduceMotion
          ? 1
          : 1 + Math.sin(time * 0.0017 + index) * 0.018;
        const target =
          destination.scale * (index === selectedIndex ? 1.16 : 1) * pulse;
        planet.scale.x += (target - planet.scale.x) * 0.1;
        planet.scale.y += (target - planet.scale.y) * 0.1;
        planet.scale.z += (target - planet.scale.z) * 0.1;
        planet.rotation.y += (0.002 + index * 0.0004) * delta;
      });

      for (let index = portraitSprites.length - 1; index >= 0; index -= 1) {
        const portrait = portraitSprites[index];
        portrait.life -= 0.0085 * delta;
        portrait.sprite.position.addScaledVector(portrait.velocity, delta);
        portrait.sprite.material.rotation += portrait.spin * delta;
        const envelope = Math.sin(Math.max(0, portrait.life) * Math.PI);
        const scale = Math.max(0.01, envelope * 0.92);
        portrait.sprite.scale.set(scale, scale, 1);
        (portrait.sprite.material as THREE.SpriteMaterial).opacity = Math.min(
          1,
          portrait.life * 2,
        );
        if (portrait.life <= 0) {
          portraitGroup.remove(portrait.sprite);
          (portrait.sprite.material as THREE.SpriteMaterial).dispose();
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
      portraitSprites.forEach(({ sprite }) => {
        (sprite.material as THREE.SpriteMaterial).dispose();
      });
      portraitTexture?.dispose();
      glowTexture?.dispose();
      glowMaterial.dispose();
      galaxyGeometry.dispose();
      galaxyMaterial.dispose();
      backdropGeometry.dispose();
      backdropMaterial.dispose();
      selectionRingGeometry.dispose();
      selectionRingMaterial.dispose();
      planetGeometry.dispose();
      planets.forEach((planet) =>
        (planet.material as THREE.Material).dispose(),
      );
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <main className="relative h-[100svh] min-h-[560px] overflow-hidden bg-background text-foreground">
      <div ref={stageRef} className="absolute inset-0" />
      <div
        aria-hidden="true"
        className="galaxy-vignette pointer-events-none absolute inset-0"
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-5 sm:p-8">
        <div>
          <a
            href="https://alirezaafshan.com"
            className="pointer-events-auto inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/88 outline-none transition-colors hover:text-accent focus-visible:text-accent"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_14px_#c8ff4a]" />
            Alireza / orbital index
          </a>
          <p className="mt-2 max-w-[18rem] text-xs leading-relaxed text-white/40">
            Four small worlds in one quiet corner of the web.
          </p>
        </div>
        <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/38 sm:flex">
          <span
            className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-accent' : 'bg-white/30'}`}
          />
          {ready ? `${destinations.length} signals online` : 'mapping orbit'}
        </div>
      </header>

      <section className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-5 p-5 sm:p-8">
        <div className="hidden max-w-[18rem] pb-1 md:block">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/38">
            Drag to orbit · wheel to zoom
          </p>
          <p className="mt-2 text-xs leading-relaxed text-white/32">
            The center has a sense of humor. Try giving the galaxy a proper
            spin.
          </p>
        </div>

        <div className="glass-panel pointer-events-auto ml-auto w-full max-w-[25rem] rounded-2xl border border-white/10 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/44">
                {active.label} · 0{activeIndex + 1}
              </p>
              <h1 className="mt-2 text-[clamp(1.35rem,3vw,2rem)] font-medium tracking-[-0.035em] text-white">
                {active.name}
              </h1>
            </div>
            <span
              aria-hidden="true"
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_18px_currentColor]"
              style={{
                color: `#${active.color.toString(16).padStart(6, '0')}`,
                background: 'currentColor',
              }}
            />
          </div>

          <p className="mt-2 min-h-[2.6rem] max-w-[21rem] text-sm leading-relaxed text-white/54">
            {active.description}
          </p>

          <div className="mt-5 flex items-end justify-between gap-5 border-t border-white/10 pt-4">
            <nav aria-label="Destinations" className="flex flex-col gap-1">
              {destinations.map((destination, index) => (
                <a
                  key={destination.url}
                  href={destination.url}
                  onMouseEnter={() => selectDestination(index)}
                  onFocus={() => selectDestination(index)}
                  data-active={index === activeIndex}
                  className="orbit-link relative py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/36 outline-none transition-colors hover:text-white/80 focus-visible:text-white data-[active=true]:text-white"
                >
                  {destination.label}
                </a>
              ))}
            </nav>

            <a
              href={active.url}
              className="group inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-accent-foreground outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-white/80 active:scale-[0.98]"
            >
              Enter orbit
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </section>

      <p className="sr-only" aria-live="polite">
        Selected destination: {active.name}. {active.description}
      </p>
    </main>
  );
}
