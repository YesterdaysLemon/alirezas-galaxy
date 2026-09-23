'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CommsPresence } from './comms-presence';
import { DockHover, DockSpin } from '@/lib/dock-spin';
import { UI_MOTION_SPEED, uiDuration } from '@/lib/ui-motion';
import { syncCommsIdentity } from '@/lib/comms-readiness';
import { followCard, type CardMotion } from '@/lib/card-motion';
import { DistantGalaxyParallax } from '@/lib/distant-galaxy-parallax';
import {
  groxApproachFrame,
  groxRetreatFrame,
  GROX_STAR_POSITION,
} from '@/lib/grox-encounter';
import * as THREE from 'three';
import { galaxies, galaxyDestinations, type GalaxyId } from '@/data/galaxies';
import {
  solarSystems,
  projectOrbits,
  getSolarSystem,
  systemHref,
  parseSystemRoute,
} from '@/data/solar-systems';
import { SolarSystemScene, type SolarPhase } from '@/lib/solar/scene';
import { SolarSystemHud } from './solar-system-hud';
import {
  createGalaxyLayer,
  disposeGalaxyLayer,
  GALAXY_TILT,
  MIST_TWIST,
} from '@/lib/galaxy/galaxy-layer';
import { PortraitBurst } from '@/lib/galaxy/portrait-burst';
import {
  detailBounds,
  previewPosition as placePreview,
  previewRoom,
} from '@/lib/galaxy/card-layout';
import { GalaxyCanopy } from './galaxy-canopy';
import { GalaxyDock } from './galaxy-dock';
import { WebringPortal } from './webring-portal';
import { WorldCatalog } from './world-catalog';
import { frameEase } from '@/lib/galaxy/math';
import {
  createBackdropGeometry,
  createDistantGalaxyGeometry,
} from '@/lib/galaxy/geometry';
import { createPointsMaterial } from '@/lib/galaxy/points-material';
import {
  createGlowTexture,
  createMarkerTexture,
  createSignalWaveTexture,
  createStarlightTexture,
} from '@/lib/galaxy/textures';

function randomIndex(itemCount: number) {
  return Math.floor(Math.random() * itemCount);
}

/** Camera distances for the resting galaxy and an open world's close-up. */
const cameraDistances = (compact: boolean) =>
  compact ? { rest: 25.5, open: 21.8 } : { rest: 20.5, open: 17.25 };

/** Leave a system for the galaxy view, and say so in the address. */
function returnToGalaxy(solar: SolarSystemScene | null) {
  solar?.exit();
  if (window.location.hash !== '#galaxy')
    window.history.pushState(null, '', '#galaxy');
}

