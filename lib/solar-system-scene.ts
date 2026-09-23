import * as THREE from 'three';
import type { PlanetRecipe, SolarSystem } from '../data/solar-systems';
import { PlanetPreparation, preparationTurn } from './planet-preparation';
import { SolarSystemResources, type SolarBody } from './solar-system-resources';
import { SolarShip } from './solar-ship';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type SolarPhase =
  | 'galaxy'
  | 'entering'
  | 'system'
  | 'planet'
  | 'leaving';
type SavedView = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  near: number;
  far: number;
  visibility: [THREE.Object3D, boolean][];
};
const EMPTY_BODIES: SolarBody[] = [];
const EMPTY_ORBITS: THREE.ShaderMaterial[] = [];
/**
 * Galaxy units per local system unit. A whole system spans roughly the
 * thickness of a spiral arm, so it resolves only once the camera is inside
 * that arm rather than floating over a third of the galaxy.
 */
export const GALAXY_UNIT = 0.0011;
const ENTRY_SECONDS = 2.4;
const SWITCH_SECONDS = 3;
const LEAVE_SECONDS = 1.8;
/** Log-distance per wheel pixel: roughly a dozen notches from world to overview. */
const WHEEL_ZOOM = 0.002;
/** Beyond this multiple of a world's close-up distance the view is the system again. */
const RELEASE_WORLD = 2.4;
/** Zooming in over a world within this multiple of its close-up distance lands on it. */
const CAPTURE_WORLD = 2.1;
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const wrapAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));

function flightDust() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 20),
    new THREE.ShaderMaterial({
      uniforms: {
        eye: { value: new THREE.Vector3() },
        time: { value: 0 },
        opacity: { value: 0 },
        tint: { value: new THREE.Color('#71639d') },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.BackSide,
      vertexShader: `varying vec3 p; void main(){p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 p; uniform vec3 eye; uniform float time; uniform float opacity; uniform vec3 tint;
      float hash(vec3 q){return fract(sin(dot(q,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 q){vec3 i=floor(q),f=fract(q); f=f*f*(3.-2.*f); return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 ray=normalize(p-eye); float b=dot(eye,ray); float d=b*b-dot(eye,eye)+1.; if(d<0.)discard;
        float start=max(0.,-b-sqrt(d)); float end=-b+sqrt(d); float density=0.;
        for(int i=0;i<6;i++){vec3 q=eye+ray*mix(start,end,(float(i)+.5)/6.); float n=noise(q*5.+vec3(time*.035,0.,0.)); density+=smoothstep(.28,.78,n)*(1.-smoothstep(.55,1.,length(q)));}
        float a=(1.-exp(-density*(end-start)*.75))*opacity;
        vec3 color=mix(tint*1.6,vec3(.62,.4,.62),smoothstep(-.4,.6,p.y))*(.7+density*.25);
        gl_FragColor=vec4(color,a); }`,
    }),
  );
}

