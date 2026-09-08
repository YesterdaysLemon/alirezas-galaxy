/** Shared rate for UI chrome only; scene travel and click-driven spin stay unchanged. */
export const UI_MOTION_SPEED = 1.65;
export const uiDuration = (milliseconds: number) =>
  milliseconds / UI_MOTION_SPEED;
