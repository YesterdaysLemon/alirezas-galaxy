import { describe, expect, it } from 'vitest';
import { CARD_RELEASE_GRACE_MS, followCard } from '../../lib/card-motion';

const options = { now: 0, deltaMs: 16, held: false, reducedMotion: false };

describe('floating card motion', () => {
  it('places a new card directly at its own world', () => {
    expect(followCard(null, { x: 40, y: 80 }, options)).toEqual({
      x: 40,
      y: 80,
      holdUntil: 0,
    });
  });

  it('captures immediately and holds across brief mouse exits', () => {
    const start = followCard(null, { x: 0, y: 0 }, options);
    const held = followCard(
      start,
      { x: 100, y: 80 },
      { ...options, now: 50, held: true },
    );
    expect(held).toEqual({ x: 0, y: 0, holdUntil: 50 + CARD_RELEASE_GRACE_MS });
    expect(
      followCard(held, { x: 100, y: 80 }, { ...options, now: 150 }),
    ).toEqual(held);
  });

  it('glides without jumping or overshooting after release', () => {
    const next = followCard(
      { x: 0, y: 0, holdUntil: 180 },
      { x: 100, y: -80 },
      { ...options, now: 200 },
    );
    expect(next.x).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(15);
    expect(next.y).toBeLessThan(0);
    expect(next.y).toBeGreaterThan(-80);
    const recaptured = followCard(
      next,
      { x: 200, y: 200 },
      { ...options, now: 216, held: true },
    );
    expect(recaptured.x).toBe(next.x);
    expect(recaptured.y).toBe(next.y);
  });

  it('has the same position at the same elapsed time at 30, 60, and 120 fps', () => {
    const simulate = (fps: number) => {
      let state = { x: 0, y: 0, holdUntil: 180 };
      for (let frame = 1; frame <= fps; frame++) {
        state = followCard(
          state,
          { x: 100, y: 50 },
          { ...options, now: (frame * 1000) / fps, deltaMs: 1000 / fps },
        );
      }
      return state;
    };
    expect(simulate(30).x).toBeCloseTo(simulate(60).x, 8);
    expect(simulate(60).x).toBeCloseTo(simulate(120).x, 8);
  });

  it('respects reduced motion while retaining the hover grace period', () => {
    const start = { x: 0, y: 0, holdUntil: 180 };
    expect(
      followCard(
        start,
        { x: 100, y: 80 },
        { ...options, now: 100, reducedMotion: true },
      ),
    ).toEqual(start);
    const next = followCard(
      start,
      { x: 100, y: 80 },
      { ...options, now: 200, reducedMotion: true },
    );
    expect(next.x).toBe(100);
    expect(next.y).toBe(80);
  });
});
