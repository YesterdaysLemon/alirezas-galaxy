/** A finite approach, measured from the renderer's first visible frame. */
export const GROX_APPROACH = { hold: 350, travel: 1850, settle: 180 } as const;
export const GROX_STAR_POSITION = [2.2, 0.65, 1.5] as const;

export function shouldPlayGroxPortrait(
  reducedMotion: boolean,
  visible: boolean,
) {
  return visible && !reducedMotion;
}

export const GROX_RETREAT_MS = 1500;

/** Reverse from the current approach pose, including an early Escape. */
export function groxRetreatFrame(
  elapsed: number,
  fromProgress = 1,
  reducedMotion = false,
) {
  const t = reducedMotion
    ? 1
    : Math.max(0, Math.min(1, elapsed / GROX_RETREAT_MS));
  return {
    progress:
      Math.max(0, Math.min(1, fromProgress)) * (1 - t * t * (3 - 2 * t)),
    returned: t === 1,
  };
}

export function groxApproachFrame(elapsed: number, reducedMotion = false) {
  const t = reducedMotion
    ? 1
    : Math.max(
        0,
        Math.min(1, (elapsed - GROX_APPROACH.hold) / GROX_APPROACH.travel),
      );
  return {
    progress: t * t * (3 - 2 * t),
    arrived:
      reducedMotion ||
      elapsed >=
        GROX_APPROACH.hold + GROX_APPROACH.travel + GROX_APPROACH.settle,
  };
}
