/**
 * A still life and a sun.
 *
 * Nothing in the composition ever moves. Every frame of motion is a shadow,
 * which is the whole idea: the drawing is fixed and designed, and the only
 * variable is where the light is standing. Shadows are the cheapest way to get
 * a flat vector scene to read as a place rather than as a row of shapes.
 */

export type Kind = "bar" | "disc" | "triangle" | "ring" | "arch" | "halfdisc";

export interface Solid {
  kind: Kind;
  /** All measurements are fractions of the plate WIDTH, so nothing distorts. */
  x: number;
  w: number;
  h: number;
  /** Inner radius for a ring, as a fraction of the outer. */
  hole?: number;
  fill: string;
}

export const PLATE = "#EFE6D4";
export const GROUND = "#E3D8C0";
export const INK = "#171310";
export const SUN = "#F0A81E";
const RED = "#D8442B";
const BLUE = "#2447C4";
const CREAM = "#F6F1E4";

/**
 * Hand-placed, not generated. Heights step through a small scale and the gaps
 * are deliberately uneven — evenly spaced objects of graded size read as a
 * chart, and the piece needs to read as a still life.
 */
export const SOLIDS: Solid[] = [
  { kind: "bar", x: 0.075, w: 0.048, h: 0.40, fill: INK },
  { kind: "disc", x: 0.185, w: 0.155, h: 0.155, fill: RED },
  { kind: "arch", x: 0.325, w: 0.125, h: 0.32, fill: BLUE },
  { kind: "triangle", x: 0.472, w: 0.175, h: 0.245, fill: SUN },
  { kind: "ring", x: 0.625, w: 0.20, h: 0.20, hole: 0.54, fill: INK },
  { kind: "bar", x: 0.755, w: 0.036, h: 0.28, fill: RED },
  { kind: "halfdisc", x: 0.86, w: 0.17, h: 0.085, fill: CREAM },
  { kind: "bar", x: 0.955, w: 0.03, h: 0.155, fill: INK },
];

/** Where the ground line sits, as a fraction of plate height. */
export const HORIZON = 0.79;

/** How much the ground plane is foreshortened. Higher lies flatter. */
export const FORESHORTEN = 0.26;

/** Cap on shadow length, so a low sun does not stripe the whole plate. */
const MAX_RAKE = 4.5;

/**
 * Parallel light, not a point lamp.
 *
 * A point lamp projects each solid from its own angle, which is technically
 * truer and reads as wrong: shadows splay outward like a stage, and the piece
 * stops looking like sunlight. Parallel rays give every solid the same rake,
 * which is what makes the row scan as one moment of one day.
 */
export function rakeFrom(sunX: number, sunY: number, w: number, groundY: number): number {
  const drop = Math.max(w * 0.06, groundY - sunY);
  return Math.max(-MAX_RAKE, Math.min(MAX_RAKE, (w / 2 - sunX) / drop));
}

/** The sun's resting path — a shallow arc that never quite sets. */
export function sunAt(t: number, w: number, groundY: number): { x: number; y: number } {
  const a = 0.17 * Math.PI + (Math.sin(t) * 0.5 + 0.5) * 0.66 * Math.PI;
  return {
    x: w * (0.5 - 0.62 * Math.cos(a)),
    y: groundY - groundY * 0.86 * Math.sin(a),
  };
}

/**
 * Lay the solid's outline down in plate coordinates. The shadow is the very
 * same path drawn under a sheared transform, so the two can never drift apart.
 */
export function tracePath(
  ctx: CanvasRenderingContext2D,
  s: Solid,
  unit: number,
  groundY: number,
) {
  const x = s.x * unit;
  const w = s.w * unit;
  const h = s.h * unit;
  const g = groundY;

  ctx.beginPath();
  switch (s.kind) {
    case "bar":
      ctx.rect(x - w / 2, g - h, w, h);
      break;
    case "disc":
      ctx.arc(x, g - w / 2, w / 2, 0, Math.PI * 2);
      break;
    case "halfdisc":
      ctx.arc(x, g, w / 2, Math.PI, 0);
      ctx.closePath();
      break;
    case "triangle":
      ctx.moveTo(x - w / 2, g);
      ctx.lineTo(x + w / 2, g);
      ctx.lineTo(x, g - h);
      ctx.closePath();
      break;
    case "arch":
      ctx.moveTo(x - w / 2, g);
      ctx.lineTo(x - w / 2, g - h + w / 2);
      ctx.arc(x, g - h + w / 2, w / 2, Math.PI, 0);
      ctx.lineTo(x + w / 2, g);
      ctx.closePath();
      break;
    case "ring": {
      const r = w / 2;
      const cy = g - r;
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      // Wound the other way so the even-odd rule punches the hole — and the
      // shadow inherits it, which is the detail that sells the whole scene.
      ctx.moveTo(x + r * (s.hole ?? 0.5), cy);
      ctx.arc(x, cy, r * (s.hole ?? 0.5), 0, Math.PI * 2, true);
      break;
    }
  }
}
