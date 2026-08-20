/**
 * One PRNG for the whole field, injected at construction (§6.4).
 *
 * Every random draw in Tokenfall — column speeds, phases, colour arrays,
 * corpus offsets, envelope thresholds, shed rolls, particle drift — comes
 * through this. A fixed seed therefore reproduces a byte-identical first
 * frame, which is what makes visual regression testing and "that one frame
 * looked bad" reports possible at all.
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng: Rng, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

export function intRange(rng: Rng, lo: number, hi: number): number {
  return Math.floor(range(rng, lo, hi));
}