export function GalaxyIndex({
  groxEncounter = false,
  groxLeaving = false,
  onGroxArrival,
  onGroxReturn,
}: {
  groxEncounter?: boolean;
  groxLeaving?: boolean;
  onGroxArrival?: () => void;
  onGroxReturn?: () => void;
} = {}) {
  const groxArrivalRef = useRef(onGroxArrival);
  const groxReturnRef = useRef(onGroxReturn);
  const groxLeaveRef = useRef<() => boolean>(() => false);
  const [groxReturned, setGroxReturned] = useState(false);
  useEffect(() => {
    groxArrivalRef.current = onGroxArrival;
    groxReturnRef.current = onGroxReturn;
  }, [onGroxArrival, onGroxReturn]);
  const stageRef = useRef<HTMLDivElement>(null);
  const solarRef = useRef<SolarSystemScene | null>(null);
  const enterSolarRef = useRef<
    (
      systemId: string,
      planetIndex?: number | null,
      updateHistory?: boolean,
    ) => void
  >(() => undefined);
  const [graphicsUnavailable, setGraphicsUnavailable] = useState(false);
  const [solarPhase, setSolarPhase] = useState<SolarPhase>('galaxy');
  const [solarSelected, setSolarSelected] = useState<number | null>(null);
  const [solarHovered, setSolarHovered] = useState<number | null>(null);
  const [solarSystem, setSolarSystem] = useState(solarSystems[0]);
  const [solarPaused, setSolarPaused] = useState(false);
  const solarActive = solarPhase !== 'galaxy';
  const solarNavigating = solarPhase === 'entering' || solarPhase === 'leaving';

  const leaveSolar = () => returnToGalaxy(solarRef.current);
  const detailRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLButtonElement>(null);
  const ringPortalRef = useRef<HTMLButtonElement>(null);
  const galaxyIdRef = useRef<GalaxyId>('home');
  const travelRef = useRef<
    (id: GalaxyId, inspect?: boolean, updateHistory?: boolean) => void
  >(() => undefined);
  const travellingRef = useRef(false);
  const hasTravelledRef = useRef(false);
  const [galaxyId, setGalaxyId] = useState<GalaxyId>('home');
  const [travelling, setTravelling] = useState(false);
  const activeIndexRef = useRef(0);
  const previewIndexRef = useRef(0);
  const expandedPreviewIndexRef = useRef<number | null>(null);
  const expandedRef = useRef(false);
  const cameraModeRef = useRef<'default' | 'expanded' | 'manual'>('default');
  const ambientMotionRef = useRef(true);
  const coreExposureRef = useRef(0.92);
  const resetGalaxyRef = useRef<() => void>(() => undefined);
  const spinGalaxyRef = useRef<() => void>(() => undefined);
  const hoverGalaxyRef = useRef<() => void>(() => undefined);
  const dockGalaxyIconRef = useRef<HTMLImageElement>(null);
  const focusRotationRef = useRef<number | null>(
    galaxyDestinations[0].angle - Math.PI / 2,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(true);
  const previewVisibleRef = useRef(true);
  const [expandedPreviewIndex, setExpandedPreviewIndex] = useState<
    number | null
  >(null);
  const [expanded, setExpanded] = useState(false);
  const currentWorlds = galaxies[galaxyId].worlds;
  const active = currentWorlds[activeIndex] ?? currentWorlds[0];
  const preview = currentWorlds[previewIndex] ?? currentWorlds[0];
  const floatingPreviewIndex = expanded
    ? expandedPreviewIndex
    : previewVisible
      ? previewIndex
      : null;
  const floatingPreview =
    floatingPreviewIndex === null ? null : currentWorlds[floatingPreviewIndex];

  useEffect(() => {
    if (travelling || !hasTravelledRef.current) return;
    if (expandedRef.current)
      detailRef.current
        ?.querySelector('button')
        ?.focus({ preventScroll: true });
    else ringPortalRef.current?.focus({ preventScroll: true });
  }, [travelling]);

  const previewDestination = (index: number) => {
    if (expandedRef.current) return;
    previewVisibleRef.current = true;
    setPreviewVisible(true);
    previewIndexRef.current = index;
    setPreviewIndex(index);
    const systemId = galaxies[galaxyIdRef.current].worlds[index]?.systemId;
    const system = systemId && getSolarSystem(systemId);
    if (system) solarRef.current?.prepare(system);
  };

  const expandDestination = (index: number) => {
    if (travellingRef.current) return;
    const destination = galaxies[galaxyIdRef.current].worlds[index];
    if (destination.systemId) {
      previewDestination(index);
      collapseDestination();
      enterSolarRef.current(destination.systemId);
      return;
    }
    activeIndexRef.current = index;
    previewIndexRef.current = index;
    expandedPreviewIndexRef.current = null;
    expandedRef.current = true;
    cameraModeRef.current = 'expanded';
    focusRotationRef.current =
      galaxies[galaxyIdRef.current].worlds[index].angle - Math.PI / 2;
    setActiveIndex(index);
    setPreviewIndex(index);
    setExpandedPreviewIndex(null);
    setExpanded(true);
  };

  const expandRandomDestination = () => {
    if (galaxyIdRef.current === 'home' && projectOrbits.length) {
      const destination = projectOrbits[randomIndex(projectOrbits.length)];
      enterSolarRef.current(destination.systemId, destination.index);
      return;
    }
    const currentIndex = expandedRef.current
      ? activeIndexRef.current
      : previewIndexRef.current;
    const count = galaxies[galaxyIdRef.current].worlds.length;
    const offset = 1 + randomIndex(count - 1);
    expandDestination((currentIndex + offset) % count);
  };

  const advanceOrSpin = () => {
    if (travellingRef.current) return;
    if (expandedRef.current) {
      const count = galaxies[galaxyIdRef.current].worlds.length;
      if (count > 1) expandDestination((activeIndexRef.current + 1) % count);
    } else {
      spinGalaxyRef.current();
    }
  };

  const collapseDestination = () => {
    expandedPreviewIndexRef.current = null;
    expandedRef.current = false;
    cameraModeRef.current = 'default';
    setExpandedPreviewIndex(null);
    setExpanded(false);
  };

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      const solar = solarRef.current;
      if (
        event.defaultPrevented ||
        (event.target instanceof Element &&
          event.target.closest('input, textarea, select, [role="dialog"]'))
      )
        return;
      if (solar?.active) {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (solar.selected !== null && !solar.navigating) solar.select(null);
          else leaveSolar();
        } else if (
          (event.key === 'ArrowRight' || event.key === 'ArrowLeft') &&
          !solar.navigating
        ) {
          event.preventDefault();
          const count = solar.system?.planets.length ?? 0;
          if (!count) return;
          const direction = event.key === 'ArrowRight' ? 1 : -1;
          solar.select(
            solar.selected === null
              ? direction === 1
                ? 0
                : count - 1
              : (solar.selected + direction + count) % count,
          );
        }
        return;
      }
      if (event.key !== 'Escape') return;
      if (expandedRef.current) collapseDestination();
      else if (galaxyIdRef.current === 'webring') travelRef.current('home');
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  useEffect(() => {
    if (solarPhase !== 'system' && solarPhase !== 'galaxy') return;
    // Keyboard entry starts from the hidden world list; land on the tray.
    if (
      solarPhase === 'system' &&
      document.activeElement?.closest('nav[aria-label="Website worlds"]')
    )
      stageRef.current?.parentElement
        ?.querySelector<HTMLButtonElement>('.solar-sun-button')
        ?.focus({ preventScroll: true });
  }, [solarPhase]);

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
    const stageElement = stageRef.current;
    if (!stageElement) return;
    const stage: HTMLDivElement = stageElement;
    const sceneShell = stage.parentElement!;

    let renderer: THREE.WebGLRenderer;
    let fallbackFrame: number;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        depth: true,
        stencil: false,
        powerPreference: 'high-performance',
      });
    } catch {
      fallbackFrame = requestAnimationFrame(() => setGraphicsUnavailable(true));
      return () => cancelAnimationFrame(fallbackFrame);
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
    let { rest: defaultCameraDistance, open: expandedCameraDistance } =
      cameraDistances(isCompact);
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
      { position: [-3.7, -4.8, -25], scale: [1.45, 0.5], opacity: 0.42 },
      { position: [4.2, -5.7, -29], scale: [1.02, 0.37], opacity: 0.38 },
      { position: [-2.8, 8.8, -31], scale: [0.75, 0.27], opacity: 0.35 },
      { position: [1.8, -9.2, -34], scale: [0.55, 0.2], opacity: 0.32 },
      { position: [-4.5, 3.1, -38], scale: [0.44, 0.16], opacity: 0.3 },
    ] as const;
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
      const points = new THREE.Points(farGalaxyGeometry, material);
      points.position.set(spec.position[0], spec.position[1], spec.position[2]);
      points.scale.set(spec.scale[0], spec.scale[1], 1);
      points.rotation.z = index * 0.71 - 0.38;
      points.renderOrder = -2;
      scene.add(points);
      return points;
    });

    const glowTexture = createGlowTexture();
    const markerTexture = createMarkerTexture();
    const starlightTexture = createStarlightTexture();
    const signalWaveTexture = createSignalWaveTexture();

    const galaxyTextures = {
      glow: glowTexture,
      marker: markerTexture,
      starlight: starlightTexture,
      signalWave: signalWaveTexture,
    };
    // Both galaxies use the same scene and interaction architecture. Travel
    // moves these real groups continuously between foreground and distance.
    const buildGalaxy = (definition: (typeof galaxies)[GalaxyId]) => {
      const layer = createGalaxyLayer(definition, {
        starCount,
        pixelRatio,
        coreExposure: coreExposureRef.current,
        textures: galaxyTextures,
      });
      scene.add(layer.galaxy);
      return layer;
    };

    const galaxyScenes = {
      home: buildGalaxy(galaxies.home),
      webring: buildGalaxy(galaxies.webring),
    };
    let { galaxy, galaxyPoints, galaxyMist, glowMaterial, softGlow, nodes } =
      galaxyScenes[galaxyIdRef.current];
    let sceneWorlds = galaxies[galaxyIdRef.current].worlds;
    // Preserve the current destination when the preview hot-reloads.
    let travelProgress = galaxyIdRef.current === 'webring' ? 1 : 0;
    let travelStart = travelProgress;
    let travelTarget = travelProgress;
    travellingRef.current = false;
    let syncTravelState = true;
    let travelElapsed = 0;
    let inspectOnArrival = false;
    const foregroundPosition = new THREE.Vector3(0, 1.35, 0);
    const distantSignalPosition = new THREE.Vector3();

    const portraits = new PortraitBurst(stage);
    galaxyScenes.home.galaxy.add(portraits.group);

    const portraitPreloadTimer = window.setTimeout(
      () => {
        if (!groxActive) portraits.preload();
      },
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
    const distantParallax = new DistantGalaxyParallax(
      stageWidth,
      stageHeight,
      defaultCameraDistance,
    );
    let bottomInset = 0;
    let rightInset = 0;
    let leftInset = 0;
    let touchPointer = false;
    const setCursor = (cursor: string) => {
      if (renderer.domElement.style.cursor !== cursor)
        renderer.domElement.style.cursor = cursor;
    };
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    let lastDetailIndex = -1;
    let detailMotion: CardMotion | null = null;
    let chromeRects: DOMRect[] = [];
    let stageLeft = 0;
    let stageTop = 0;
    let beaconPortal: HTMLElement | null = null;
    let beaconGalaxy: GalaxyId | null = null;
    let hoveredIndex = -1;
    let hasHoveredWorld = false;
    let isDragging = false;
    let pointerId = -1;
    let lastX = 0;
    let lastY = 0;
    let dragDistance = 0;
    let angularVelocity = 0;
    const dockSpin = new DockSpin();
    const dockHover = new DockHover();
    let tiltVelocity = 0;
    let fastSpinTravel = 0;
    let dockSpinPresses = 0;
    let frame = 0;
    let animationFrame = 0;
    let isVisible = true;
    let disposed = false;
    let previousTime = 0;
    let groxElapsed = 0;
    let groxArrived = false;
    let groxActive = groxEncounter;
    let groxRetreating = false;
    let groxRetreatElapsed = 0;
    let groxRetreatFrom = 1;
    const previousCoreExposure = coreExposureRef.current;
    const groxWorldPosition = new THREE.Vector3();
    const groxCameraStart = camera.position.clone();
    const groxCameraEnd = new THREE.Vector3();
    const groxCameraOffset = new THREE.Vector3(-0.2, 3.5, 9.3);
    const groxLookStart = cameraLookTarget.clone();
    const groxBeacon = groxEncounter
      ? new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: starlightTexture,
            color: 0xff2118,
            transparent: true,
            toneMapped: false,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
          }),
        )
      : null;
    if (groxBeacon) {
      groxBeacon.position.set(...GROX_STAR_POSITION);
      groxBeacon.scale.setScalar(1.1);
      groxBeacon.renderOrder = 12;
      galaxyScenes.home.galaxy.add(groxBeacon);
      focusRotationRef.current = null;
      ambientMotionRef.current = false;
      coreExposureRef.current = 0.55;
    }
    groxLeaveRef.current = () => {
      if (!groxActive) return false;
      if (!groxRetreating) {
        groxRetreatFrom = groxApproachFrame(groxElapsed, reduceMotion).progress;
        groxRetreating = true;
        groxRetreatElapsed = 0;
        previousTime = 0;
        if (!animationFrame) animationFrame = requestAnimationFrame(animate);
      }
      return true;
    };

    let pendingSolarSelection: number | null | undefined;
    const solarCoreScratch = new THREE.Vector3();
    let applyingSolarRoute = false;
    const solar = new SolarSystemScene(
      scene,
      camera,
      renderer,
      stage,
      (phase, selected) => {
        setSolarPhase(phase);
        setSolarSelected(selected);
        if (solar.system) setSolarSystem(solar.system);
        if (phase === 'system' || phase === 'planet') {
          if (pendingSolarSelection !== undefined) {
            const requested = pendingSolarSelection;
            pendingSolarSelection = undefined;
            if (selected !== requested) {
              solar.select(requested);
              return;
            }
          }
          if (!applyingSolarRoute && solar.system) {
            const hash = systemHref(
              solar.system.id,
              selected === null ? undefined : solar.system.planets[selected].id,
            );
            if (window.location.hash !== hash)
              window.history.pushState(null, '', hash);
          }
        }
        if (phase === 'galaxy')
          requestAnimationFrame(() => {
            if (solarRef.current !== solar) return;
            if (!parseSystemRoute(window.location.hash)) {
              const familyId = solar.system?.id.replace(/-\d+$/, '');
              sceneShell
                .querySelector<HTMLButtonElement>(
                  `[aria-label="Website worlds"] [data-world-id="${familyId}"]`,
                )
                ?.focus({ preventScroll: true });
            }
            onHistory();
          });
      },
      setSolarHovered,
    );
    solarRef.current = solar;
    solar.onExitRequest = () => returnToGalaxy(solar);
    const solarWarmFrame = requestAnimationFrame(() => {
      if (!groxEncounter && !solar.active) solar.prepare(solarSystems[0]);
    });
    enterSolarRef.current = (
      systemId,
      planetIndex = null,
      updateHistory = true,
    ) => {
      const system = getSolarSystem(systemId);
      if (!system || groxActive) return;
      const hash = systemHref(
        system.id,
        planetIndex === null ? undefined : system.planets[planetIndex]?.id,
      );
      if (updateHistory && window.location.hash !== hash)
        window.history.pushState(null, '', hash);
      if (galaxyIdRef.current !== 'home' || travellingRef.current) {
        travelRef.current('home', false, false);
        return;
      }
      pendingSolarSelection = planetIndex;
      if (solar.active && solar.system?.id === system.id) {
        if (!solar.navigating) {
          pendingSolarSelection = undefined;
          applyingSolarRoute = !updateHistory;
          solar.select(planetIndex);
          applyingSolarRoute = false;
        }
        return;
      }
      const entryStar = new THREE.Vector3();
      const markerIndex = galaxyDestinations.findIndex(
        (world) =>
          world.systemId?.replace(/-\d+$/, '') ===
          system.id.replace(/-\d+$/, ''),
      );
      galaxyScenes.home.nodes[Math.max(0, markerIndex)].marker.getWorldPosition(
        entryStar,
      );
      const galaxyCenter = new THREE.Vector3();
      galaxyScenes.home.galaxy.getWorldPosition(galaxyCenter);
      // Every way in (random world, a link, history) closes an open galaxy
      // detail, as a family star's own entry does; it must not reopen later.
      if (!solar.active) collapseDestination();
      setSolarSystem(system);
      setSolarPaused(false);
      applyingSolarRoute = !updateHistory;
      solar.enter(system, entryStar, galaxyCenter);
      applyingSolarRoute = false;
    };

    travelRef.current = (id, inspect = false, updateHistory = true) => {
      if (solar.active) return;
      if (!galaxies[id].worlds.length) return;
      if (id === galaxyIdRef.current) {
        if (inspect && travellingRef.current) inspectOnArrival = true;
        else if (inspect) expandDestination(0);
        return;
      }
      collapseDestination();
      pointers.forEach((_, id) => {
        if (renderer.domElement.hasPointerCapture(id))
          renderer.domElement.releasePointerCapture(id);
      });
      pointers.clear();
      isDragging = false;
      pointerId = -1;
      pinchDistance = 0;
      angularVelocity = 0;
      tiltVelocity = 0;
      fastSpinTravel = 0;
      dockSpinPresses = 0;
      dockSpin.reset();
      dockHover.reset();
      pointer.set(4, 4);
      hoveredIndex = -1;
      travelStart = travelProgress;
      travelTarget = id === 'webring' ? 1 : 0;
      travelElapsed = 0;
      inspectOnArrival = inspect;
      travellingRef.current = true;
      hasTravelledRef.current = true;
      setTravelling(true);
      galaxyIdRef.current = id;
      setGalaxyId(id);
      ({ galaxy, galaxyPoints, galaxyMist, glowMaterial, softGlow, nodes } =
        galaxyScenes[id]);
      sceneWorlds = galaxies[id].worlds;
      activeIndexRef.current = 0;
      previewIndexRef.current = 0;
      setActiveIndex(0);
      setPreviewIndex(0);
      lastDetailIndex = -1;
      focusRotationRef.current = sceneWorlds[0].angle - Math.PI / 2;
      cameraModeRef.current = 'default';
      if (updateHistory)
        window.history.pushState(
          null,
          '',
          id === 'webring' ? '#webring' : '#galaxy',
        );
    };

    const onHistory = () => {
      const route = parseSystemRoute(window.location.hash);
      if (route) {
        enterSolarRef.current(route.system.id, route.planetIndex, false);
        return;
      }
      if (window.location.hash.startsWith('#system/'))
        window.history.replaceState(null, '', '#galaxy');
      pendingSolarSelection = undefined;
      if (solar.active) {
        solar.exit();
        return;
      }
      if (!groxActive)
        travelRef.current(
          window.location.hash === '#webring' ? 'webring' : 'home',
          false,
          false,
        );
    };
    window.addEventListener('popstate', onHistory);
    window.addEventListener('hashchange', onHistory);
    if (!groxEncounter) onHistory();

    hoverGalaxyRef.current = () => {
      if (travellingRef.current || expandedRef.current || reduceMotion) return;
      // CSS screen rotation has the opposite sign to the scene's Y rotation.
      dockHover.nudge(angularVelocity < -0.002 ? -1 : 1);
    };

    spinGalaxyRef.current = () => {
      if (travellingRef.current) return;
      focusRotationRef.current = null;
      const direction = angularVelocity < -0.002 ? -1 : 1;
      // Hand the current hover pose to the unchanged click flywheel without a snap.
      dockSpin.angle += dockHover.angle;
      dockHover.reset();
      if (!reduceMotion) dockSpin.kick(-direction);
      dockSpinPresses += 1;
      const stagedMagnitude = Math.min(0.16, dockSpinPresses * 0.022);
      angularVelocity =
        direction *
        THREE.MathUtils.clamp(
          Math.max(Math.abs(angularVelocity) + 0.012, stagedMagnitude),
          0.022,
          0.16,
        );

      if (
        galaxyIdRef.current === 'home' &&
        Math.abs(angularVelocity) >= 0.12 &&
        !portraits.coolingDown
      ) {
        portraits.burst();
        fastSpinTravel = 0;
        angularVelocity *= 0.58;
        dockSpinPresses = 0;
      }
    };

    /** Wheel and pinch share limits, so switching input never jumps the view. */
    const clampZoom = (distance: number) =>
      THREE.MathUtils.clamp(
        distance,
        expandedRef.current ? 15.5 : 18,
        expandedRef.current ? 24 : 31,
      );

    const aimPointer = (clientX: number, clientY: number) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    };
    const updatePointer = (event: PointerEvent) => {
      touchPointer = event.pointerType === 'touch';
      aimPointer(event.clientX, event.clientY);
    };

    const destinationAtPointer = () => {
      if (travellingRef.current) return -1;
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
      if (solar.active) {
        solar.pointerDown(event);
        return;
      }
      if (travellingRef.current || event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [first, second] = [...pointers.values()];
        pinchDistance = Math.hypot(first.x - second.x, first.y - second.y);
        dragDistance = Infinity;
        angularVelocity = 0;
        renderer.domElement.setPointerCapture(event.pointerId);
        return;
      }
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
      if (solar.active) {
        solar.pointerMove(event);
        return;
      }
      updatePointer(event);
      if (pointers.has(event.pointerId))
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        const [first, second] = [...pointers.values()];
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        if (pinchDistance > 0 && distance > 0) {
          cameraModeRef.current = 'manual';
          cameraDistance = clampZoom(
            (cameraDistance * pinchDistance) / distance,
          );
        }
        pinchDistance = distance;
        return;
      }
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
      galaxyScenes[galaxyIdRef.current].tilt = THREE.MathUtils.clamp(
        galaxyScenes[galaxyIdRef.current].tilt + tiltVelocity,
        -0.33,
        0.24,
      );
    };

    const endPointer = (event: PointerEvent) => {
      if (solar.active) {
        solar.pointerUp(event);
        return;
      }
      const wasPinching = pointers.size >= 2;
      pointers.delete(event.pointerId);
      if (wasPinching) {
        const remaining = [...pointers.entries()][0];
        if (remaining) {
          pointerId = remaining[0];
          lastX = remaining[1].x;
          lastY = remaining[1].y;
        }
        pinchDistance = 0;
        dragDistance = Infinity;
        if (renderer.domElement.hasPointerCapture(event.pointerId))
          renderer.domElement.releasePointerCapture(event.pointerId);
        return;
      }
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

    const onPointerLeave = (event: PointerEvent) => {
      if (solar.active) {
        if (
          !(event.relatedTarget instanceof Element) ||
          !event.relatedTarget.closest(
            '[data-solar-preview], [data-solar-hover]',
          )
        )
          solar.setHover(null);
        return;
      }
      if (!isDragging) {
        pointer.set(4, 4);
        setCursor('grab');
        if (expandedPreviewIndexRef.current !== null) {
          expandedPreviewIndexRef.current = null;
          setExpandedPreviewIndex(null);
        }
      }
    };

    let diveIntent = 0,
      diveAt = 0,
      diveTarget: string | undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (solar.active) {
        solar.wheel(event.deltaY, event.clientX, event.clientY, {
          pinch: event.ctrlKey,
          lines: event.deltaMode === WheelEvent.DOM_DELTA_LINE,
        });
        return;
      }
      if (travellingRef.current) return;
      // Spore-style descent: keep scrolling in over a family star to dive in.
      if (event.deltaY < 0 && galaxyIdRef.current === 'home') {
        // The wheel may arrive over a preview card; aim from its own position.
        aimPointer(event.clientX, event.clientY);
        const index = destinationAtPointer();
        const systemId = index >= 0 ? sceneWorlds[index]?.systemId : undefined;
        const now = performance.now();
        if (!systemId || systemId !== diveTarget || now - diveAt > 450)
          diveIntent = 0;
        diveTarget = systemId;
        diveAt = now;
        if (systemId) {
          diveIntent += Math.min(-event.deltaY, 120);
          if (diveIntent >= 320) {
            diveIntent = 0;
            previewDestination(index);
            enterSolarRef.current(systemId);
            return;
          }
        }
      } else diveIntent = 0;
      cameraModeRef.current = 'manual';
      cameraDistance = clampZoom(cameraDistance + event.deltaY * 0.01);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', endPointer);
    renderer.domElement.addEventListener('pointercancel', endPointer);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    // Hover previews sit over their stars; scrolling on one still steers the
    // scene. In a system the whole HUD does: no dead spots, and a trackpad
    // pinch over the console zooms the system rather than the page.
    const onPreviewWheel = (event: WheelEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(
          solar.active
            ? '.world-preview, .solar-hud'
            : '.world-preview, [data-solar-preview]',
        )
      )
        onWheel(event);
    };
    sceneShell.addEventListener('wheel', onPreviewWheel, { passive: false });

    resetGalaxyRef.current = () => {
      if (galaxyIdRef.current !== 'home') {
        travelRef.current('home');
        return;
      }
      if (travellingRef.current) return;
      angularVelocity = 0;
      tiltVelocity = 0;
      fastSpinTravel = 0;
      dockSpinPresses = 0;
      cameraDistance = defaultCameraDistance;
      galaxy.rotation.x = GALAXY_TILT;
      galaxyScenes.home.tilt = GALAXY_TILT;
      galaxy.rotation.y = galaxyDestinations[0].angle - Math.PI / 2;
      galaxyPoints.rotation.y = 0;
      galaxyMist.rotation.y = MIST_TWIST;
      cameraLookTarget.set(0.7, 0, 0);
      activeIndexRef.current = 0;
      previewIndexRef.current = 0;
      collapseDestination();
      focusRotationRef.current = galaxyDestinations[0].angle - Math.PI / 2;
      setActiveIndex(0);
      setPreviewIndex(0);
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
      ({ rest: defaultCameraDistance, open: expandedCameraDistance } =
        cameraDistances(width <= 720));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      solar.resize();
      distantParallax.resize(width, height, defaultCameraDistance, rightInset);
      if (groxEncounter && groxArrived && !animationFrame)
        animationFrame = requestAnimationFrame(animate);
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

    // Place both galaxies for the current travel state. The first solar frame
    // also runs this, so a system opened by address never flies over an
    // unplaced web-ring galaxy stacked on the home galaxy.
    let galaxiesPlaced = false;
    function layoutGalaxies(delta: number) {
      galaxiesPlaced = true;
      // Let the distant galaxy share the scene's camera parallax instead of
      // cancelling it by re-pinning the galaxy to fixed screen coordinates.
      distantParallax.update(camera, ringPosition, reduceMotion);
      const portalX = distantParallax.screenX;
      const portalY = distantParallax.screenY + 14;
      const unitsPerPixel =
        (2 *
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
          distantParallax.depth) /
        stageHeight;
      const neighborScale = (compactViewport ? 58 : 74) * unitsPerPixel;
      for (const id of ['home', 'webring'] as const) {
        const layer = galaxyScenes[id];
        const foreground = id === 'home' ? 1 - travelProgress : travelProgress;
        layer.galaxy.position.lerpVectors(
          ringPosition,
          foregroundPosition,
          foreground,
        );
        if (!reduceMotion)
          layer.galaxy.position.x +=
            Math.sin(travelProgress * Math.PI) * (id === 'home' ? -8 : 8);
        layer.galaxy.scale.setScalar(
          THREE.MathUtils.lerp(neighborScale / 14.2, 1.08, foreground),
        );
        layer.galaxy.rotation.x = THREE.MathUtils.lerp(
          -0.68,
          layer.tilt,
          foreground,
        );
        layer.galaxy.rotation.z = -0.25 * (1 - foreground);
        const pointCount = layer.galaxyGeometry.getAttribute('position').count;
        layer.galaxyGeometry.setDrawRange(
          0,
          Math.round(1800 + (pointCount - 1800) * foreground),
        );
        layer.galaxyMaterial.uniforms.uPointScale.value =
          0.3 + foreground * 0.7;
        layer.galaxyMaterial.uniforms.uOpacity.value = 0.8 + foreground * 0.2;
        layer.galaxyMistMaterial.uniforms.uPointScale.value =
          0.1 + foreground * 2.35;
        layer.galaxyMistMaterial.uniforms.uOpacity.value = foreground * 0.32;
        layer.galaxyMist.visible = foreground > 0.01;
        layer.softGlow.visible = foreground > 0.01;
        layer.galaxyPoints.renderOrder = foreground > 0.5 ? 1 : -4;
        layer.galaxyMist.renderOrder = foreground > 0.5 ? 0 : -5;
        layer.glow.renderOrder = foreground > 0.5 ? 3 : -3;
        layer.softGlow.renderOrder = foreground > 0.5 ? 2 : -3;
        layer.glowMaterial.opacity =
          coreExposureRef.current * (0.36 + foreground * 0.64);
        layer.softGlow.material.opacity =
          coreExposureRef.current * 0.3 * foreground;
        if (id !== galaxyIdRef.current && ambientMotionRef.current)
          layer.galaxy.rotation.y += 0.0003 * delta;
        layer.nodes.forEach(({ marker, sparkle, signalWaves }) => {
          marker.visible = id === galaxyIdRef.current && !travellingRef.current;
          sparkle.visible = marker.visible;
          signalWaves.forEach((wave) => {
            wave.visible = marker.visible;
          });
        });
      }
      return { portalX, portalY };
    }

    function animate(time: number) {
      animationFrame = 0;
      if (disposed || !isVisible || document.visibilityState === 'hidden') {
        return;
      }
      if (syncTravelState) {
        setTravelling(travellingRef.current);
        syncTravelState = false;
      }

      const frameMs = previousTime === 0 ? 16.667 : time - previousTime;
      const elapsedMs = Math.min(frameMs, 33.334);
      const delta = elapsedMs / 16.667;
      previousTime = time;
      frame += 1;

      if (solar.active) {
        if (!galaxiesPlaced) layoutGalaxies(delta);
        solar.update(frameMs, reduceMotion);
        // Markers and the core's glare are galaxy-scale chrome: diving past
        // them should not smear a lens sprite across the whole view.
        const keep = 1 - solar.galaxyVeil;
        const home = galaxyScenes.home;
        home.nodes.forEach(({ marker, sparkle, signalWaves }) => {
          marker.material.opacity = Math.min(
            marker.material.opacity,
            0.98 * keep,
          );
          sparkle.material.opacity = Math.min(sparkle.material.opacity, keep);
          signalWaves.forEach((wave) => {
            wave.material.opacity = Math.min(wave.material.opacity, keep);
          });
        });
        // The core glows are huge billboards that blow out, then clip, as the
        // camera nears them. Tie them to the camera's distance from the core
        // relative to the preserved galaxy view only: continuous both ways,
        // and exactly the galaxy's own values once the camera is home.
        home.galaxy.getWorldPosition(solarCoreScratch);
        const coreDistance = camera.position.distanceTo(solarCoreScratch);
        const homeDistance =
          solar.savedPosition?.distanceTo(solarCoreScratch) ?? coreDistance;
        const coreKeep =
          THREE.MathUtils.smoothstep(
            coreDistance / Math.max(1e-3, homeDistance),
            0.7,
            0.995,
          ) * THREE.MathUtils.smoothstep(coreDistance, 5, 9);
        home.glowMaterial.opacity = coreExposureRef.current * coreKeep;
        home.softGlow.material.opacity =
          coreExposureRef.current * 0.3 * coreKeep;
        home.galaxyMaterial.uniforms.uPointScale.value = 0.75 + 0.25 * coreKeep;
        const starsKeep = 1 - solar.galaxyFade;
        home.galaxyMistMaterial.uniforms.uOpacity.value =
          0.32 * (0.4 + 0.6 * coreKeep) * starsKeep;
        home.galaxyMaterial.uniforms.uOpacity.value =
          starsKeep * (0.8 + 0.2 * coreKeep);
        renderer.render(scene, camera);
        animationFrame = requestAnimationFrame(animate);
        return;
      }

      // Sample only actual controls, never the transparent corner/dock
      // wrappers. A beacon behind a real button should not invite a lost tap.
      // Read here, before this frame writes any style.
      if (frame % 8 === 1) {
        const stageBounds = stage.getBoundingClientRect();
        stageLeft = stageBounds.left;
        stageTop = stageBounds.top;
        chromeRects = Array.from(
          sceneShell.querySelectorAll(
            '.spore-corner a, .spore-corner button, .spore-dock a, .spore-dock button, .galaxy-signal, .world-detail:not([data-phase="leaving"])',
          ),
          (element) => element.getBoundingClientRect(),
        );
      }

      if (travellingRef.current) {
        travelElapsed += elapsedMs;
        const t = Math.min(1, travelElapsed / (reduceMotion ? 350 : 1650));
        const eased = t * t * (3 - 2 * t);
        travelProgress = THREE.MathUtils.lerp(travelStart, travelTarget, eased);
        if (t === 1) {
          travellingRef.current = false;
          setTravelling(false);
          if (inspectOnArrival) expandDestination(0);
          if (parseSystemRoute(window.location.hash)) onHistory();
        }
      }

      if (!isDragging && !groxActive) {
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

      if (galaxyIdRef.current === 'home' && fastSpinTravel >= Math.PI * 8) {
        portraits.burst();
        fastSpinTravel = 0;
      }

      if (cameraModeRef.current !== 'manual') {
        const desiredCameraDistance = expandedRef.current
          ? expandedCameraDistance
          : defaultCameraDistance;
        cameraDistance +=
          (desiredCameraDistance - cameraDistance) * frameEase(0.065, delta);
      }
      const flightDolly = reduceMotion
        ? 0
        : Math.sin(travelProgress * Math.PI) * 3;
      // Position and aim share one frame-rate-independent rate, so the view
      // moves as one piece instead of sliding first and turning to catch up.
      const cameraEase = frameEase(0.055, delta);
      camera.position.y +=
        ((cameraDistance - flightDolly) * 0.37 - camera.position.y) *
        cameraEase;
      camera.position.z +=
        ((cameraDistance - flightDolly) * 0.93 - camera.position.z) *
        cameraEase;
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
      const followAmount = travellingRef.current
        ? 0
        : isDragging
          ? 0.025
          : 0.075;
      const desiredLookX = 0.7 + cameraFollowPosition.x * followAmount;
      const desiredLookY = travellingRef.current
        ? 0
        : cameraFollowPosition.y * 0.04;
      const desiredLookZ = travellingRef.current
        ? 0
        : cameraFollowPosition.z * 0.025;
      cameraLookTarget.x += (desiredLookX - cameraLookTarget.x) * cameraEase;
      cameraLookTarget.y += (desiredLookY - cameraLookTarget.y) * cameraEase;
      cameraLookTarget.z += (desiredLookZ - cameraLookTarget.z) * cameraEase;
      camera.lookAt(cameraLookTarget);

      const { portalX, portalY } = layoutGalaxies(delta);
      if (groxBeacon && groxActive) {
        if (groxRetreating) groxRetreatElapsed += elapsedMs;
        else groxElapsed += elapsedMs;
        const approach = groxApproachFrame(groxElapsed, reduceMotion);
        const retreat = groxRetreatFrame(
          groxRetreatElapsed,
          groxRetreatFrom,
          reduceMotion,
        );
        const progress = groxRetreating ? retreat.progress : approach.progress;
        galaxyScenes.home.galaxy.updateWorldMatrix(true, false);
        groxBeacon.getWorldPosition(groxWorldPosition);
        // Lift the red target above the center of the approaching view.
        groxCameraEnd.copy(groxWorldPosition).add(groxCameraOffset);
        camera.position.lerpVectors(groxCameraStart, groxCameraEnd, progress);
        cameraLookTarget.lerpVectors(
          groxLookStart,
          groxWorldPosition,
          progress,
        );
        cameraLookTarget.y -= progress * 1.45;
        camera.lookAt(cameraLookTarget);
        stage.dataset.groxApproach = progress.toFixed(3);
        if (groxRetreating && retreat.returned) {
          groxActive = false;
          groxBeacon.visible = false;
          cameraDistance = defaultCameraDistance;
          ambientMotionRef.current = true;
          coreExposureRef.current = previousCoreExposure;
          setGroxReturned(true);
          groxReturnRef.current?.();
          portraits.preload();
        } else if (!groxRetreating && approach.arrived && !groxArrived) {
          groxArrived = true;
          groxArrivalRef.current?.();
        }
      }
      nodes.forEach((node) => {
        projectedHit.copy(node.position);
        galaxy.localToWorld(projectedHit);
        projectedHit.project(camera);
        const x = (projectedHit.x * 0.5 + 0.5) * stageWidth;
        const y = (-projectedHit.y * 0.5 + 0.5) * stageHeight;
        // Chrome rects are in viewport coordinates; the stage may be offset.
        const clientX = x + stageLeft,
          clientY = y + stageTop;
        node.occluded = chromeRects.some(
          (rect) =>
            clientX >= rect.left - 8 &&
            clientX <= rect.right + 8 &&
            clientY >= rect.top - 8 &&
            clientY <= rect.bottom + 8,
        );
      });

      if (!isDragging && frame % 2 === 0) {
        const nextIndex = destinationAtPointer();
        if (nextIndex >= 0) {
          if (nextIndex !== hoveredIndex) {
            const systemId = sceneWorlds[nextIndex].systemId;
            const system = systemId && getSolarSystem(systemId);
            if (system) solar.prepare(system);
          }
          hasHoveredWorld = true;
          if (!previewVisibleRef.current) {
            previewVisibleRef.current = true;
            setPreviewVisible(true);
          }
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
          setCursor('pointer');
        } else {
          if (
            hasHoveredWorld &&
            previewVisibleRef.current &&
            !previewRef.current?.matches(':hover, :focus-within') &&
            !document.activeElement?.closest('[aria-label="Website worlds"]')
          ) {
            previewVisibleRef.current = false;
            setPreviewVisible(false);
          }
          hoveredIndex = -1;
          setCursor('grab');
          if (expandedPreviewIndexRef.current !== null) {
            expandedPreviewIndexRef.current = null;
            setExpandedPreviewIndex(null);
          }
        }
      } else if (isDragging) {
        setCursor('grabbing');
      }

      nodes.forEach(
        (
          {
            marker,
            sparkle,
            signalWaves,
            luminosity,
            lightSize,
            shimmerPhase,
            occluded,
          },
          index,
        ) => {
          const destination = sceneWorlds[index];
          const isSelected = expandedRef.current && index === selectedIndex;
          const isPreviewed =
            !expandedRef.current && index === previewIndexRef.current;
          const isHovered = index === hoveredIndex;
          const motionTime = time * (reduceMotion ? 0.72 : 1);
          const twinkle = reduceMotion
            ? 0.75
            : 0.75 +
              Math.sin(time * 0.0021 + shimmerPhase) * 0.17 +
              Math.sin(time * 0.0049 + shimmerPhase * 1.7) * 0.08;
          sparkle.material.opacity = occluded ? 0 : twinkle * luminosity;
          sparkle.scale
            .copy(marker.scale)
            .multiplyScalar(lightSize * (0.96 + twinkle * 0.06));
          const shimmerAmplitude = reduceMotion ? 0.025 : 0.04;
          const shimmer =
            0.96 +
            Math.sin(motionTime * 0.0042 + index * 1.71) * shimmerAmplitude;
          const pulse =
            !isSelected && !isPreviewed
              ? shimmer
              : 1 +
                Math.sin(motionTime * 0.0035) * (reduceMotion ? 0.03 : 0.045);
          const markerTarget =
            destination.size * (isSelected ? 0.82 : 0.66) * pulse;
          marker.scale.x += (markerTarget - marker.scale.x) * 0.11;
          marker.scale.y += (markerTarget - marker.scale.y) * 0.11;
          marker.material.opacity +=
            ((occluded
              ? 0
              : isSelected
                ? 1
                : isHovered || isPreviewed
                  ? 1
                  : 0.98) -
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
        },
      );

      // Measure both comms cards before positioning either, so a frame never
      // forces a synchronous layout between one card's write and the next read.
      const detail = detailRef.current;
      let detailPlacement: { x: number; y: number; hidden: boolean } | null =
        null;
      if (detail && syncCommsIdentity(detail, sceneWorlds[selectedIndex]?.id)) {
        labelPosition.copy(nodes[selectedIndex].position);
        galaxy.localToWorld(labelPosition);
        labelPosition.project(camera);
        const portrait = detail.querySelector<HTMLElement>('.world-orbit');
        const bounds = detailBounds({
          starX: (labelPosition.x * 0.5 + 0.5) * stageWidth,
          starY: (-labelPosition.y * 0.5 + 0.5) * stageHeight,
          stageWidth,
          stageHeight,
          panelWidth: detail.offsetWidth || Math.min(640, stageWidth - 24),
          panelHeight: detail.offsetHeight || (compactViewport ? 178 : 188),
          anchorX: portrait
            ? portrait.offsetLeft + portrait.offsetWidth / 2
            : 58,
          anchorY: portrait
            ? portrait.offsetTop + portrait.offsetHeight / 2
            : 80,
          compact: compactViewport,
          insets: { left: leftInset, right: rightInset, bottom: bottomInset },
        });
        // Capture instantly; brief pointer exits do not release the card.
        // After that grace period, ease back into the projected orbit.
        detailMotion = followCard(
          lastDetailIndex === selectedIndex ? detailMotion : null,
          { x: bounds.x, y: bounds.y },
          {
            now: time,
            deltaMs: elapsedMs,
            held: detail.matches(':hover, :focus-within'),
            reducedMotion: reduceMotion || compactViewport,
          },
        );
        detailMotion.x = THREE.MathUtils.clamp(
          detailMotion.x,
          bounds.minX,
          bounds.maxX,
        );
        detailMotion.y = THREE.MathUtils.clamp(
          detailMotion.y,
          bounds.minY,
          bounds.maxY,
        );
        lastDetailIndex = selectedIndex;
        detailPlacement = {
          x: detailMotion.x,
          y: detailMotion.y,
          hidden: labelPosition.z > 1,
        };
      } else {
        detailMotion = null;
        lastDetailIndex = -1;
      }

      const previewElement = previewRef.current;
      const previewedIndex = expandedRef.current
        ? expandedPreviewIndexRef.current
        : previewIndexRef.current;
      let previewPlacement: {
        x: number;
        y: number;
        opensLeft: boolean;
        hidden: boolean;
        occluded: boolean;
      } | null = null;
      if (
        previewElement &&
        syncCommsIdentity(
          previewElement,
          previewedIndex === null ? undefined : sceneWorlds[previewedIndex]?.id,
        ) &&
        previewedIndex !== null
      ) {
        previewPosition.copy(nodes[previewedIndex].position);
        galaxy.localToWorld(previewPosition);
        previewPosition.project(camera);
        const starX = (previewPosition.x * 0.5 + 0.5) * stageWidth;
        const starY = (-previewPosition.y * 0.5 + 0.5) * stageHeight;
        // Fit the nameplate into the available space before clamping its
        // position, keeping the circular portrait centered on its star. Its
        // width follows the room, so only a change in room needs a layout.
        const { margin, opensLeft, room } = previewRoom(starX, stageWidth);
        const roomValue = `${room}px`;
        if (
          previewElement.style.getPropertyValue('--preview-room') !== roomValue
        )
          previewElement.style.setProperty('--preview-room', roomValue);
        previewPlacement = {
          ...placePreview({
            starX,
            starY,
            stageWidth,
            stageHeight,
            width: previewElement.offsetWidth || 166,
            height: previewElement.offsetHeight || 62,
            margin,
            opensLeft,
          }),
          opensLeft,
          hidden: previewPosition.z > 1,
          occluded: nodes[previewedIndex].occluded,
        };
      }

      if (detail && detailPlacement) {
        detail.style.transform = `translate3d(${detailPlacement.x}px, ${detailPlacement.y}px, 0)`;
        detail.style.opacity = detailPlacement.hidden ? '0' : '1';
      }
      if (previewElement && previewPlacement) {
        const edge = previewPlacement.opensLeft ? 'right' : 'left';
        if (previewElement.dataset.edge !== edge)
          previewElement.dataset.edge = edge;
        previewElement.style.visibility = previewPlacement.occluded
          ? 'hidden'
          : '';
        // Compact previews always track their star directly. Only the open
        // dialog above gets hover capture and a smoothed return to orbit.
        previewElement.style.transform = `translate3d(${previewPlacement.x}px, ${previewPlacement.y}px, 0) translateY(-50%)`;
        previewElement.style.opacity = previewPlacement.hidden ? '0' : '1';
      }

      if (dockGalaxyIconRef.current) {
        const dockPhase =
          dockSpin.step(elapsedMs / 1000, reduceMotion) +
          dockHover.step(elapsedMs / 1000, reduceMotion);
        dockGalaxyIconRef.current.style.transform = `rotate(${-galaxy.rotation.y + dockPhase}rad)`;
      }

      const portal = ringPortalRef.current;
      if (portal) {
        portal.style.transform = `translate3d(${portalX}px, ${portalY}px, 0) translate(-50%, -50%)`;
        const remote =
          galaxyScenes[galaxyIdRef.current === 'home' ? 'webring' : 'home'];
        // The beacon takes the remote galaxy's first star colour, which is
        // fixed; set it only when the portal or the remote galaxy changes.
        if (beaconPortal !== portal || beaconGalaxy !== galaxyIdRef.current) {
          portal.style.setProperty(
            '--beacon-color',
            `#${remote.nodes[0].sparkle.material.color.getHexString()}`,
          );
          beaconPortal = portal;
          beaconGalaxy = galaxyIdRef.current;
        }
        distantSignalPosition.copy(remote.nodes[0].position);
        remote.galaxy.localToWorld(distantSignalPosition);
        distantSignalPosition.project(camera);
        // Keep the entire touch target reachable when a remote star's orbit
        // projects beyond a short landscape viewport.
        const signalX = THREE.MathUtils.clamp(
          (distantSignalPosition.x * 0.5 + 0.5) * stageWidth,
          28 + leftInset,
          stageWidth - 28 - rightInset,
        );
        const signalY = THREE.MathUtils.clamp(
          (-distantSignalPosition.y * 0.5 + 0.5) * stageHeight,
          28,
          stageHeight - 90 - bottomInset,
        );
        portal.style.setProperty('--signal-x', `${signalX - portalX}px`);
        portal.style.setProperty('--signal-y', `${signalY - portalY}px`);
      }

      if (frame % 8 === 1)
        stage.setAttribute('data-camera-distance', cameraDistance.toFixed(2));

      portraits.update(elapsedMs, delta);

      renderer.render(scene, camera);
      // Once parked at the Grox star, only the small portrait video needs to
      // animate. Resize/visibility observers can request a fresh background.
      if (!groxActive || !groxArrived || groxRetreating)
        animationFrame = requestAnimationFrame(animate);
    }

    animationFrame = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      solar.dispose();
      cancelAnimationFrame(solarWarmFrame);
      solarRef.current = null;
      enterSolarRef.current = () => undefined;
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
      sceneShell.removeEventListener('wheel', onPreviewWheel);
      window.clearTimeout(portraitPreloadTimer);
      resetGalaxyRef.current = () => undefined;
      spinGalaxyRef.current = () => undefined;
      hoverGalaxyRef.current = () => undefined;
      groxLeaveRef.current = () => false;
      portraits.dispose();
      glowTexture?.dispose();
      markerTexture?.dispose();
      starlightTexture?.dispose();
      signalWaveTexture?.dispose();
      groxBeacon?.material.dispose();
      backdropGeometry.dispose();
      backdropMaterial.dispose();
      farGalaxyGeometry.dispose();
      distantGalaxies.forEach(({ material }) => material.dispose());
      Object.values(galaxyScenes).forEach(disposeGalaxyLayer);
      window.removeEventListener('popstate', onHistory);
      window.removeEventListener('hashchange', onHistory);
      travelRef.current = () => undefined;
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [groxEncounter]);

  useEffect(() => {
    if (groxLeaving && !groxLeaveRef.current()) {
      // No WebGL renderer: reveal the regular home surface without waiting.
      setGroxReturned(true);
      groxReturnRef.current?.();
    }
  }, [groxLeaving]);

  if (groxEncounter && !groxReturned)
    return (
      <main
        id="galaxy"
        className="spore-shell relative overflow-hidden"
        data-grox-encounter="true"
        aria-hidden="true"
        inert
      >
        <div ref={stageRef} className="absolute inset-0" data-galaxy-stage />
        <div className="spore-vignette absolute inset-0" />
      </main>
    );

  return (
    <main
      id="galaxy"
      className="spore-shell relative overflow-hidden"
      style={{ '--ui-motion-speed': UI_MOTION_SPEED } as CSSProperties}
      data-galaxy={galaxyId}
      data-travelling={travelling}
      data-solar-active={solarActive}
      data-arms={galaxies[galaxyId].arms}
      onPointerOver={(event) => {
        const menu = (event.target as Element).closest('.spore-menu-item');
        if (
          !menu ||
          menu.contains(event.relatedTarget as Node | null) ||
          matchMedia('(prefers-reduced-motion: reduce)').matches
        )
          return;
        // A finite ripple finishes independently of hover; leaving never cancels it.
        menu.querySelector('.menu-motion-ripple')?.animate(
          [
            { opacity: 0.7, transform: 'translate(-50%, -50%) scale(0.1)' },
            { opacity: 0, transform: 'translate(-50%, -50%) scale(4)' },
          ],
          { duration: uiDuration(620), easing: 'ease-out' },
        );
      }}
    >
      <div ref={stageRef} className="absolute inset-0" data-galaxy-stage />
      <div aria-hidden="true" className="spore-vignette absolute inset-0" />
      {solarActive && (
        <SolarSystemHud
          key={solarSystem.id}
          system={solarSystem}
          systems={solarSystems}
          paused={solarPaused}
          onSystemChange={(id) => enterSolarRef.current(id)}
          phase={solarPhase}
          selected={solarSelected}
          hovered={solarHovered}
          onHover={(index) => solarRef.current?.setHover(index)}
          onSystemIntent={(id) => {
            const system = getSolarSystem(id);
            if (system) solarRef.current?.prepare(system);
          }}
          onSelect={(index) => solarRef.current?.select(index)}
          onExit={leaveSolar}
          onRandom={expandRandomDestination}
          randomDisabled={travelling || solarNavigating}
          onScopePick={(x, y) => solarRef.current?.pickScope(x, y) ?? null}
          onPause={(paused) => {
            setSolarPaused(paused);
            solarRef.current?.setPaused(paused);
          }}
          onZoom={(factor) => solarRef.current?.zoom(factor)}
        />
      )}

      <WebringPortal
        galaxyId={galaxyId}
        travelling={travelling}
        portalRef={ringPortalRef}
        onTravel={() =>
          travelRef.current(galaxyIdRef.current === 'home' ? 'webring' : 'home')
        }
      />

      <p className="galaxy-location" aria-live="polite">
        {solarActive
          ? solarPhase === 'entering'
            ? `diving toward ${solarSystem.starName.toLowerCase()}…`
            : solarPhase === 'leaving'
              ? 'rising back to the galaxy…'
              : `${solarSystem.name.toLowerCase()} · ${solarSystem.starName.toLowerCase()} system`
          : travelling
            ? 'crossing the stars…'
            : galaxyId === 'home'
              ? 'my corner of the universe'
              : 'web ring · friends & discoveries'}
      </p>

      <GalaxyCanopy
        galaxyId={galaxyId}
        travelling={travelling}
        solarActive={solarActive}
        randomDisabled={travelling || solarNavigating}
        onHome={() => {
          if (solarRef.current?.active) leaveSolar();
          else resetGalaxyRef.current();
        }}
        onRandom={expandRandomDestination}
        onAbout={() =>
          galaxyIdRef.current === 'home'
            ? expandDestination(0)
            : travelRef.current('home', true)
        }
      />

      <CommsPresence
        kind="preview"
        world={!travelling && !solarActive ? floatingPreview : null}
        anchorRef={previewRef}
        hint={expanded}
        onAction={() => expandDestination(floatingPreviewIndex!)}
      />
      <CommsPresence
        kind="detail"
        world={expanded && !solarActive ? active : null}
        anchorRef={detailRef}
        onAction={collapseDestination}
      />

      <GalaxyDock
        galaxyId={galaxyId}
        worlds={currentWorlds}
        activeIndex={activeIndex}
        expanded={expanded}
        disabled={travelling || solarNavigating}
        iconRef={dockGalaxyIconRef}
        onAdvance={advanceOrSpin}
        onNudge={() => hoverGalaxyRef.current()}
      />

      <nav className="sr-only" aria-label="Website worlds">
        {currentWorlds.map((destination, index) => (
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

      <p className="sr-only" aria-live="polite" hidden={solarActive}>
        {expanded
          ? `Selected world: ${active.name}. ${active.description}`
          : `Previewing world: ${preview.name}.`}
      </p>

      <WorldCatalog visible={graphicsUnavailable} />
    </main>
  );
}
