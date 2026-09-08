import { describe, expect, it } from 'vitest';
import {
  GROX_APPROACH,
  GROX_STAR_POSITION,
  groxApproachFrame,
  groxRetreatFrame,
  GROX_RETREAT_MS,
  shouldPlayGroxPortrait,
} from '../../lib/grox-encounter';

describe('Grox camera approach', () => {
  it('establishes the galaxy before moving and never opens halfway through', () => {
    expect(groxApproachFrame(0)).toEqual({ progress: 0, arrived: false });
    expect(groxApproachFrame(GROX_APPROACH.hold)).toEqual({
      progress: 0,
      arrived: false,
    });
    expect(
      groxApproachFrame(GROX_APPROACH.hold + GROX_APPROACH.travel / 2),
    ).toEqual({ progress: 0.5, arrived: false });
    expect(
      groxApproachFrame(GROX_APPROACH.hold + GROX_APPROACH.travel),
    ).toEqual({ progress: 1, arrived: false });
    expect(groxApproachFrame(2380)).toEqual({ progress: 1, arrived: true });
  });
  it('stays bounded and opens immediately without a zoom for reduced motion', () => {
    expect(groxApproachFrame(-100).progress).toBe(0);
    expect(groxApproachFrame(1e8)).toEqual({ progress: 1, arrived: true });
    expect(groxApproachFrame(0, true)).toEqual({ progress: 1, arrived: true });
    let previous = 0;
    for (let elapsed = 0; elapsed < 3000; elapsed += 16) {
      const frame = groxApproachFrame(elapsed);
      expect(frame.progress).toBeGreaterThanOrEqual(previous);
      expect(frame.progress).toBeLessThanOrEqual(1);
      previous = frame.progress;
    }
  });
  it('places the red star near, but not inside, the galactic core', () => {
    const radius = Math.hypot(GROX_STAR_POSITION[0], GROX_STAR_POSITION[2]);
    expect(radius).toBeGreaterThan(2);
    expect(radius).toBeLessThan(3);
  });
});

describe('Grox portrait playback policy', () => {
  it('autoplays normally but respects reduced motion', () => {
    expect(shouldPlayGroxPortrait(false, true)).toBe(true);
    expect(shouldPlayGroxPortrait(true, true)).toBe(false);
  });
  it('never plays while hidden', () => {
    expect(shouldPlayGroxPortrait(false, false)).toBe(false);
    expect(shouldPlayGroxPortrait(true, false)).toBe(false);
  });
});

describe('Grox departure', () => {
  it('pulls back from the star to the original view before returning controls', () => {
    expect(groxRetreatFrame(0)).toEqual({ progress: 1, returned: false });
    expect(groxRetreatFrame(GROX_RETREAT_MS / 2)).toEqual({
      progress: 0.5,
      returned: false,
    });
    expect(groxRetreatFrame(GROX_RETREAT_MS)).toEqual({
      progress: 0,
      returned: true,
    });
  });
  it('reverses early departures from the current pose without jumping closer', () => {
    const start = groxApproachFrame(1000).progress;
    expect(groxRetreatFrame(0, start).progress).toBe(start);
    let previous = start;
    for (let time = 0; time <= GROX_RETREAT_MS; time += 50) {
      const frame = groxRetreatFrame(time, start);
      expect(frame.progress).toBeLessThanOrEqual(previous);
      expect(frame.progress).toBeGreaterThanOrEqual(0);
      previous = frame.progress;
    }
  });
  it('skips the reverse zoom for reduced motion and clamps completed travel', () => {
    expect(groxRetreatFrame(0, 1, true)).toEqual({
      progress: 0,
      returned: true,
    });
    expect(groxRetreatFrame(1e8)).toEqual({ progress: 0, returned: true });
    expect(groxRetreatFrame(-100)).toEqual({ progress: 1, returned: false });
  });
});