/** One renderer, with an exactly projection-preserving change of units at arrival. */
export class SolarSystemScene {
  readonly group = new THREE.Group();
  phase: SolarPhase = 'galaxy';
  selected: number | null = null;
  system: SolarSystem | null = null;
  private readonly canvas: HTMLCanvasElement;
  private readonly preparation = new PlanetPreparation();
  private readonly cache = new Map<SolarSystem, SolarSystemResources>();
  private current: SolarSystemResources | null = null;
  private recent: SolarSystem | null = null;
  private flightPreparation = new AbortController();
  private saved: SavedView | null = null;
  private origin = new THREE.Vector3();
  private transitionFrom = new THREE.Vector3();
  private transitionQuaternion = new THREE.Quaternion();
  private transitionTime = 0;
  private transitionDuration = ENTRY_SECONDS;
  private switching = false;
  private fromDirection = new THREE.Vector3();
  private toDirection = new THREE.Vector3();
  private fromDistance = 1;
  private galaxyCenter = new THREE.Vector3();
  private arrivalTime = 0;
  private skyLevel = 0;
  /** 0 = galaxy decorations as usual; 1 = markers and core glare hidden for the dive. */
  galaxyVeil = 0;
  /** 0..1: the galaxy's own stars thin out just before the unit handoff. */
  galaxyFade = 0;
  private readonly ship = new SolarShip();
  private shipPark: number | null = null;
  private shipTarget = new THREE.Vector3();
  private scope: HTMLCanvasElement | null = null;
  /** Called when the reader keeps zooming out past the system overview. */
  onExitRequest: (() => void) | null = null;
  private overscroll = 0;
  private overscrollAt = 0;
  /** When the visible view first reached its widest; momentum there never exits. */
  private widestAt = 0;
  private shipHeading = 0;
  private shipEnvironment: THREE.Texture | null = null;
  private scopeSweep = 0;
  private localTime = 0;
  private visualTime = 0;
  private handedOff = false;
  // Goal pose: yaw/pitch/distance about a focus. The camera eases these as
  // spherical coordinates, so it always swings around its subject rather than
  // cutting across the system.
  private yaw = -0.32;
  private pitch = 0.62;
  private distance = 61;
  /** The overview's point of interest on the orbital plane; zoom steers it. */
  private focus = new THREE.Vector3();
  private viewYaw = -0.32;
  private viewPitch = 0.62;
  private viewDistance = 61;
  /** A flight between subjects rises by its remaining length, then settles. */
  private flying = false;
  private viewLift = 0;
  /** Distance scale at the last layout, so a resize keeps the reader's zoom. */
  private zoomBase = 1;
  /**
   * The world a zoom-in gesture began over. The camera eases behind the zoom
   * goal, so per-notch hit tests drift off a world during a quick flick;
   * the gesture keeps its first aim instead.
   */
  private zoomTarget: number | null = null;
  private zoomTargetAt = 0;
  private zoomTargetX = 0;
  private zoomTargetY = 0;
  private raycaster = new THREE.Raycaster();
  private orbitalPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private target = new THREE.Vector3();
  private desiredPosition = new THREE.Vector3();
  private desiredTarget = new THREE.Vector3();
  private projected = new THREE.Vector3();
  private scratchDirection = new THREE.Vector3();
  private transitionEnd = new THREE.Vector3();
  private lookQuaternion = new THREE.Quaternion();
  private pointer = new Map<number, { x: number; y: number }>();
  private dragged = 0;
  private autoPaused = false;
  private destroyed = false;
  private dust = flightDust();
  private flightAmbient = new THREE.HemisphereLight(0x899bc5, 0x171122, 0.62);
  private flightLight = new THREE.PointLight(0xffdfac, 3.8, 0, 0);
  private hovered: number | null = null;
  private labelsDirty = true;
  private layoutDirty = true;
  private labelObserver: MutationObserver;
  private resizeObserver: ResizeObserver;
  private host: HTMLElement;
  private preview: HTMLElement | null = null;
  private inspectorBounds: DOMRect | null = null;
  private previewWidth = 0;
  private previewHeight = 0;
  private previewX = 0;
  private previewY = 0;
  private hoverAnchorX = 0;
  private hoverAnchorY = 0;
  private previewOffsetX = 0;
  private previewOffsetY = 0;
  private canvasLeft = 0;
  private canvasTop = 0;
  private safeTop = 8;
  private safeBottom = 0;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private renderer: THREE.WebGLRenderer,
    private stage: HTMLElement,
    private onChange: (phase: SolarPhase, selected: number | null) => void,
    private onHover: (index: number | null) => void,
  ) {
    this.canvas = renderer.domElement;
    this.host = stage.parentElement ?? stage;
    this.group.name = 'Local solar system';
    this.group.visible = false;
    this.dust.renderOrder = 5;
    this.group.add(this.dust, this.flightAmbient, this.flightLight);
    this.ship.root.visible = false;
    this.group.add(this.ship.root);
    scene.add(this.group);
    this.labelObserver = new MutationObserver(() => {
      this.labelsDirty = this.layoutDirty = true;
    });
    this.labelObserver.observe(this.host, { childList: true, subtree: true });
    this.resizeObserver = new ResizeObserver(() => {
      this.layoutDirty = true;
    });
    this.resizeObserver.observe(this.canvas);
    void this.warmFlight();
  }

  get active() {
    return this.phase !== 'galaxy';
  }
  /** The galaxy camera position preserved for the return flight. */
  get savedPosition() {
    return this.saved?.position ?? null;
  }
  get navigating() {
    return this.phase === 'entering' || this.phase === 'leaving';
  }
  private get bodies() {
    return this.current?.bodies ?? EMPTY_BODIES;
  }
  private get orbitMaterials() {
    return this.current?.orbitMaterials ?? EMPTY_ORBITS;
  }

  private async warmFlight() {
    const staging = new THREE.Scene();
    const dust = new THREE.Mesh(this.dust.geometry, this.dust.material);
    staging.add(dust, new THREE.HemisphereLight(), new THREE.PointLight());
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 10);
    camera.position.z = 2;
    try {
      await preparationTurn(this.flightPreparation.signal);
      // Bake the ship's reflections once, while idle, then compile its lacquer
      // with them so its first appearance costs no shader work.
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      this.shipEnvironment = pmrem.fromScene(room, 0.04).texture;
      room.dispose();
      pmrem.dispose();
      this.ship.setEnvironment(this.shipEnvironment);
      await preparationTurn(this.flightPreparation.signal);
      staging.add(this.ship.root);
      const shipVisible = this.ship.root.visible;
      this.ship.root.visible = true;
      try {
        await this.renderer.compileAsync(staging, camera);
      } finally {
        // Compiled only; the ship never draws into the live frame from here.
        this.ship.root.visible =
          shipVisible || (this.active && this.handedOff && !this.navigating);
        this.group.add(this.ship.root);
      }
      await preparationTurn(this.flightPreparation.signal);
      const material = this.dust.material;
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
    this.switching = this.active;
    if (!this.active) {
      const visibility: SavedView['visibility'] = [];
      for (const child of this.scene.children)
        if (child !== this.group) {
          visibility.push([child, child.visible]);
          child.traverse((object) => {
            if (object !== child && object instanceof THREE.Light)
              visibility.push([object, object.visible]);
          });
        }
      this.saved = {
        position: this.camera.position.clone(),
        quaternion: this.camera.quaternion.clone(),
        near: this.camera.near,
        far: this.camera.far,
        visibility,
      };
    } else {
      this.toGalaxyUnits();
      this.showGalaxySurroundings();
    }
    this.setHover(null);
    this.releasePointers();
    if (this.current) {
      this.recent = this.current.system;
      this.current.setSkyOpacity(0);
    }
    this.current?.group.removeFromParent();
    this.current = null;
    this.system = system;
    this.origin.copy(origin);
    if (galaxyCenter) this.galaxyCenter.copy(galaxyCenter);
    this.selected = null;
    this.autoPaused = false;
    this.localTime =
      this.visualTime =
      this.transitionTime =
      this.arrivalTime =
        0;
    this.skyLevel = 0;
    this.shipPark = null;
    this.ship.root.visible = false;
    this.yaw = -0.32;
    this.pitch = this.camera.aspect < 1 ? 0.9 : 0.62;
    this.distance = this.zoomBase = this.overviewDistance();
    this.focus.set(0, 0, 0);
    this.flying = false;
    this.widestAt = 0;
    this.handedOff = false;
    this.transitionFrom.copy(this.camera.position);
    this.transitionQuaternion.copy(this.camera.quaternion);
    // Fly in log-distance about the destination star: every second covers the
    // same ratio of distance, so the dive reads as one continuous zoom.
    this.fromDirection.subVectors(this.camera.position, origin);
    this.fromDistance = Math.max(1e-4, this.fromDirection.length());
    this.fromDirection.divideScalar(this.fromDistance);
    this.transitionDuration = this.switching ? SWITCH_SECONDS : ENTRY_SECONDS;
    this.group.position.copy(origin);
    this.group.scale.setScalar(GALAXY_UNIT);
    this.group.visible = true;
    this.flightAmbient.visible = this.flightLight.visible = true;
    this.flightLight.color.set(system.star.color);
    this.dust.visible = true;
    this.dust.scale.setScalar(system.extent * 2.4);
    this.dust.material.uniforms.opacity.value = 0;
    this.dust.material.uniforms.tint.value.set(system.nebula[0]);
    this.camera.near = Math.min(
      this.saved?.near ?? 0.1,
      this.distance * GALAXY_UNIT * 0.02,
    );
    this.camera.updateProjectionMatrix();
    this.saved?.visibility.forEach(([object]) => {
      if (object instanceof THREE.Light) object.visible = false;
    });
    this.labelsDirty = true;
    // Report before scheduling a single byte of terrain work.
    this.report('entering');
    this.prepare(system);
  }

  private adoptReady() {
    if (this.current || !this.system) return;
    const resource = this.cache.get(this.system);
    if (!resource?.ready) return;
    this.current = resource;
    resource.starPosition.copy(this.group.position);
    this.scratchDirection.subVectors(this.galaxyCenter, this.origin);
    this.toDirection.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    resource.orientSky(this.scratchDirection, this.toDirection);
    resource.setSkyOpacity(0);
    this.group.add(resource.group);
    this.flightAmbient.visible = this.flightLight.visible = false;
    for (const material of resource.orbitMaterials)
      material.uniforms.focus.value = 1;
    this.labelsDirty = true;
  }

  private toLocalUnits() {
    this.camera.position.sub(this.origin).divideScalar(GALAXY_UNIT);
    this.target.sub(this.origin).divideScalar(GALAXY_UNIT);
    this.camera.near /= GALAXY_UNIT;
    this.camera.far = Math.max(
      this.camera.far / GALAXY_UNIT,
      (this.system?.extent ?? 40) * 20,
    );
    this.camera.updateProjectionMatrix();
    this.group.position.set(0, 0, 0);
    this.group.scale.setScalar(1);
    this.current?.starPosition.set(0, 0, 0);
    this.saved?.visibility.forEach(([child]) => {
      child.visible = false;
    });
    // Continue easing from wherever the flight actually left the camera.
    this.scratchDirection.subVectors(this.camera.position, this.target);
    this.viewDistance = Math.max(1e-3, this.scratchDirection.length());
    this.viewYaw = Math.atan2(this.scratchDirection.x, this.scratchDirection.z);
    this.viewPitch = Math.asin(
      THREE.MathUtils.clamp(this.scratchDirection.y / this.viewDistance, -1, 1),
    );
    this.viewLift = 0;
    this.handedOff = true;
  }

  private toGalaxyUnits() {
    if (!this.handedOff) return;
    this.camera.position.multiplyScalar(GALAXY_UNIT).add(this.origin);
    this.target.multiplyScalar(GALAXY_UNIT).add(this.origin);
    this.group.position.copy(this.origin);
    this.group.scale.setScalar(GALAXY_UNIT);
    this.current?.starPosition.copy(this.origin);
    this.camera.near *= GALAXY_UNIT;
    this.camera.far = this.saved?.far ?? 100;
    this.camera.updateProjectionMatrix();
    this.handedOff = false;
  }

  private showGalaxySurroundings() {
    this.saved?.visibility.forEach(([child, visible]) => {
      child.visible = child instanceof THREE.Light ? false : visible;
    });
  }

  exit() {
    if (!this.active || this.phase === 'leaving') return;
    this.setHover(null);
    this.releasePointers();
    this.toGalaxyUnits();
    this.showGalaxySurroundings();
    this.current?.setSkyOpacity(0);
    this.skyLevel = 0;
    this.ship.root.visible = false;
    this.transitionFrom.copy(this.camera.position);
    this.transitionQuaternion.copy(this.camera.quaternion);
    this.fromDirection.subVectors(this.camera.position, this.origin);
    this.fromDistance = Math.max(1e-4, this.fromDirection.length());
    this.fromDirection.divideScalar(this.fromDistance);
    this.transitionTime = 0;
    this.dust.visible = true;
    this.report('leaving');
    // A cancelled cold destination must not continue competing with galaxy input.
    for (const [key, resource] of this.cache)
      if (!resource.ready) {
        resource.dispose();
        this.cache.delete(key);
      }
  }

  private restoreGalaxy() {
    this.group.visible = false;
    this.ship.root.visible = false;
    this.saved?.visibility.forEach(([child, visible]) => {
      child.visible = visible;
    });
    if (this.saved) {
      this.camera.position.copy(this.saved.position);
      this.camera.quaternion.copy(this.saved.quaternion);
      this.camera.near = this.saved.near;
      this.camera.far = this.saved.far;
      this.camera.updateProjectionMatrix();
    }
    this.saved = null;
    this.selected = null;
    this.handedOff = false;
  }

  select(index: number | null) {
    if (!this.active || this.navigating) return;
    if (index !== null && !this.bodies[index]) return;
    this.setHover(null);
    this.flying = index !== this.selected;
    this.selected = index;
    this.highlightOrbits();
    if (index === null) {
      // Back out to the whole system from the current heading; no spin.
      this.focus.set(0, 0, 0);
      this.pitch = this.overviewPitch();
      this.distance = this.zoomBase = this.overviewDistance();
    } else {
      this.yaw =
        Math.atan2(
          -this.bodies[index].root.position.x,
          -this.bodies[index].root.position.z,
        ) + 0.55;
      this.pitch = 0.3;
      this.distance = this.zoomBase = this.focusDistance(
        this.bodies[index].recipe,
      );
      this.clearStar(this.bodies[index].root.position);
      // Take the turn that is nearest the current view, never the long way.
      this.yaw = this.viewYaw + wrapAngle(this.yaw - this.viewYaw);
    }
    this.report(index === null ? 'system' : 'planet');
  }

  /** Up close, a world's own orbit runs edge-on through it: hide that one. */
  private highlightOrbits() {
    const index = this.selected;
    this.orbitMaterials.forEach((material, orbit) => {
      material.uniforms.focus.value =
        index === null ? 1 : orbit === index ? 0 : 0.3;
    });
  }

  private overviewPitch() {
    return this.camera.aspect < 1 ? 0.9 : 0.62;
  }

  /**
   * The close-up looks from the sunlit side, but an inner world sits so near
   * its star that the star would fill the frame, or swallow the camera. Of the
   * poses that keep the whole star (and its inner glow) outside the view, take
   * the one nearest the current view so neighboring worlds need small turns.
   */
  private clearStar(planet: THREE.Vector3) {
    const radius = (this.system?.star.radius ?? 3.8) * 1.6;
    const base = Math.atan2(-planet.x, -planet.z);
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const halfWide = Math.atan(Math.tan(halfFov) * this.camera.aspect);
    // The frame's corners reach farther than either half-angle alone.
    const halfCorner = Math.atan(
      Math.hypot(Math.tan(halfFov), Math.tan(halfWide)),
    );
    let best = { yaw: base + 0.55, pitch: this.pitch, score: -Infinity };
    let nearest: { yaw: number; pitch: number; turn: number } | null = null;
    for (const pitch of [0.3, 0.55, 0.8, 1.05, 1.25])
      for (const offset of [0.55, 0.9, 1.3, -0.55, -0.9]) {
        const yaw = base + offset;
        const cx = planet.x + Math.sin(yaw) * Math.cos(pitch) * this.distance,
          cy = planet.y + Math.sin(pitch) * this.distance,
          cz = planet.z + Math.cos(yaw) * Math.cos(pitch) * this.distance;
        const toStar = Math.hypot(cx, cy, cz);
        if (toStar < radius * 1.3) continue;
        // Angle between the view axis (toward the world) and the star center.
        const vx = planet.x - cx,
          vy = planet.y - cy,
          vz = planet.z - cz;
        const cos =
          (vx * -cx + vy * -cy + vz * -cz) / (Math.hypot(vx, vy, vz) * toStar);
        const separation = Math.acos(THREE.MathUtils.clamp(cos, -1, 1));
        const score =
          separation - Math.asin(Math.min(1, radius / toStar)) - halfCorner;
        if (score > 0) {
          // Favor low, sunward poses; then the smallest turn from the view.
          const turn =
            Math.abs(wrapAngle(yaw - this.viewYaw)) +
            Math.abs(pitch - this.viewPitch) +
            pitch * 0.5 +
            (offset < 0 ? 0.4 : 0);
          if (!nearest || turn < nearest.turn) nearest = { yaw, pitch, turn };
        }
        if (score > best.score) best = { yaw, pitch, score };
      }
    const pose = nearest ?? best;
    this.yaw = pose.yaw;
    this.pitch = pose.pitch;
  }

  escape() {
    if (this.selected !== null && !this.navigating) this.select(null);
    else this.exit();
  }
  setPaused(paused: boolean) {
    this.autoPaused = paused;
  }

  private overviewDistance() {
    const extent = this.system?.extent ?? 40;
    // Frame the tilted orbital plane rather than the sphere containing its belts.
    return extent * 1.38 * Math.max(1, 0.8 / this.camera.aspect);
  }
  private focusDistance(planet: PlanetRecipe) {
    const ringRadius =
      this.bodies.find((body) => body.recipe === planet)?.footprint ??
      planet.radius;
    const width = this.canvas.clientWidth,
      height = this.canvas.clientHeight;
    const short = width > height && height <= 520;
    const portrait = width <= 720 && !short;
    const availableHeight = Math.max(
      100,
      height - (portrait ? 430 : short ? 110 : 200),
    );
    const availableWidth = Math.max(
      120,
      width -
        (portrait
          ? 48
          : short
            ? Math.min(420, width * 0.52)
            : Math.min(560, width * 0.44)),
    );
    const vertical = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const apparentRadius = planet.rings ? ringRadius : planet.radius * 1.12;
    return Math.max(
      (apparentRadius * 1.25) / ((vertical * availableHeight) / height),
      (apparentRadius * 1.25) /
        ((vertical * this.camera.aspect * availableWidth) / width),
    );
  }

  /** The distance a layout frames the current subject at: overview or close-up. */
  private layoutDistance() {
    return this.selected === null
      ? this.overviewDistance()
      : this.focusDistance(this.bodies[this.selected].recipe);
  }

  resize() {
    this.layoutDirty = true;
    if (!this.active) return;
    // Keep the reader's own zoom and heading; only the framing scale changes.
    const base = this.layoutDistance();
    const scale = base / Math.max(1e-6, this.zoomBase);
    this.distance *= scale;
    if (!this.navigating) this.viewDistance *= scale;
    this.zoomBase = base;
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
    for (let index = 0; index < this.bodies.length; index++) {
      const body = this.bodies[index];
      const angle =
        body.recipe.phase +
        (this.localTime * 0.028) / Math.sqrt(body.recipe.orbit);
      body.root.position.set(
        Math.cos(angle) * body.recipe.orbit,
        0,
        Math.sin(angle) * body.recipe.orbit,
      );
      const orbitMaterial = this.orbitMaterials[index];
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
    if (this.current?.sun && advance)
      (this.current.sun.material as THREE.ShaderMaterial).uniforms.time.value +=
        dt * 0.035;
    if (this.current?.corona)
      this.current.corona.scale.setScalar(
        this.current.coronaSize * (1 + Math.sin(this.visualTime * 0.7) * 0.012),
      );

    if (this.phase === 'entering') {
      this.transitionTime += elapsed;
      if (reduceMotion) {
        this.galaxyVeil = 1;
        if (this.current) {
          this.target.copy(this.origin);
          if (!this.handedOff) this.toLocalUnits();
          this.moveCamera(dt, true);
          this.dust.visible = false;
          this.arrive();
        }
      } else if (!this.handedOff) {
        const progress = Math.min(
          1,
          this.transitionTime / this.transitionDuration,
        );
        const eased = smooth(progress);
        this.flightFrame(eased, this.distance * GALAXY_UNIT);
        // A system switch pulls back into the galaxy mid-hop before diving again.
        if (this.switching)
          this.camera.position
            .sub(this.origin)
            .multiplyScalar(1 + Math.sin(eased * Math.PI) * 5)
            .add(this.origin);
        this.skirtCore(eased);
        this.camera.lookAt(this.origin);
        this.lookQuaternion.copy(this.camera.quaternion);
        const turn = Math.min(1, progress / 0.45);
        this.camera.quaternion.slerpQuaternions(
          this.transitionQuaternion,
          this.lookQuaternion,
          turn * turn * (3 - 2 * turn),
        );
        this.target.copy(this.origin);
        this.galaxyVeil = THREE.MathUtils.smoothstep(progress, 0, 0.4);
        this.galaxyFade = THREE.MathUtils.smoothstep(progress, 0.72, 0.99);
        // Dust gathers only in the last stretch, as the camera enters the arm.
        this.dust.material.uniforms.opacity.value =
          0.55 * THREE.MathUtils.smoothstep(progress, 0.55, 0.97);
        if (this.current && progress >= 1) {
          this.toLocalUnits();
          this.arrivalTime = 0;
          this.launchShip();
        }
      } else {
        this.arrivalTime += elapsed;
        this.moveCamera(elapsed, false);
        const clear = Math.min(1, this.arrivalTime / 0.9);
        this.dust.material.uniforms.opacity.value = 0.55 * (1 - smooth(clear));
        this.skyLevel = smooth(clear);
        if (clear >= 1) {
          this.dust.visible = false;
          this.arrive();
        }
      }
    } else if (this.phase === 'leaving') {
      this.transitionTime += elapsed;
      const progress = reduceMotion
        ? 1
        : Math.min(1, this.transitionTime / LEAVE_SECONDS);
      const eased = smooth(progress);
      if (this.saved) {
        // Retrace the log-distance dive back to the preserved galaxy view.
        this.toDirection.subVectors(this.saved.position, this.origin);
        const outDistance = Math.max(1e-6, this.toDirection.length());
        this.toDirection.divideScalar(outDistance);
        this.scratchDirection
          .copy(this.fromDirection)
          .lerp(this.toDirection, eased)
          .normalize();
        this.camera.position
          .copy(this.scratchDirection)
          .multiplyScalar(
            Math.exp(
              THREE.MathUtils.lerp(
                Math.log(this.fromDistance),
                Math.log(outDistance),
                eased,
              ),
            ),
          )
          .add(this.origin);
        this.skirtCore(eased);
        this.camera.quaternion.slerpQuaternions(
          this.transitionQuaternion,
          this.saved.quaternion,
          eased,
        );
      }
      this.galaxyVeil = 1 - THREE.MathUtils.smoothstep(progress, 0.35, 0.9);
      this.galaxyFade = 1 - THREE.MathUtils.smoothstep(progress, 0.02, 0.3);
      this.dust.material.uniforms.opacity.value =
        (1 - THREE.MathUtils.smoothstep(progress, 0.05, 0.45)) * 0.7;
      if (progress === 1) {
        this.restoreGalaxy();
        this.galaxyVeil = this.galaxyFade = 0;
        this.report('galaxy');
      }
    } else this.moveCamera(dt, reduceMotion);
    if (this.current && this.handedOff) {
      if (this.phase !== 'entering') this.skyLevel = 1;
      this.current.setSkyOpacity(this.skyLevel);
    }
    if (this.handedOff && this.phase !== 'leaving')
      this.updateShip(dt, reduceMotion, advance);
    if (this.dust.visible) {
      this.group.updateMatrixWorld(true);
      this.dust.material.uniforms.eye.value.copy(this.camera.position);
      this.dust.worldToLocal(this.dust.material.uniforms.eye.value);
      this.dust.material.uniforms.time.value = this.transitionTime;
    }
    this.updateLabels();
    this.drawScope(dt, advance);
  }

  /** Position the camera on the log-distance path toward the destination star. */
  private flightFrame(eased: number, endDistance: number) {
    this.toDirection
      .set(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch),
      )
      .normalize();
    this.scratchDirection
      .copy(this.fromDirection)
      .lerp(this.toDirection, smooth(Math.min(1, eased * 1.15)))
      .normalize();
    const distance = Math.exp(
      THREE.MathUtils.lerp(
        Math.log(this.fromDistance),
        Math.log(endDistance),
        eased,
      ),
    );
    this.camera.position
      .copy(this.scratchDirection)
      .multiplyScalar(distance)
      .add(this.origin);
  }

  /**
   * Flights between a far-side star and the galaxy view would pass straight
   * through the blazing core. Bend the path around it; the weight vanishes at
   * both ends, so departure and arrival poses are exact.
   */
  private skirtCore(eased: number) {
    const keep = 10;
    this.scratchDirection.subVectors(this.camera.position, this.galaxyCenter);
    const distance = this.scratchDirection.length();
    if (distance >= keep) return;
    if (distance < 1e-4) this.scratchDirection.set(0, 1, 0);
    else this.scratchDirection.divideScalar(distance);
    const clear = keep * (0.8 + 0.2 * (distance / keep) ** 2);
    const reach =
      distance + (clear - distance) * Math.sin(Math.PI * Math.min(1, eased));
    this.camera.position
      .copy(this.scratchDirection)
      .multiplyScalar(reach)
      .add(this.galaxyCenter);
  }

  private arrive() {
    this.skyLevel = 1;
    this.galaxyVeil = 1;
    if (!this.ship.root.visible) this.launchShip();
    this.report('system');
  }

  /** The scout arrives with the camera, then settles beside the star. */
  private launchShip() {
    if (!this.system) return;
    this.ship.root.visible = true;
    this.shipPark = null;
    this.scratchDirection.copy(this.camera.position).multiplyScalar(0.55);
    this.ship.place(this.scratchDirection);
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
      const yaw = this.viewYaw;
      this.shipTarget.set(
        Math.cos(yaw) * star * 3.2 + Math.sin(yaw) * star * 1.4,
        star * 1.5,
        -Math.sin(yaw) * star * 3.2 + Math.cos(yaw) * star * 1.4,
      );
    }
    this.ship.update(dt, this.shipTarget, beam, size, reduceMotion, animate);
  }

  private moveCamera(dt: number, reduceMotion: boolean) {
    const body = this.selected === null ? null : this.bodies[this.selected];
    if (body) this.desiredTarget.copy(body.root.position);
    else this.desiredTarget.copy(this.focus);
    if (body) {
      const short =
        this.canvas.clientWidth > this.canvas.clientHeight &&
        this.canvas.clientHeight <= 520;
      const portrait = this.canvas.clientWidth <= 720 && !short;
      const halfHeight =
        this.viewDistance *
        Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      // Shift in camera-plane coordinates, so framing survives dragging around a world.
      // Frame the world left of center; its comms casing docks on the right.
      const horizontal = portrait ? 0 : short ? 0.26 : 0.24;
      // Only the corners of the bottom edge carry HUD now, so a short
      // landscape needs just a small lift to clear the helm.
      const vertical = portrait
        ? -Math.min(0.62, 288 / this.canvas.clientHeight)
        : short
          ? -0.1
          : -0.02;
      this.desiredTarget.x +=
        Math.cos(this.viewYaw) * horizontal * halfHeight * this.camera.aspect;
      this.desiredTarget.z -=
        Math.sin(this.viewYaw) * horizontal * halfHeight * this.camera.aspect;
      this.desiredTarget.y += Math.cos(this.viewPitch) * vertical * halfHeight;
      this.desiredTarget.x -=
        Math.sin(this.viewYaw) *
        Math.sin(this.viewPitch) *
        vertical *
        halfHeight;
      this.desiredTarget.z -=
        Math.cos(this.viewYaw) *
        Math.sin(this.viewPitch) *
        vertical *
        halfHeight;
    }
    // Ease heading, tilt and log-distance about an eased subject. Unlike
    // easing the camera's position, this can never cut through the system.
    const blend = reduceMotion ? 1 : 1 - Math.exp(-dt * 4.2);
    this.viewYaw += wrapAngle(this.yaw - this.viewYaw) * blend;
    this.viewPitch += (this.pitch - this.viewPitch) * blend;
    this.viewDistance = Math.exp(
      THREE.MathUtils.lerp(
        Math.log(this.viewDistance),
        Math.log(this.distance),
        blend,
      ),
    );
    // Leaving by zoom counts only from when the widest view is actually shown.
    if (
      this.selected === null &&
      this.viewDistance >= this.overviewDistance() * 1.85 * 0.97
    )
      this.widestAt ||= performance.now();
    else this.widestAt = 0;
    this.target.lerp(this.desiredTarget, blend);
    // A flight between subjects rises with the ground it still has to cover,
    // looking down over the system instead of skimming through it.
    const remaining = this.target.distanceTo(this.desiredTarget);
    if (this.flying && remaining < this.viewDistance * 0.01)
      this.flying = false;
    this.viewLift +=
      ((this.flying ? remaining * 0.55 : 0) - this.viewLift) * blend;
    this.desiredPosition
      .set(
        Math.sin(this.viewYaw) * Math.cos(this.viewPitch),
        Math.sin(this.viewPitch),
        Math.cos(this.viewYaw) * Math.cos(this.viewPitch),
      )
      .multiplyScalar(this.viewDistance + this.viewLift)
      .add(this.target);
    this.camera.position.copy(this.desiredPosition);
    this.camera.lookAt(this.target);
    if (this.handedOff) {
      // Near clipping follows the zoom, so close worlds and moons never clip.
      const near = THREE.MathUtils.clamp(this.viewDistance * 0.01, 0.01, 4);
      if (Math.abs(near - this.camera.near) > this.camera.near * 0.05) {
        this.camera.near = near;
        this.camera.updateProjectionMatrix();
      }
    }
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
    if (this.preview) this.preview.style.visibility = 'hidden';
    this.onHover(index);
  }

  private measureChrome() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvasLeft = rect.left;
    this.canvasTop = rect.top;
    this.safeTop = 8;
    this.safeBottom = rect.height - 8;
    // The HUD's helm and worlds tray dock along the bottom edge.
    for (const part of this.host.querySelectorAll<HTMLElement>(
      '.solar-helm, .solar-deck',
    )) {
      const tray = part.getBoundingClientRect();
      if (!tray.height) continue;
      this.safeBottom = Math.min(this.safeBottom, tray.top - rect.top - 8);
      this.resizeObserver.observe(part);
    }
    const inspector = this.host.querySelector<HTMLElement>('.solar-comms');
    this.inspectorBounds = inspector?.getBoundingClientRect() ?? null;
    if (inspector) this.resizeObserver.observe(inspector);
    if (this.preview) {
      const parent =
        (
          this.preview.offsetParent as HTMLElement | null
        )?.getBoundingClientRect() ?? rect;
      this.previewOffsetX = rect.left - parent.left;
      this.previewOffsetY = rect.top - parent.top;
      const available = Math.max(64, this.safeBottom - this.safeTop);
      this.preview.style.maxHeight = `${available}px`;
      this.preview.style.overflowY = 'auto';
      const bounds = this.preview.getBoundingClientRect();
      this.previewWidth = bounds.width;
      this.previewHeight = Math.min(bounds.height, available);
      this.resizeObserver.observe(this.preview);
    }
    this.layoutDirty = false;
  }

  private updateLabels() {
    const width = this.canvas.clientWidth,
      height = this.canvas.clientHeight;
    this.group.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    if (this.labelsDirty) {
      this.resizeObserver.disconnect();
      this.resizeObserver.observe(this.canvas);
      this.scope = this.host.querySelector<HTMLCanvasElement>(
        'canvas[data-solar-scope]',
      );
      this.preview = this.host.querySelector<HTMLElement>(
        '[data-solar-preview]',
      );
      this.labelsDirty = false;
      this.layoutDirty = true;
    }
    if (this.layoutDirty) this.measureChrome();
    // As in Spore, worlds carry no standing labels: a name appears on hover.
    if (this.hovered !== null && this.bodies[this.hovered])
      this.placePreview(this.hovered, width, height);
  }

  /** Attach the hover card beside its world, clear of the HUD. */
  private placePreview(index: number, width: number, height: number) {
    const body = this.bodies[index];
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
    if (!this.preview || Number(this.preview.dataset.planetIndex) !== index)
      return;
    this.hoverAnchorX = x;
    this.hoverAnchorY = y;
    // Where the card's world sits on the canvas; with no standing labels this
    // is the one DOM record of a world's screen position.
    const anchor = `${Math.round(x)} ${Math.round(y)}`;
    if (this.preview.dataset.anchor !== anchor)
      this.preview.dataset.anchor = anchor;
    const radius =
      (body.recipe.radius * height) /
      (2 *
        Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) *
        this.camera.position.distanceTo(body.root.position));
    const right = x + radius + 16;
    const preferredX =
      right + this.previewWidth < width - 8
        ? right
        : x - radius - 16 - this.previewWidth;
    this.previewX = THREE.MathUtils.clamp(
      preferredX,
      8,
      Math.max(8, width - this.previewWidth - 8),
    );
    this.previewY = THREE.MathUtils.clamp(
      y - this.previewHeight * 0.45,
      this.safeTop,
      Math.max(this.safeTop, this.safeBottom - this.previewHeight),
    );
    // The short-landscape inspector floats beside, rather than inside, the
    // footer's measured box. Keep the transmission clear of that second panel.
    const inspector = this.inspectorBounds;
    if (
      inspector &&
      this.previewX + this.canvasLeft < inspector.right + 8 &&
      this.previewX + this.canvasLeft + this.previewWidth >
        inspector.left - 8 &&
      this.previewY + this.canvasTop < inspector.bottom + 8 &&
      this.previewY + this.canvasTop + this.previewHeight > inspector.top - 8
    ) {
      const above = inspector.top - this.canvasTop - 8 - this.previewHeight;
      const left = inspector.left - this.canvasLeft - 8 - this.previewWidth;
      if (above >= this.safeTop) this.previewY = above;
      else if (left >= 8) this.previewX = left;
    }
    this.preview.style.transform = `translate(${this.previewX + this.previewOffsetX}px, ${this.previewY + this.previewOffsetY}px)`;
    this.preview.style.visibility = 'visible';
  }

  private inPreviewBridge(clientX: number, clientY: number) {
    if (
      this.hovered === null ||
      !this.preview ||
      this.preview.style.visibility !== 'visible'
    )
      return false;
    const x = clientX - this.canvasLeft,
      y = clientY - this.canvasTop;
    if (
      x >= this.previewX - 24 &&
      x <= this.previewX + this.previewWidth + 24 &&
      y >= this.previewY - 24 &&
      y <= this.previewY + this.previewHeight + 24
    )
      return true;
    const endX = THREE.MathUtils.clamp(
      this.hoverAnchorX,
      this.previewX,
      this.previewX + this.previewWidth,
    );
    const endY = THREE.MathUtils.clamp(
      this.hoverAnchorY,
      this.previewY,
      this.previewY + this.previewHeight,
    );
    const dx = endX - this.hoverAnchorX,
      dy = endY - this.hoverAnchorY;
    const lengthSquared = dx * dx + dy * dy;
    const along = lengthSquared
      ? THREE.MathUtils.clamp(
          ((x - this.hoverAnchorX) * dx + (y - this.hoverAnchorY) * dy) /
            lengthSquared,
          0,
          1,
        )
      : 0;
    return (
      Math.hypot(
        x - this.hoverAnchorX - dx * along,
        y - this.hoverAnchorY - dy * along,
      ) <= 24
    );
  }

  pointerDown(event: PointerEvent) {
    if (!this.active || this.navigating || event.button !== 0) return;
    if (!this.pointer.size) this.dragged = 0;
    this.pointer.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.style.cursor = 'grabbing';
  }

  pointerMove(event: PointerEvent) {
    const previous = this.pointer.get(event.pointerId);
    if (!previous) {
      const picked = this.pick(event.clientX, event.clientY);
      if (
        picked !== null ||
        !this.inPreviewBridge(event.clientX, event.clientY)
      )
        this.setHover(picked);
      this.canvas.style.cursor = picked === null ? 'grab' : 'pointer';
      return;
    }
    const dx = event.clientX - previous.x,
      dy = event.clientY - previous.y;
    this.dragged += Math.abs(dx) + Math.abs(dy);
    if (this.dragged >= 7) this.setHover(null);
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
    } else {
      this.yaw -= dx * 0.006;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, 0.12, 1.3);
    }
    previous.x = event.clientX;
    previous.y = event.clientY;
  }

  pointerUp(event: PointerEvent) {
    if (!this.pointer.has(event.pointerId)) return;
    const tap =
      this.dragged < 7 && this.pointer.size === 1 && event.type === 'pointerup';
    this.pointer.delete(event.pointerId);
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
    if (tap) {
      const picked = this.pick(event.clientX, event.clientY);
      if (picked !== null) this.select(picked);
    }
    this.canvas.style.cursor = 'grab';
  }

  /**
   * Zooming out past the widest overview leaves for the galaxy, as in Spore.
   * Only once the view has visibly settled there: momentum that carried the
   * reader to the edge never also carries them out of the system.
   */
  private pushOut(amount: number) {
    const now = performance.now();
    if (!this.widestAt || now - this.widestAt < 350) return;
    if (now - this.overscrollAt > 450) this.overscroll = 0;
    this.overscrollAt = now;
    this.overscroll += amount;
    if (this.overscroll < 260) return;
    this.overscroll = 0;
    this.onExitRequest?.();
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
    if (this.navigating) return;
    let pixels = options.lines ? delta * 16 : delta;
    if (options.pinch) pixels *= 4;
    pixels = THREE.MathUtils.clamp(pixels, -120, 120);
    this.zoom(Math.exp(pixels * WHEEL_ZOOM), clientX, clientY, pixels);
  }

  /** The point on the orbital plane under a screen position, if any. */
  private groundAt(clientX: number, clientY: number, into: THREE.Vector3) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    return this.raycaster.ray.intersectPlane(this.orbitalPlane, into);
  }

  /**
   * Continuous zoom, as in Spore: toward whatever is under the pointer (or
   * the view's center), down onto a world and back out to the system, then
   * out to the galaxy. There are no fixed stops between those views.
   * @param factor goal distance multiplier; below 1 zooms in
   * @param overscroll outward input beyond the widest view, for leaving
   */
  zoom(factor: number, clientX?: number, clientY?: number, overscroll = 0) {
    if (!this.active || this.navigating || !this.system || factor === 1) return;
    if (factor < 1) this.overscroll = 0;
    const next = this.distance * factor;
    if (this.selected !== null) {
      const base = this.focusDistance(this.bodies[this.selected].recipe);
      if (factor <= 1 || next < base * RELEASE_WORLD) {
        this.distance = Math.max(base * 0.56, next);
        return;
      }
      // Zoomed out past the world: the system takes over from here, still
      // centered on the world, so the view keeps widening without a jump.
      this.focus.copy(this.bodies[this.selected].root.position);
      this.selected = null;
      this.flying = false;
      this.highlightOrbits();
      this.zoomBase = this.overviewDistance();
      this.report('system');
    }
    const overview = this.overviewDistance();
    const widest = overview * 1.85;
    if (factor > 1) {
      if (this.distance >= widest * 0.999) {
        this.pushOut(Math.max(0, overscroll));
        return;
      }
      const wider = Math.min(next, widest);
      // Drift back toward the star, arriving exactly as the whole system fits.
      const span = Math.log(overview) - Math.log(this.distance);
      const settle =
        span <= 0
          ? 1
          : THREE.MathUtils.clamp(
              (Math.log(wider) - Math.log(this.distance)) / span,
              0,
              1,
            );
      this.focus.multiplyScalar(1 - settle);
      this.distance = wider;
      this.widestAt = 0;
      return;
    }
    // Zooming in keeps the ground under the pointer where it is on screen.
    const closest = this.system.star.radius * 3;
    const closer = Math.max(closest, next);
    const anchor =
      clientX === undefined || clientY === undefined
        ? null
        : this.groundAt(clientX, clientY, this.scratchDirection);
    if (anchor) {
      const scale = closer / this.distance;
      this.focus.sub(anchor).multiplyScalar(scale).add(anchor);
      const reach = this.system.extent * 1.05;
      if (this.focus.length() > reach) this.focus.setLength(reach);
      this.focus.y = 0;
    }
    this.distance = closer;
    this.widestAt = 0;
    // Close enough over a world: glide down onto it without a turn.
    if (clientX === undefined || clientY === undefined) return;
    const now = performance.now();
    if (
      now - this.zoomTargetAt > 400 ||
      Math.hypot(clientX - this.zoomTargetX, clientY - this.zoomTargetY) > 24
    ) {
      this.zoomTarget = this.pick(clientX, clientY);
      this.zoomTargetX = clientX;
      this.zoomTargetY = clientY;
    }
    this.zoomTargetAt = now;
    const world = this.zoomTarget;
    if (world === null || !this.bodies[world]) return;
    const base = this.focusDistance(this.bodies[world].recipe);
    // Small worlds capture beyond the system zoom's floor; reaching the floor
    // over one still lands on it.
    if (closer > base * CAPTURE_WORLD && closer > closest * 1.001) return;
    this.zoomTarget = null;
    this.setHover(null);
    this.selected = world;
    this.flying = false;
    this.highlightOrbits();
    this.distance = Math.max(
      base * 0.56,
      Math.min(closer, base * CAPTURE_WORLD),
    );
    this.zoomBase = base;
    this.report('planet');
  }

  private pick(clientX: number, clientY: number) {
    if (!this.active || this.navigating) return null;
    const rect = this.canvas.getBoundingClientRect();
    let closest: number | null = null,
      distance = Infinity;
    this.bodies.forEach((body, index) => {
      if (this.selected !== null && index !== this.selected) return;
      body.root.getWorldPosition(this.projected).project(this.camera);
      if (this.projected.z > 1) return;
      const x = ((this.projected.x + 1) * rect.width) / 2 + rect.left,
        y = ((1 - this.projected.y) * rect.height) / 2 + rect.top;
      const pixels =
        ((body.recipe.radius /
          this.camera.position.distanceTo(body.root.position)) *
          rect.height) /
        (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
      const d = Math.hypot(x - clientX, y - clientY);
      if (d < Math.max(20, pixels * 1.1) && d < distance) {
        closest = index;
        distance = d;
      }
    });
    return closest;
  }

  /** Radar distance: square-root radial scale keeps inner worlds apart. */
  private scopeRadius(distance: number, radius: number) {
    const extent = this.system?.extent ?? 40;
    return Math.sqrt(Math.min(1, distance / extent)) * radius * 0.9;
  }

  /** Radar coordinates: the view's forward direction is always up. */
  private scopePoint(x: number, z: number, radius: number) {
    const distance = Math.hypot(x, z) || 1;
    const k = this.scopeRadius(distance, radius) / distance;
    const sin = Math.sin(this.viewYaw),
      cos = Math.cos(this.viewYaw);
    return {
      x: radius + (x * cos - z * sin) * k,
      y: radius + (x * sin + z * cos) * k,
    };
  }

  /** A live top-down scope of the system, drawn into the HUD's radar canvas. */
  private drawScope(dt: number, animate: boolean) {
    const canvas = this.scope;
    if (!canvas || !this.system || !canvas.isConnected) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const size = canvas.width;
    const r = size / 2;
    const px = size / Math.max(1, canvas.clientWidth);
    g.clearRect(0, 0, size, size);
    g.save();
    g.beginPath();
    g.arc(r, r, r - px, 0, Math.PI * 2);
    g.clip();
    if (animate) this.scopeSweep = (this.scopeSweep + dt * 1.1) % (Math.PI * 2);
    const sweep = g.createConicGradient(this.scopeSweep - Math.PI / 2, r, r);
    sweep.addColorStop(0, 'rgba(120,255,190,0.22)');
    sweep.addColorStop(0.1, 'rgba(120,255,190,0)');
    sweep.addColorStop(1, 'rgba(120,255,190,0)');
    g.fillStyle = sweep;
    g.fillRect(0, 0, size, size);
    g.lineWidth = px;
    for (const body of this.bodies) {
      g.beginPath();
      g.arc(r, r, this.scopeRadius(body.recipe.orbit, r), 0, Math.PI * 2);
      g.strokeStyle = 'rgba(150,215,235,0.2)';
      g.stroke();
    }
    for (const belt of this.system.belts) {
      g.beginPath();
      g.arc(
        r,
        r,
        this.scopeRadius((belt.inner + belt.outer) / 2, r),
        0,
        Math.PI * 2,
      );
      g.setLineDash([px * 1.5, px * 2.5]);
      g.strokeStyle = 'rgba(210,190,160,0.28)';
      g.stroke();
      g.setLineDash([]);
    }
    const star = g.createRadialGradient(r, r, 0, r, r, r * 0.12);
    star.addColorStop(0, '#fffbe8');
    star.addColorStop(0.4, this.system.star.color);
    star.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = star;
    g.fillRect(r * 0.85, r * 0.85, r * 0.3, r * 0.3);
    this.bodies.forEach((body, index) => {
      const p = this.scopePoint(body.root.position.x, body.root.position.z, r);
      const dot = Math.max(
        2.4 * px,
        Math.min(6 * px, body.recipe.radius * 2.2 * px),
      );
      const focused = index === this.hovered || index === this.selected;
      if (focused) {
        g.beginPath();
        g.arc(p.x, p.y, dot + 4 * px, 0, Math.PI * 2);
        g.strokeStyle = index === this.selected ? '#ffe16a' : '#b7f58e';
        g.lineWidth = 1.5 * px;
        g.stroke();
        g.lineWidth = px;
      }
      g.beginPath();
      g.arc(p.x, p.y, dot, 0, Math.PI * 2);
      g.fillStyle = body.recipe.atmosphere;
      g.fill();
    });
    if (this.ship.root.visible) {
      const p = this.scopePoint(
        this.ship.root.position.x,
        this.ship.root.position.z,
        r,
      );
      // The blip points along the ship's course, eased so it turns, not snaps.
      const v = this.ship.velocity;
      const speed = Math.hypot(v.x, v.z);
      if (speed > this.ship.size * 0.4) {
        const sin = Math.sin(this.viewYaw),
          cos = Math.cos(this.viewYaw);
        const course = Math.atan2(
          v.x * cos - v.z * sin,
          -(v.x * sin + v.z * cos),
        );
        const turn = Math.atan2(
          Math.sin(course - this.shipHeading),
          Math.cos(course - this.shipHeading),
        );
        this.shipHeading += turn * Math.min(1, dt * 10);
      }
      g.save();
      g.translate(p.x, p.y);
      g.rotate(this.shipHeading);
      g.fillStyle = '#e9fbff';
      g.beginPath();
      g.moveTo(0, -4.5 * px);
      g.lineTo(3.5 * px, 3.5 * px);
      g.lineTo(0, 1.8 * px);
      g.lineTo(-3.5 * px, 3.5 * px);
      g.closePath();
      g.fill();
      g.restore();
    }
    g.restore();
  }

  /** The world under a point on the radar, if any. */
  pickScope(clientX: number, clientY: number) {
    const canvas = this.scope;
    if (!canvas || !this.active || this.navigating) return null;
    const rect = canvas.getBoundingClientRect();
    const r = rect.width / 2;
    let closest: number | null = null,
      best = 14;
    this.bodies.forEach((body, index) => {
      const p = this.scopePoint(body.root.position.x, body.root.position.z, r);
      const d = Math.hypot(
        p.x - (clientX - rect.left),
        p.y - (clientY - rect.top),
      );
      if (d < best) {
        best = d;
        closest = index;
      }
    });
    return closest;
  }

  private releasePointers() {
    this.pointer.forEach((_, id) => {
      if (this.canvas.hasPointerCapture(id))
        this.canvas.releasePointerCapture(id);
    });
    this.pointer.clear();
    this.canvas.style.cursor = '';
  }

  dispose() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.flightPreparation.abort();
    this.setHover(null);
    this.labelObserver.disconnect();
    this.resizeObserver.disconnect();
    this.releasePointers();
    if (this.active) this.restoreGalaxy();
    for (const resource of this.cache.values()) resource.dispose();
    this.cache.clear();
    this.preparation.dispose();
    this.current = null;
    this.system = this.recent = null;
    this.dust.geometry.dispose();
    this.dust.material.dispose();
    this.ship.dispose();
    this.shipEnvironment?.dispose();
    this.group.removeFromParent();
    this.group.clear();
  }
}
