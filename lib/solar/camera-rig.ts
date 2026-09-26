import * as THREE from 'three';
import type { SolarSystem } from '../../data/solar-systems';
import {
  clearStarPose,
  closeUpOffset,
  fitOverview,
  focusDistance,
  overviewDistance,
  overviewPitch,
  type ScreenRect,
  type Viewport,
} from './framing';
import {
  CAPTURE_WORLD,
  CLOSEST_WORLD,
  ENTRY_YAW,
  RELEASE_WORLD,
  WHEEL_ZOOM,
  WIDEST_VIEW,
  halfViewHeight,
  orbitDirection,
  wrapAngle,
} from './math';
import type { SolarBody } from './bodies';

/** What the rig reads from, and reports back to, the scene that owns it. */
export interface RigHost {
  readonly system: SolarSystem | null;
  readonly bodies: readonly SolarBody[];
  readonly selected: number | null;
  /** True once the camera works in local system units. */
  readonly handedOff: boolean;
  readonly viewport: Viewport;
  /** The ship HUD's parts; `version` changes whenever they move. */
  readonly hud: {
    readonly rects: readonly ScreenRect[];
    readonly version: number;
  };
  /** The world under a screen point, if any. */
  pick(clientX: number, clientY: number): number | null;
  /** Zooming out left the selected world for the system view. */
  releaseWorld(): void;
  /** Zooming in landed on a world. */
  captureWorld(index: number): void;
  /** Zooming out kept going past the widest view. */
  requestExit(): void;
}

/**
 * The in-system camera. A goal pose (yaw, pitch and distance about a subject)
 * that the view eases toward as spherical coordinates, so it always swings
 * around its subject rather than cutting across the system.
 */
