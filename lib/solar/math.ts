import * as THREE from 'three';

/**
 * Galaxy units per local system unit. A whole system spans roughly the
 * thickness of a spiral arm, so it resolves only once the camera is inside
 * that arm rather than floating over a third of the galaxy.
 */
export const GALAXY_UNIT = 0.0011;
export const ENTRY_SECONDS = 2.4;
export const SWITCH_SECONDS = 3;
export const LEAVE_SECONDS = 1.8;
/** Log-distance per wheel pixel: roughly a dozen notches from world to overview. */
export const WHEEL_ZOOM = 0.002;
/** Beyond this multiple of a world's close-up distance the view is the system again. */
export const RELEASE_WORLD = 2.4;
/** Zooming in over a world within this multiple of its close-up distance lands on it. */
export const CAPTURE_WORLD = 2.1;
/** The nearest a zoom may bring a world, as a multiple of its close-up distance. */
export const CLOSEST_WORLD = 0.56;
/** The widest view, as a multiple of the distance that frames the whole system. */
export const WIDEST_VIEW = 1.85;
/** The overview's heading as a system is entered. */
export const ENTRY_YAW = -0.32;
/** Pointer travel, in pixels, that turns a tap into a drag. */
export const DRAG_PIXELS = 7;

/** Quintic smootherstep on 0..1: zero velocity and acceleration at both ends. */
export const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export const wrapAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));

/** tan(fov / 2): the half-height of the view at unit distance. */
export const halfViewHeight = (camera: THREE.PerspectiveCamera) =>
  Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

/** The camera's offset direction for a heading and tilt about its subject. */
export const orbitDirection = (
  yaw: number,
  pitch: number,
  into: THREE.Vector3,
) =>
  into.set(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  );

/** On-screen radius, in pixels, of a sphere seen from `distance`. */
export const screenRadius = (
  radius: number,
  distance: number,
  viewportHeight: number,
  camera: THREE.PerspectiveCamera,
) => (radius * viewportHeight) / (2 * halfViewHeight(camera) * distance);
