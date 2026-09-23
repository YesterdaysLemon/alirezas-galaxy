/** A per-frame ease `rate` at 60fps, scaled to `frames` of 60fps time. */
export function frameEase(rate: number, frames: number) {
  return 1 - Math.pow(1 - rate, frames);
}

/** Mulberry32: a small, fast seeded generator for repeatable scenery. */
export function seededRandom(seed = 9173) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

/** A standard normal sample (Box-Muller). */
export function gaussian(random: () => number) {
  const first = Math.max(0.000001, random());
  const second = Math.max(0.000001, random());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(Math.PI * 2 * second);
}
