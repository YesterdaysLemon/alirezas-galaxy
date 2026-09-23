import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { orbitAngle, type SolarSystem } from '../../data/solar-systems';
import { PlanetPreparation, preparationTurn } from '../planet-preparation';
import { CameraRig } from './camera-rig';
import { SolarFlight } from './flight';
import { HudOverlay } from './hud-overlay';
import {
  DRAG_PIXELS,
  orbitDirection,
  screenRadius,
  smootherstep,
} from './math';
import { SolarRadar, type RadarFrame } from './radar';
import { SolarSystemResources, type SolarBody } from './resources';
import { SolarShip } from './ship';

export type SolarPhase =
  | 'galaxy'
  | 'entering'
  | 'system'
  | 'planet'
  | 'leaving';

const EMPTY_BODIES: SolarBody[] = [];

/**
 * A project solar system inside the galaxy's own renderer: the flight in and
 * out, the in-system camera, the scout ship, and the scene's half of the
 * ship HUD (radar and hover card). It retains at most the active or most
 * recent system and the latest destination intent.
 */
export class SolarSystemScene {
  readonly group = new THREE.Group();
  phase: SolarPhase = 'galaxy';
  selected: number | null = null;
  system: SolarSystem | null = null;
  /** Called when the reader keeps zooming out past the system overview. */
  onExitRequest: (() => void) | null = null;
  private readonly canvas: HTMLCanvasElement;
  private readonly preparation = new PlanetPreparation();
  private readonly cache = new Map<SolarSystem, SolarSystemResources>();
  private current: SolarSystemResources | null = null;
  private recent: SolarSystem | null = null;
  private readonly warmup = new AbortController();
  private readonly flight: SolarFlight;
  private readonly rig: CameraRig;
  private readonly overlay: HudOverlay;
  private readonly radar = new SolarRadar();
  private readonly radarFrame: Omit<RadarFrame, 'system'> & {
    system: SolarSystem | null;
  };
  private readonly ship = new SolarShip();
  private shipPark: number | null = null;
  private readonly shipTarget = new THREE.Vector3();
  private shipEnvironment: THREE.Texture | null = null;
  private readonly towardCore = new THREE.Vector3();
  private readonly lineOfSight = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private skyLevel = 0;
  /** Orbital time: holds still while a world is hovered or selected. */
  private localTime = 0;
  /** Spin and moon time: holds only for pause and reduced motion. */
  private visualTime = 0;
  private hovered: number | null = null;
  private readonly pointer = new Map<number, { x: number; y: number }>();
  private dragged = 0;
  private autoPaused = false;
  private destroyed = false;

  constructor(
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly stage: HTMLElement,
    private readonly onChange: (
      phase: SolarPhase,
      selected: number | null,
    ) => void,
    private readonly onHover: (index: number | null) => void,
  ) {
    this.canvas = renderer.domElement;
    this.group.name = 'Local solar system';
    this.group.visible = false;
    this.flight = new SolarFlight(scene, camera, this.group);
    this.ship.root.visible = false;
    this.group.add(this.ship.root);
    scene.add(this.group);
    this.overlay = new HudOverlay(
      this.canvas,
      stage.parentElement ?? stage,
      () => {
        this.radar.attach(this.overlay.scope);
        this.radar.measure();
      },
    );
    // oxlint-disable-next-line typescript/no-this-alias -- the host's getters read live scene state.
    const solar = this;
    this.rig = new CameraRig(camera, this.canvas, {
      get system() {
        return solar.system;
      },
      get bodies() {
        return solar.bodies;
      },
      get selected() {
        return solar.selected;
      },
      get handedOff() {
        return solar.flight.handedOff;
      },
      get viewport() {
        return solar.overlay.viewport;
      },
      pick: (clientX, clientY) => this.pick(clientX, clientY),
      releaseWorld: () => {
        this.selected = null;
        this.highlightOrbits();
        this.report('system');
      },
      captureWorld: (index) => {
        this.setHover(null);
        this.selected = index;
        this.highlightOrbits();
        this.report('planet');
      },
      requestExit: () => this.onExitRequest?.(),
    });
    this.radarFrame = {
      system: null,
      bodies: EMPTY_BODIES,
      heading: 0,
      hovered: null,
      selected: null,
      ship: null,
    };
    void this.warmFlight();
  }

