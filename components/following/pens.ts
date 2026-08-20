/**
 * FOLLOWING — the instruments.
 *
 * Every line is a pen with a heading, a speed and an angular spring. It is
 * never given a position to jump to; it is given something to steer toward,
 * and it can only turn so fast. That single constraint is what makes the marks
 * read as a plotting machine rather than a cursor trail: speed stays roughly
 * constant, so slow hands make broad contours and fast hands make tight
 * oscillation, without a single line of code that measures how fast you moved.
 *
 * A follower does not chase its predecessor's current point. It chases where
 * that pen WAS, some distance back along its own path, and it adds a small
 * transformation of its own on the way. Following the live point would give
 * you a converging bundle; following the history gives nested offset curves,
 * and the per-generation transformation is what makes them splay into rings,
 * knots and folds instead of staying parallel.
 */

export const PAPER = "#F0EBE1";
export const INK = "#141210";
/** Reserved: a pen only wears this while it is following something that is
 *  not its own predecessor. Colour is a statement about relationship. */
export const ACCENT = "#B23A22";

export const MAX_PENS = 44;
/** Points of history each pen keeps. Also the deepest a follower can lag. */
export const TRAIL = 260;
/** How far back down its predecessor's path a follower aims. */
export const LAG = 22;

export type Style =
  | "solid"
  | "engraved"
  | "dotted"
  | "hatch"
  | "stipple"
  | "halftone"
  | "fragment";

/**
 * LINE → DRAWING → TEXTURE → NOISE, banded by generation. The geometry never
 * changes down the chain — only how it is deposited.
 */
export function styleFor(gen: number): Style {
  if (gen === 0) return "solid";
  if (gen <= 2) return "engraved";
  if (gen <= 5) return "dotted";
  if (gen <= 9) return "hatch";
  if (gen <= 14) return "stipple";
  if (gen <= 21) return "halftone";
  return "fragment";
}

export interface Pen {
  gen: number;
  x: number;
  y: number;
  /** Heading, and the angular spring that governs how it may change. */
  dir: number;
  angVel: number;
  speed: number;
  /** Ring buffer of past positions. */
  px: Float32Array;
  py: Float32Array;
  head: number;
  filled: number;
  /** Which pen this one is following. -1 means the cursor. */
  follows: number;
  /** True once it has been re-pointed at something other than its own parent. */
  strayed: boolean;
  /** This pen's private distortion: a lateral offset and a standing turn. */
  offset: number;
  bias: number;
  /** How hard it corrects — later generations overcorrect. */
  gain: number;
  seed: number;
  /** Fades to 0 as the pen is retired during the return. */
  life: number;
}

/** Seeded value noise. No textures, no images — everything is arithmetic. */
export function noise(x: number, y = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function makePen(gen: number, x: number, y: number, dir: number): Pen {
  const s = noise(gen * 7.3 + 1.7);
  return {
    gen,
    x,
    y,
    dir,
    angVel: 0,
    speed: 1.35,
    px: new Float32Array(TRAIL),
    py: new Float32Array(TRAIL),
    head: 0,
    filled: 0,
    follows: gen - 1,
    strayed: false,
    // Alternating sign, so consecutive generations splay to opposite sides and
    // the family opens out instead of piling onto one line.
    offset: (2.2 + s * 6) * (gen % 2 ? 1 : -1),
    bias: (s - 0.5) * 0.010,
    gain: 0.052 + gen * 0.0016,
    seed: gen * 13.7,
    life: 1,
  };
}

export function record(p: Pen) {
  p.px[p.head] = p.x;
  p.py[p.head] = p.y;
  p.head = (p.head + 1) % TRAIL;
  if (p.filled < TRAIL) p.filled++;
}

/** A point `back` samples along this pen's own history. */
export function pastPoint(p: Pen, back: number): { x: number; y: number } {
  const n = Math.min(back, p.filled - 1);
  if (n <= 0) return { x: p.x, y: p.y };
  const i = (p.head - 1 - n + TRAIL * 2) % TRAIL;
  return { x: p.px[i], y: p.py[i] };
}

function wrap(a: number): number {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Steer toward a point. The pen may not teleport, may not stop, and may only
 * turn against a damped spring — inertia, curvature, acceleration, damping,
 * all falling out of the same three lines.
 */
export function steer(
  p: Pen,
  tx: number,
  ty: number,
  dt: number,
  w: number,
  h: number,
) {
  const k = dt / 16.7;

  // Keep off the deckle. Rather than clamping — which puts a flat edge in the
  // drawing — the target itself is pulled inboard as a pen nears the margin.
  const m = Math.min(w, h) * 0.11;
  let ax = tx;
  let ay = ty;
  const edge =
    Math.max(0, m - p.x) +
    Math.max(0, p.x - (w - m)) +
    Math.max(0, m - p.y) +
    Math.max(0, p.y - (h - m));
  if (edge > 0) {
    const pull = Math.min(1, edge / m);
    ax += (w / 2 - p.x) * pull;
    ay += (h / 2 - p.y) * pull;
  }

  const want = Math.atan2(ay - p.y, ax - p.x);
  const err = wrap(want - p.dir);
  p.angVel += err * p.gain * k;
  p.angVel *= 0.86 ** k;
  // Cap the turn, or a hard reversal snaps into a corner instead of a fold.
  p.angVel = Math.max(-0.19, Math.min(0.19, p.angVel));
  p.dir += (p.angVel + p.bias) * k;

  // Speed eases with distance: a pen that has fallen behind hurries, one that
  // is on top of its mark idles. This is what opens and closes the density.
  const d = Math.hypot(ax - p.x, ay - p.y);
  const want_s = Math.max(0.55, Math.min(2.5, 0.42 + d * 0.055));
  p.speed += (want_s - p.speed) * 0.06 * k;

  p.x += Math.cos(p.dir) * p.speed * k;
  p.y += Math.sin(p.dir) * p.speed * k;
}
