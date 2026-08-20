/**
 * The rest pose is a design artifact, not a seed (§2.3).
 *
 * The blue is the GROUND, not the figure. The node field covers the whole
 * card and bleeds off every edge; what you interact with are the holes eaten
 * into it. So there are two hand-placed sets here: the nodes that make the
 * mass, and the resting clearings that are always open in it.
 *
 * Coordinates are normalised — x against width, y and r against height — so
 * the composition keeps its proportions at any aspect the card is given.
 */

export interface Node {
  x: number;
  y: number;
  r: number;
}

/**
 * A staggered field rather than a grid. Radii vary because uniform radii read
 * mechanical even when the mass is solid — the variation shows up at the rim
 * of every clearing, where the field strength decides how wide the hole opens.
 */
export const REST_POSE: Node[] = [
  { x: -0.06, y: 0.02, r: 0.34 },
  { x: 0.17, y: -0.04, r: 0.3 },
  { x: 0.39, y: 0.03, r: 0.33 },
  { x: 0.61, y: -0.03, r: 0.29 },
  { x: 0.83, y: 0.02, r: 0.34 },
  { x: 1.05, y: -0.02, r: 0.31 },

  { x: 0.05, y: 0.5, r: 0.33 },
  { x: 0.28, y: 0.46, r: 0.3 },
  { x: 0.5, y: 0.52, r: 0.34 },
  { x: 0.72, y: 0.47, r: 0.3 },
  { x: 0.95, y: 0.52, r: 0.33 },

  { x: -0.04, y: 0.98, r: 0.32 },
  { x: 0.19, y: 1.04, r: 0.3 },
  { x: 0.41, y: 0.97, r: 0.34 },
  { x: 0.63, y: 1.03, r: 0.29 },
  { x: 0.85, y: 0.98, r: 0.33 },
  { x: 1.06, y: 1.02, r: 0.31 },
];

/**
 * Clearings that are always open. Without these the resting card is a flat
 * blue rectangle — no composition, nothing to tell you there is type under
 * there, and a reduced-motion render with nothing in it. These are what make
 * the piece a poster before anyone touches it.
 */
export const RESTING_HOLES: Node[] = [
  { x: 0.24, y: 0.63, r: 0.36 },
  { x: 0.69, y: 0.28, r: 0.28 },
  { x: 0.88, y: 0.82, r: 0.22 },
];

export const PAPER = "#F7F5F1";
export const VERMILION = "#E4573C";
export const ULTRA = "#1E3FC4";

/** Field threshold and the antialiasing band, in field units (§3). */
export const THRESHOLD = 1.0;
export const EDGE = 0.012;

/**
 * The pointer is a negative metaball (open question 1, now the primary
 * mechanism rather than the alternative). With the blue as ground, subtraction
 * is what "clearing" means — and the hole it opens is bounded by the same
 * isoline as everything else, so the edge stays as hard as the rest of the
 * mass and the trailing rim necks shut behind a fast sweep for free.
 *
 * Radius is in units of card height. A hole opens roughly where
 * r / sqrt(field − 1), so this is larger than the hole it makes.
 */
export const POINTER_R = 0.46;

/** Nodes still shift, gently — the mass reads as material, not as an eraser. */
export const INFLUENCE_RADIUS = 260;
export const MAX_PUSH = 62;
export const STIFFNESS = 0.055;
export const DAMPING = 0.78;

/** Wake samples, most recent first, weights decaying to 0.15 (§4.2). */
export const WAKE_LEN = 8;
export const WAKE_MS = 16;

/**
 * The entrance easing, cubic-bezier(0.22, 1, 0.36, 1), solved rather than
 * approximated — Newton converges in three steps at this precision and the
 * whole thing runs 60 times over one second, once.
 */
export function easeOutQuint(t: number): number {
  const x1 = 0.22;
  const x2 = 0.36;
  let u = t;
  for (let i = 0; i < 4; i++) {
    const mt = 1 - u;
    const x = 3 * mt * mt * u * x1 + 3 * mt * u * u * x2 + u * u * u;
    const dx = 3 * mt * mt * x1 + 6 * mt * u * (x2 - x1) + 3 * u * u * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    u -= (x - t) / dx;
    u = Math.max(0, Math.min(1, u));
  }
  const mt = 1 - u;
  return 3 * mt * mt * u + 3 * mt * u * u + u * u * u;
}