  get active() {
    return this.phase !== 'galaxy';
  }
  get navigating() {
    return this.phase === 'entering' || this.phase === 'leaving';
  }
  /** The galaxy camera position preserved for the return flight. */
  get savedPosition() {
    return this.flight.savedPosition;
  }
  /** 0 = galaxy decorations as usual; 1 = markers and core glare hidden for the dive. */
  get galaxyVeil() {
    return this.flight.veil;
  }
  /** 0..1: the galaxy's own stars thin out just before the unit handoff. */
  get galaxyFade() {
    return this.flight.fade;
  }
  private get bodies() {
    return this.current?.bodies ?? EMPTY_BODIES;
  }

  /**
   * Bake the ship's reflections and compile the flight's shaders while idle,
   * so the first flight costs no shader work.
   */
  private async warmFlight() {
    const signal = this.warmup.signal;
    const staging = new THREE.Scene();
    const dust = this.flight.dust;
    staging.add(
      new THREE.Mesh(dust.geometry, dust.material),
      new THREE.HemisphereLight(),
      new THREE.PointLight(),
    );
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 10);
    camera.position.z = 2;
    try {
      await preparationTurn(signal);
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      this.shipEnvironment = pmrem.fromScene(room, 0.04).texture;
      room.dispose();
      pmrem.dispose();
      this.ship.setEnvironment(this.shipEnvironment);
      await preparationTurn(signal);
      staging.add(this.ship.root);
      const shipVisible = this.ship.root.visible;
      this.ship.root.visible = true;
      try {
        await this.renderer.compileAsync(staging, camera);
      } finally {
        // Compiled only; the ship never draws into the live frame from here.
        this.ship.root.visible =
          shipVisible ||
          (this.active && this.flight.handedOff && !this.navigating);
        if (!this.destroyed) this.group.add(this.ship.root);
      }
      await preparationTurn(signal);
      const material = dust.material;
      const colorWrite = material.colorWrite,
        autoClear = this.renderer.autoClear;
      material.colorWrite = false;
      this.renderer.autoClear = false;
      try {
        this.renderer.render(staging, camera);
      } finally {
        material.colorWrite = colorWrite;
        this.renderer.autoClear = autoClear;
      }
    } catch (error) {
      if (
        !this.destroyed &&
        error instanceof Error &&
        error.name !== 'AbortError'
      )
        console.error('Solar flight preparation failed', error);
    }
  }

  private report(phase: SolarPhase) {
    this.phase = phase;
    this.stage.dataset.solarPhase = phase;
    this.onChange(phase, this.selected);
  }

  /** Retain only the active (or most recent) system and the latest explicit intent. */
  prepare(system: SolarSystem) {
    if (this.destroyed) return;
    const protectedSystem =
      this.active && system !== this.system
        ? this.system
        : (this.current?.system ?? this.recent);
    for (const [key, resource] of this.cache) {
      if (key !== protectedSystem && key !== system) {
        resource.dispose();
        this.cache.delete(key);
      }
    }
    if (this.cache.has(system)) return;
    const resource = new SolarSystemResources(
      system,
      this.renderer,
      this.preparation,
    );
    this.cache.set(system, resource);
    void resource.completion.catch((error) => {
      if (this.cache.get(system) !== resource) return;
      this.cache.delete(system);
      resource.dispose();
      if (
        !this.destroyed &&
        error instanceof Error &&
        error.name !== 'AbortError'
      ) {
        // Worker failures already use the cooperative generator. An actual WebGL
        // failure cannot yield a valid destination; return the preserved galaxy.
        if (this.system === system && this.phase === 'entering') this.exit();
        console.error('Solar resource preparation failed', error);
      }
    });
  }

  enter(
    system: SolarSystem,
    origin: THREE.Vector3,
    galaxyCenter?: THREE.Vector3,
  ) {
    if (this.destroyed) return;
    const switching = this.active;
    if (switching) {
      this.toGalaxyUnits();
      this.flight.showGalaxySurroundings();
    } else this.flight.saveGalaxy();
    this.setHover(null);
    this.releasePointers();
    if (this.current) {
      this.recent = this.current.system;
      this.current.setSkyOpacity(0);
      this.current.group.removeFromParent();
    }
    this.current = null;
    this.system = system;
    this.selected = null;
    this.autoPaused = false;
    this.localTime = this.visualTime = 0;
    this.skyLevel = 0;
    this.shipPark = null;
    this.ship.root.visible = false;
    this.rig.resetForEntry();
    this.flight.enter(
      system,
      origin,
      galaxyCenter,
      switching,
      this.rig.distance,
    );
    this.overlay.invalidate();
    // Report before scheduling a single byte of terrain work.
    this.report('entering');
    this.prepare(system);
  }

  /** Swap the flight's stand-ins for the system once it is fully prepared. */
  private adoptReady() {
    if (this.current || !this.system) return;
    const resource = this.cache.get(this.system);
    if (!resource?.ready) return;
    this.current = resource;
    resource.starPosition.copy(this.group.position);
    this.towardCore.subVectors(this.flight.galaxyCenter, this.flight.origin);
    orbitDirection(this.rig.yaw, this.rig.pitch, this.lineOfSight).negate();
    resource.orientSky(this.towardCore, this.lineOfSight);
    resource.setSkyOpacity(0);
    this.group.add(resource.group);
    this.flight.adoptSystemLights();
    for (const material of resource.orbitMaterials)
      material.uniforms.focus.value = 1;
    this.overlay.invalidate();
  }

  /** Change to local units at the overview pose, and ease on from there. */
  private handOff() {
    this.flight.toLocalUnits(this.rig.target, this.system?.extent ?? 40);
    this.current?.starPosition.set(0, 0, 0);
    this.rig.adoptCamera();
  }

  private toGalaxyUnits() {
    if (!this.flight.handedOff) return;
    this.flight.toGalaxyUnits(this.rig.target);
    this.current?.starPosition.copy(this.flight.origin);
  }

  exit() {
    if (!this.active || this.phase === 'leaving') return;
    this.setHover(null);
    this.releasePointers();
    this.toGalaxyUnits();
    this.flight.showGalaxySurroundings();
    this.current?.setSkyOpacity(0);
    this.skyLevel = 0;
    this.ship.root.visible = false;
    this.flight.leave();
    this.report('leaving');
    // A cancelled cold destination must not continue competing with galaxy input.
    for (const [key, resource] of this.cache)
      if (!resource.ready) {
        resource.dispose();
        this.cache.delete(key);
      }
  }

  private restoreGalaxy() {
    this.ship.root.visible = false;
    this.flight.restoreGalaxy();
    this.selected = null;
  }

  select(index: number | null) {
    if (!this.active || this.navigating) return;
    if (index !== null && !this.bodies[index]) return;
    this.setHover(null);
    this.rig.flying = index !== this.selected;
    this.selected = index;
    this.highlightOrbits();
    if (index === null) this.rig.frameSystem();
    else this.rig.frameWorld(index);
    this.report(index === null ? 'system' : 'planet');
  }

  /** Up close, a world's own orbit runs edge-on through it: hide that one. */
  private highlightOrbits() {
    const index = this.selected;
    this.current?.orbitMaterials.forEach((material, orbit) => {
      material.uniforms.focus.value =
        index === null ? 1 : orbit === index ? 0 : 0.3;
    });
  }

  escape() {
    if (this.selected !== null && !this.navigating) this.select(null);
    else this.exit();
  }
  setPaused(paused: boolean) {
    this.autoPaused = paused;
  }

  resize() {
    this.overlay.resized();
    if (this.active) this.rig.relayout(!this.navigating);
  }

  update(milliseconds: number, reduceMotion: boolean) {
    if (!this.active) return;
    const elapsed = Math.max(0, milliseconds) / 1000;
    const dt = Math.min(elapsed, 0.04);
    if (this.phase === 'entering') this.adoptReady();
    const advance = !reduceMotion && !this.autoPaused;
    if (advance) this.visualTime += dt;
    if (
      advance &&
      this.selected === null &&
      this.hovered === null &&
      !this.navigating
    )
      this.localTime += dt;
    this.animateBodies(dt, advance);
    if (this.phase === 'entering') this.updateEntry(elapsed, dt, reduceMotion);
    else if (this.phase === 'leaving') this.updateExit(elapsed, reduceMotion);
    else this.rig.move(dt, reduceMotion);
    if (this.current && this.flight.handedOff) {
      if (this.phase !== 'entering') this.skyLevel = 1;
      this.current.setSkyOpacity(this.skyLevel);
    }
    if (this.flight.handedOff && this.phase !== 'leaving')
      this.updateShip(dt, reduceMotion, advance);
    this.flight.updateDust();
    this.updateOverlay();
    this.drawRadar(dt, advance);
  }

  private animateBodies(dt: number, advance: boolean) {
    const bodies = this.bodies;
    const orbits = this.current?.orbitMaterials;
    for (let index = 0; index < bodies.length; index++) {
      const body = bodies[index];
      const orbit = body.recipe.orbit;
      const angle = orbitAngle(body.recipe, this.localTime);
      body.root.position.set(
        Math.cos(angle) * orbit,
        0,
        Math.sin(angle) * orbit,
      );
      const orbitMaterial = orbits?.[index];
      if (orbitMaterial) orbitMaterial.uniforms.planetAngle.value = angle;
      if (advance) {
        body.surface.rotation.y +=
          dt * (body.recipe.terrain === 'gas' ? 0.028 : 0.045);
        body.clouds.rotation.y += dt * 0.052;
      }
      for (let mi = 0; mi < body.moons.length; mi++) {
        const moonAngle = this.visualTime * 0.08 + mi * 2.9 + index;
        body.moons[mi].position.set(
          Math.cos(moonAngle) * body.moonDistances[mi],
          Math.sin(moonAngle * 0.7) * body.recipe.radius * 0.18,
          Math.sin(moonAngle) * body.moonDistances[mi],
        );
      }
    }
    const current = this.current;
    if (current?.sun && advance)
      (current.sun.material as THREE.ShaderMaterial).uniforms.time.value +=
        dt * 0.035;
    if (current?.corona)
      current.corona.scale.setScalar(
        current.coronaSize * (1 + Math.sin(this.visualTime * 0.7) * 0.012),
      );
  }

  private updateEntry(elapsed: number, dt: number, reduceMotion: boolean) {
    const flight = this.flight;
    flight.time += elapsed;
    if (reduceMotion) {
      flight.veil = 1;
      if (!this.current) return;
      this.rig.target.copy(flight.origin);
      if (!flight.handedOff) this.handOff();
      this.rig.move(dt, true);
      flight.dust.visible = false;
      this.arrive();
    } else if (!flight.handedOff) {
      const progress = flight.dive(this.rig);
      this.rig.target.copy(flight.origin);
      if (this.current && progress >= 1) {
        this.handOff();
        this.launchShip();
      }
    } else {
      const clear = flight.clearHaze(elapsed);
      this.rig.move(elapsed, false);
      this.skyLevel = smootherstep(clear);
      if (clear >= 1) {
        flight.dust.visible = false;
        this.arrive();
      }
    }
  }

  private updateExit(elapsed: number, reduceMotion: boolean) {
    this.flight.time += elapsed;
    if (this.flight.retrace(reduceMotion) < 1) return;
    this.restoreGalaxy();
    this.report('galaxy');
  }

  private arrive() {
    this.skyLevel = 1;
    this.flight.veil = 1;
    if (!this.ship.root.visible) this.launchShip();
    this.report('system');
  }

  /** The scout arrives with the camera, then settles beside the star. */
  private launchShip() {
    if (!this.system) return;
    this.ship.root.visible = true;
    this.shipPark = null;
    this.ship.place(
      this.shipTarget.copy(this.camera.position).multiplyScalar(0.55),
    );
  }

  private updateShip(dt: number, reduceMotion: boolean, animate: boolean) {
    if (!this.system || !this.ship.root.visible) return;
    const focus = this.hovered ?? this.selected;
    if (focus !== null) this.shipPark = focus;
    const parked = this.shipPark === null ? null : this.bodies[this.shipPark];
    const cameraDistance = this.camera.position.distanceTo(
      this.ship.root.position,
    );
    const size = THREE.MathUtils.clamp(cameraDistance * 0.016, 0.26, 3);
    let beam = 0;
    if (parked) {
      const radius = parked.recipe.radius;
      const lift = radius * (this.selected === null ? 1.28 : 1.14) + size * 1.2;
      this.shipTarget.copy(parked.root.position);
      this.shipTarget.y += lift;
      if (focus !== null) beam = lift - radius - size * 0.1;
    } else {
      // Park beside the star on the camera's right, never across its disc.
      const star = this.system.star.radius;
      const yaw = this.rig.heading;
      this.shipTarget.set(
        Math.cos(yaw) * star * 3.2 + Math.sin(yaw) * star * 1.4,
        star * 1.5,
        -Math.sin(yaw) * star * 3.2 + Math.cos(yaw) * star * 1.4,
      );
    }
    this.ship.update(dt, this.shipTarget, beam, size, reduceMotion, animate);
  }

  setHover(index: number | null) {
    if (
      !this.active ||
      this.navigating ||
      (index !== null && !this.bodies[index])
    )
      index = null;
    if (index === this.hovered) return;
    this.hovered = index;
    this.overlay.hide();
    this.onHover(index);
  }

  /** As in Spore, worlds carry no standing labels: a name appears on hover. */
  private updateOverlay() {
    this.camera.updateMatrixWorld();
    this.overlay.sync();
    const index = this.hovered;
    const body = index === null ? undefined : this.bodies[index];
    if (index === null || !body) return;
    const { width, height } = this.overlay.viewport;
    body.root.getWorldPosition(this.projected).project(this.camera);
    const x = ((this.projected.x + 1) * width) / 2,
      y = ((1 - this.projected.y) * height) / 2;
    const inView =
      this.projected.z >= -1 &&
      this.projected.z < 1 &&
      x > 0 &&
      x < width &&
      y > 0 &&
      y < height;
    if (!inView || this.navigating) {
      this.setHover(null);
      return;
    }
    if (!this.overlay.showing(index)) return;
    this.overlay.place(
      x,
      y,
      screenRadius(
        body.recipe.radius,
        this.camera.position.distanceTo(body.root.position),
        height,
        this.camera,
      ),
    );
  }

  private currentRadarFrame() {
    if (!this.system) return null;
    const frame = this.radarFrame;
    frame.system = this.system;
    frame.bodies = this.bodies;
    frame.heading = this.rig.heading;
    frame.hovered = this.hovered;
    frame.selected = this.selected;
    frame.ship = this.ship.root.visible ? this.ship : null;
    return frame as RadarFrame & { system: SolarSystem };
  }

  private drawRadar(dt: number, animate: boolean) {
    const frame = this.currentRadarFrame();
    if (frame) this.radar.draw(frame, dt, animate);
  }

  /** The world under a point on the radar, if any. */
  pickScope(clientX: number, clientY: number) {
    if (!this.active || this.navigating) return null;
    const frame = this.currentRadarFrame();
    return frame ? this.radar.pick(frame, clientX, clientY) : null;
  }

  pointerDown(event: PointerEvent) {
    if (!this.active || this.navigating || event.button !== 0) return;
    if (!this.pointer.size) this.dragged = 0;
    this.pointer.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.canvas.setPointerCapture(event.pointerId);
    this.setCursor('grabbing');
  }

  pointerMove(event: PointerEvent) {
    const previous = this.pointer.get(event.pointerId);
    if (!previous) {
      const picked = this.pick(event.clientX, event.clientY);
      if (
        picked !== null ||
        this.hovered === null ||
        !this.overlay.inBridge(event.clientX, event.clientY)
      )
        this.setHover(picked);
      this.setCursor(picked === null ? 'grab' : 'pointer');
      return;
    }
    const dx = event.clientX - previous.x,
      dy = event.clientY - previous.y;
    this.dragged += Math.abs(dx) + Math.abs(dy);
    if (this.dragged >= DRAG_PIXELS) this.setHover(null);
    let other: { x: number; y: number } | undefined;
    for (const [id, point] of this.pointer)
      if (id !== event.pointerId) {
        other = point;
        break;
      }
    if (other) {
      const before = Math.hypot(previous.x - other.x, previous.y - other.y),
        after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (after > 0)
        this.zoom(
          before / after,
          (event.clientX + other.x) / 2,
          (event.clientY + other.y) / 2,
          (before - after) * 3,
        );
      this.dragged = Infinity;
    } else this.rig.drag(dx, dy);
    previous.x = event.clientX;
    previous.y = event.clientY;
  }

  pointerUp(event: PointerEvent) {
    if (!this.pointer.has(event.pointerId)) return;
    const tap =
      this.dragged < DRAG_PIXELS &&
      this.pointer.size === 1 &&
      event.type === 'pointerup';
    this.pointer.delete(event.pointerId);
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
    if (tap) {
      const picked = this.pick(event.clientX, event.clientY);
      if (picked !== null) this.select(picked);
    }
    this.setCursor('grab');
  }

  /**
   * One wheel step. Trackpad pinches arrive as ctrl-wheel events with small
   * deltas; line-mode wheels (Firefox) report lines rather than pixels.
   */
  wheel(
    delta: number,
    clientX?: number,
    clientY?: number,
    options: { pinch?: boolean; lines?: boolean } = {},
  ) {
    if (!this.active || this.navigating) return;
    this.rig.wheel(delta, clientX, clientY, options);
  }

  /**
   * Continuous zoom toward the pointer (or the view's center).
   * @param factor goal distance multiplier; below 1 zooms in
   * @param overscroll outward input beyond the widest view, for leaving
   */
  zoom(factor: number, clientX?: number, clientY?: number, overscroll = 0) {
    if (!this.active || this.navigating) return;
    this.rig.zoom(factor, clientX, clientY, overscroll);
  }

  private pick(clientX: number, clientY: number) {
    if (!this.active || this.navigating) return null;
    const rect = this.canvas.getBoundingClientRect();
    let closest: number | null = null,
      distance = Infinity;
    const bodies = this.bodies;
    for (let index = 0; index < bodies.length; index++) {
      if (this.selected !== null && index !== this.selected) continue;
      const body = bodies[index];
      body.root.getWorldPosition(this.projected).project(this.camera);
      if (this.projected.z > 1) continue;
      const x = ((this.projected.x + 1) * rect.width) / 2 + rect.left,
        y = ((1 - this.projected.y) * rect.height) / 2 + rect.top;
      const pixels = screenRadius(
        body.recipe.radius,
        this.camera.position.distanceTo(body.root.position),
        rect.height,
        this.camera,
      );
      const d = Math.hypot(x - clientX, y - clientY);
      if (d < Math.max(20, pixels * 1.1) && d < distance) {
        closest = index;
        distance = d;
      }
    }
    return closest;
  }

  private setCursor(cursor: string) {
    if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;
  }

  private releasePointers() {
    this.pointer.forEach((_, id) => {
      if (this.canvas.hasPointerCapture(id))
        this.canvas.releasePointerCapture(id);
    });
    this.pointer.clear();
    this.setCursor('');
  }

  dispose() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.warmup.abort();
    this.setHover(null);
    this.overlay.dispose();
    this.releasePointers();
    if (this.active) this.restoreGalaxy();
    for (const resource of this.cache.values()) resource.dispose();
    this.cache.clear();
    this.preparation.dispose();
    this.current = null;
    this.system = this.recent = null;
    this.flight.dispose();
    this.ship.dispose();
    this.shipEnvironment?.dispose();
    this.group.removeFromParent();
    this.group.clear();
  }
}