export class CameraRig {
  yaw = ENTRY_YAW;
  pitch = 0.62;
  distance = 61;
  /** The point the eased view looks at. */
  readonly target = new THREE.Vector3();
  /** The overview's point of interest on the orbital plane; zoom steers it. */
  private focus = new THREE.Vector3();
  private viewYaw = ENTRY_YAW;
  private viewPitch = 0.62;
  private viewDistance = 61;
  /** A flight between subjects rises by its remaining length, then settles. */
  flying = false;
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
  private overscroll = 0;
  private overscrollAt = 0;
  /** When the visible view first reached its widest; momentum there never exits. */
  private widestAt = 0;
  private readonly raycaster = new THREE.Raycaster();
  private readonly orbitalPlane = new THREE.Plane(
    new THREE.Vector3(0, 1, 0),
    0,
  );
  private readonly pointer = new THREE.Vector2();
  private readonly ground = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private readonly desiredTarget = new THREE.Vector3();
  /** The overview fit, recomputed only when the system, view or HUD changes. */
  private fit = { distance: 1, lift: 0 };
  private fitSystem: SolarSystem | null | undefined = undefined;
  private fitVersion = -1;
  private fitWidth = 0;
  private fitHeight = 0;
  private fitAspect = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
    private readonly host: RigHost,
  ) {}

  /** The heading the eased view currently faces; the radar turns with it. */
  get heading() {
    return this.viewYaw;
  }

  overviewDistance() {
    return this.overviewFit().distance;
  }

  /** How the overview frames the whole system around the ship HUD. */
  private overviewFit() {
    const { system, viewport, hud } = this.host;
    const aspect = this.camera.aspect;
    if (
      this.fitSystem !== system ||
      this.fitVersion !== hud.version ||
      this.fitWidth !== viewport.width ||
      this.fitHeight !== viewport.height ||
      this.fitAspect !== aspect
    ) {
      this.fit = fitOverview({
        radius: system?.frame ?? 40,
        minDistance: overviewDistance(system, aspect),
        pitch: overviewPitch(aspect),
        camera: this.camera,
        viewport,
        obstacles: hud.rects,
      });
      this.fitSystem = system;
      this.fitVersion = hud.version;
      this.fitWidth = viewport.width;
      this.fitHeight = viewport.height;
      this.fitAspect = aspect;
    }
    return this.fit;
  }

  private focusDistance(body: SolarBody) {
    return focusDistance(
      body.recipe,
      body.footprint,
      this.host.viewport,
      this.camera,
    );
  }

  /** The distance a layout frames the current subject at: overview or close-up. */
  private layoutDistance() {
    const { selected, bodies } = this.host;
    return selected === null
      ? this.overviewDistance()
      : this.focusDistance(bodies[selected]);
  }

  /** The overview a system is entered at. */
  resetForEntry() {
    this.yaw = ENTRY_YAW;
    this.pitch = overviewPitch(this.camera.aspect);
    this.distance = this.zoomBase = this.overviewDistance();
    this.focus.set(0, 0, 0);
    this.flying = false;
    this.widestAt = 0;
  }

  /** Continue easing from wherever the flight actually left the camera. */
  adoptCamera() {
    this.offset.subVectors(this.camera.position, this.target);
    this.viewDistance = Math.max(1e-3, this.offset.length());
    this.viewYaw = Math.atan2(this.offset.x, this.offset.z);
    this.viewPitch = Math.asin(
      THREE.MathUtils.clamp(this.offset.y / this.viewDistance, -1, 1),
    );
    this.viewLift = 0;
  }

  /** Back out to the whole system from the current heading; no spin. */
  frameSystem() {
    this.focus.set(0, 0, 0);
    this.pitch = overviewPitch(this.camera.aspect);
    this.distance = this.zoomBase = this.overviewDistance();
  }

  frameWorld(index: number) {
    const body = this.host.bodies[index];
    const position = body.root.position;
    this.pitch = 0.3;
    this.distance = this.zoomBase = this.focusDistance(body);
    const pose = clearStarPose(
      position,
      this.host.system?.star.radius ?? 3.8,
      this.distance,
      this.camera,
      { yaw: this.viewYaw, pitch: this.viewPitch },
      this.pitch,
    );
    this.pitch = pose.pitch;
    // Take the turn that is nearest the current view, never the long way.
    this.yaw = this.viewYaw + wrapAngle(pose.yaw - this.viewYaw);
  }

  /** Keep the reader's own zoom and heading; only the framing scale changes. */
  relayout(settled: boolean) {
    const base = this.layoutDistance();
    const scale = base / Math.max(1e-6, this.zoomBase);
    this.distance *= scale;
    if (settled) this.viewDistance *= scale;
    this.zoomBase = base;
  }

  /** The HUD settled in new places: ease to the new framing, keeping the zoom. */
  refit() {
    const base = this.layoutDistance();
    this.distance *= base / Math.max(1e-6, this.zoomBase);
    this.zoomBase = base;
  }

  drag(dx: number, dy: number) {
    this.yaw -= dx * 0.006;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, 0.12, 1.3);
  }

  move(dt: number, reduceMotion: boolean) {
    const { selected, bodies, viewport } = this.host;
    const body = selected === null ? null : bodies[selected];
    let horizontal = 0,
      vertical = 0;
    if (body) {
      // The world sits left of center; its comms casing docks right.
      this.desiredTarget.copy(body.root.position);
      ({ horizontal, vertical } = closeUpOffset(viewport));
    } else {
      // The whole system rises a little into the empty top of the view, clear
      // of the HUD, and settles back to center as the reader zooms in.
      this.desiredTarget.copy(this.focus);
      const fit = this.overviewFit();
      vertical =
        -fit.lift *
        THREE.MathUtils.smoothstep(
          this.viewDistance,
          fit.distance * 0.45,
          fit.distance * 0.95,
        );
    }
    if (horizontal || vertical) {
      const halfHeight = this.viewDistance * halfViewHeight(this.camera);
      // Shift in camera-plane coordinates, so framing survives dragging.
      const sideways = horizontal * halfHeight * this.camera.aspect;
      const lift = vertical * halfHeight;
      this.desiredTarget.x +=
        Math.cos(this.viewYaw) * sideways -
        Math.sin(this.viewYaw) * Math.sin(this.viewPitch) * lift;
      this.desiredTarget.z -=
        Math.sin(this.viewYaw) * sideways +
        Math.cos(this.viewYaw) * Math.sin(this.viewPitch) * lift;
      this.desiredTarget.y += Math.cos(this.viewPitch) * lift;
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
      selected === null &&
      this.viewDistance >= this.overviewDistance() * WIDEST_VIEW * 0.97
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
    orbitDirection(this.viewYaw, this.viewPitch, this.camera.position)
      .multiplyScalar(this.viewDistance + this.viewLift)
      .add(this.target);
    this.camera.lookAt(this.target);
    if (this.host.handedOff) {
      // Near clipping follows the zoom, so close worlds and moons never clip.
      const near = THREE.MathUtils.clamp(this.viewDistance * 0.01, 0.01, 4);
      if (Math.abs(near - this.camera.near) > this.camera.near * 0.05) {
        this.camera.near = near;
        this.camera.updateProjectionMatrix();
      }
    }
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
    let pixels = options.lines ? delta * 16 : delta;
    if (options.pinch) pixels *= 4;
    pixels = THREE.MathUtils.clamp(pixels, -120, 120);
    this.zoom(Math.exp(pixels * WHEEL_ZOOM), clientX, clientY, pixels);
  }

  /**
   * Continuous zoom, as in Spore: toward whatever is under the pointer (or
   * the view's center), down onto a world and back out to the system, then
   * out to the galaxy. There are no fixed stops between those views.
   * @param factor goal distance multiplier; below 1 zooms in
   * @param overscroll outward input beyond the widest view, for leaving
   */
  zoom(factor: number, clientX?: number, clientY?: number, overscroll = 0) {
    const { system, bodies } = this.host;
    if (!system || factor === 1) return;
    if (factor < 1) this.overscroll = 0;
    const next = this.distance * factor;
    const selected = this.host.selected;
    if (selected !== null) {
      const base = this.focusDistance(bodies[selected]);
      if (factor <= 1 || next < base * RELEASE_WORLD) {
        this.distance = Math.max(base * CLOSEST_WORLD, next);
        return;
      }
      // Zoomed out past the world: the system takes over from here, still
      // centered on the world, so the view keeps widening without a jump.
      this.focus.copy(bodies[selected].root.position);
      this.flying = false;
      this.zoomBase = this.overviewDistance();
      this.host.releaseWorld();
    }
    const overview = this.overviewDistance();
    const widest = overview * WIDEST_VIEW;
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
    const closest = system.star.radius * 3;
    const closer = Math.max(closest, next);
    const anchor =
      clientX === undefined || clientY === undefined
        ? null
        : this.groundAt(clientX, clientY);
    if (anchor) {
      const scale = closer / this.distance;
      this.focus.sub(anchor).multiplyScalar(scale).add(anchor);
      const reach = system.extent * 1.05;
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
      this.zoomTarget = this.host.pick(clientX, clientY);
      this.zoomTargetX = clientX;
      this.zoomTargetY = clientY;
    }
    this.zoomTargetAt = now;
    const world = this.zoomTarget;
    if (world === null || !bodies[world]) return;
    const base = this.focusDistance(bodies[world]);
    // Small worlds capture beyond the system zoom's floor; reaching the floor
    // over one still lands on it.
    if (closer > base * CAPTURE_WORLD && closer > closest * 1.001) return;
    this.zoomTarget = null;
    this.flying = false;
    this.distance = Math.max(
      base * CLOSEST_WORLD,
      Math.min(closer, base * CAPTURE_WORLD),
    );
    this.zoomBase = base;
    this.host.captureWorld(world);
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
    this.host.requestExit();
  }

  /** The point on the orbital plane under a screen position, if any. */
  private groundAt(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray.intersectPlane(this.orbitalPlane, this.ground);
  }
}
