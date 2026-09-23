import * as THREE from 'three';
import type { PlanetRecipe, SolarSystem } from '../../data/solar-systems';
import { halfViewHeight, wrapAngle } from './math';

export type Viewport = { width: number; height: number };

/**
 * Which ship HUD layout is showing. These breakpoints mirror the media queries
 * in app/solar-system.css; change them together.
 */
export function hudLayout({ width, height }: Viewport) {
  const short = height <= 520 && width >= height;
  return { short, portrait: width <= 720 && width <= height };
}

/** Screen room the HUD leaves for a close-up, in pixels. */
function closeUpRoom(viewport: Viewport) {
  const { width, height } = viewport;
  const { short, portrait } = hudLayout(viewport);
  return {
    // Portrait stacks the comms casing below the world.
    height: Math.max(100, height - (portrait ? 430 : short ? 110 : 200)),
    // Landscape docks the comms casing on the right.
    width: Math.max(
      120,
      width -
        (portrait
          ? 48
          : short
            ? Math.min(420, width * 0.52)
            : Math.min(560, width * 0.44)),
    ),
  };
}

export const overviewPitch = (aspect: number) => (aspect < 1 ? 0.9 : 0.62);

/** The camera distance that frames a whole system. */
export function overviewDistance(system: SolarSystem | null, aspect: number) {
  // A sparse companion system still frames at a common scale, so its star
  // keeps the same size on screen instead of swallowing the view.
  // Frame the worlds; the Kuiper belt rings them just past the edges.
  const extent = Math.max(44, (system?.frame ?? 40) * 1.08);
  // Frame the tilted orbital plane rather than the sphere containing its belts.
  return extent * 1.38 * Math.max(1, 0.8 / aspect);
}

/**
 * The camera distance that frames one world (and its rings, whose outer
 * edge is `footprint`) in the room the HUD leaves beside its comms casing.
 */
export function focusDistance(
  planet: PlanetRecipe,
  footprint: number,
  viewport: Viewport,
  camera: THREE.PerspectiveCamera,
) {
  const room = closeUpRoom(viewport);
  const vertical = halfViewHeight(camera);
  const apparentRadius = planet.rings ? footprint : planet.radius * 1.12;
  return Math.max(
    (apparentRadius * 1.25) / ((vertical * room.height) / viewport.height),
    (apparentRadius * 1.25) /
      ((vertical * camera.aspect * room.width) / viewport.width),
  );
}

/**
 * Where a close-up's subject sits on screen, as fractions of the view's
 * half-height: left of center clear of the comms casing, lifted above the helm.
 */
export function closeUpOffset(viewport: Viewport) {
  const { short, portrait } = hudLayout(viewport);
  return {
    horizontal: portrait ? 0 : short ? 0.26 : 0.24,
    // Only the corners of the bottom edge carry HUD now, so a short
    // landscape needs just a small lift to clear the helm.
    vertical: portrait
      ? -Math.min(0.62, 288 / viewport.height)
      : short
        ? -0.1
        : -0.02,
  };
}

/**
 * The close-up looks from the sunlit side, but an inner world sits so near
 * its star that the star would fill the frame, or swallow the camera. Of the
 * poses that keep the whole star (and its inner glow) outside the view, take
 * the one nearest the current view so neighboring worlds need small turns.
 */
export function clearStarPose(
  planet: THREE.Vector3,
  starRadius: number,
  distance: number,
  camera: THREE.PerspectiveCamera,
  view: { yaw: number; pitch: number },
  fallbackPitch: number,
) {
  const radius = starRadius * 1.6;
  const base = Math.atan2(-planet.x, -planet.z);
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const halfWide = Math.atan(Math.tan(halfFov) * camera.aspect);
  // The frame's corners reach farther than either half-angle alone.
  const halfCorner = Math.atan(
    Math.hypot(Math.tan(halfFov), Math.tan(halfWide)),
  );
  let best = { yaw: base + 0.55, pitch: fallbackPitch, score: -Infinity };
  let nearest: { yaw: number; pitch: number; turn: number } | null = null;
  for (const pitch of [0.3, 0.55, 0.8, 1.05, 1.25])
    for (const offset of [0.55, 0.9, 1.3, -0.55, -0.9]) {
      const yaw = base + offset;
      const cx = planet.x + Math.sin(yaw) * Math.cos(pitch) * distance,
        cy = planet.y + Math.sin(pitch) * distance,
        cz = planet.z + Math.cos(yaw) * Math.cos(pitch) * distance;
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
          Math.abs(wrapAngle(yaw - view.yaw)) +
          Math.abs(pitch - view.pitch) +
          pitch * 0.5 +
          (offset < 0 ? 0.4 : 0);
        if (!nearest || turn < nearest.turn) nearest = { yaw, pitch, turn };
      }
      if (score > best.score) best = { yaw, pitch, score };
    }
  const pose = nearest ?? best;
  return { yaw: pose.yaw, pitch: pose.pitch };
}
