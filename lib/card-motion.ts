export type CardMotion = { x: number; y: number; holdUntil: number };

export const CARD_RELEASE_GRACE_MS = 180;
const FOLLOW_TIME_MS = 170;

/** Frame-rate-independent following, with immediate hover capture. */
export function followCard(
  current: CardMotion | null,
  target: { x: number; y: number },
  options: {
    now: number;
    deltaMs: number;
    held: boolean;
    reducedMotion: boolean;
  },
): CardMotion {
  const { now, deltaMs, held, reducedMotion } = options;
  if (!current) {
    return { ...target, holdUntil: held ? now + CARD_RELEASE_GRACE_MS : now };
  }
  if (held) return { ...current, holdUntil: now + CARD_RELEASE_GRACE_MS };
  if (now <= current.holdUntil) return current;
  // Only integrate the portion of this frame after the grace period ended.
  const followMs = Math.max(0, Math.min(deltaMs, now - current.holdUntil));
  const blend = reducedMotion ? 1 : -Math.expm1(-followMs / FOLLOW_TIME_MS);
  return {
    x: current.x + (target.x - current.x) * blend,
    y: current.y + (target.y - current.y) * blend,
    holdUntil: current.holdUntil,
  };
}
