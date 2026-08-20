import * as THREE from "three";

/**
 * The cube's logic (§4).
 *
 * Every cubie carries a logical grid coordinate in {-1,0,1}³ alongside its
 * Object3D. A move picks the nine cubies on one layer, spins them as a group,
 * and rewrites their coordinates — the transform and the bookkeeping are kept
 * separately on purpose, because the transform accumulates error and the
 * bookkeeping must not.
 */

export const PITCH = 1.06;

export type Axis = "x" | "y" | "z";

export interface Move {
  face: string;
  axis: Axis;
  /** Which layer on that axis. */
  layer: -1 | 1;
  /** Quarter turns, signed. */
  dir: 1 | -1;
}

/**
 * A face turn is clockwise seen from outside that face, which is the negative
 * direction about the outward axis under the right-hand rule — hence the
 * asymmetry between the two layers of each axis.
 */
const FACES: Record<string, { axis: Axis; layer: -1 | 1; dir: 1 | -1 }> = {
  U: { axis: "y", layer: 1, dir: -1 },
  D: { axis: "y", layer: -1, dir: 1 },
  R: { axis: "x", layer: 1, dir: -1 },
  L: { axis: "x", layer: -1, dir: 1 },
  F: { axis: "z", layer: 1, dir: -1 },
  B: { axis: "z", layer: -1, dir: 1 },
};

export const FACE_NAMES = Object.keys(FACES);

export function move(notation: string): Move {
  const face = notation[0];
  const prime = notation.endsWith("'");
  const f = FACES[face];
  return { face: notation, axis: f.axis, layer: f.layer, dir: (prime ? -f.dir : f.dir) as 1 | -1 };
}

export function invert(notation: string): string {
  return notation.endsWith("'") ? notation.slice(0, -1) : `${notation}'`;
}

export interface Cubie {
  x: number;
  y: number;
  z: number;
  object: THREE.Object3D;
}

export function onLayer(c: Cubie, m: Move): boolean {
  return c[m.axis] === m.layer;
}

/** Rotate a grid coordinate a quarter turn about an axis. */
export function turnCoords(c: Cubie, m: Move) {
  const { x, y, z } = c;
  const s = m.dir;
  if (m.axis === "x") {
    c.y = -s * z;
    c.z = s * y;
  } else if (m.axis === "y") {
    c.x = s * z;
    c.z = -s * x;
  } else {
    c.x = -s * y;
    c.y = s * x;
  }
}

/**
 * Quantise (§4.3).
 *
 * A valid cubie orientation is one of 24, and every one of them has a rotation
 * matrix whose entries are exactly -1, 0 or 1. Rounding the matrix and reading
 * the quaternion back off it therefore snaps to the nearest legal orientation
 * without needing the list of 24 anywhere. Positions go back onto the grid the
 * same way.
 *
 * Skipping this is the bug that ships: the per-move error is invisible, and
 * after a few hundred moves the cube is visibly coming apart at the seams.
 */
const _m = new THREE.Matrix4();
export function snap(c: Cubie) {
  c.object.position.set(c.x * PITCH, c.y * PITCH, c.z * PITCH);
  _m.makeRotationFromQuaternion(c.object.quaternion);
  const e = _m.elements;
  for (let i = 0; i < 16; i++) e[i] = Math.round(e[i]);
  c.object.quaternion.setFromRotationMatrix(_m);
}

export function randomMove(rng: () => number, avoid?: string): string {
  let n: string;
  do {
    const f = FACE_NAMES[Math.floor(rng() * FACE_NAMES.length)];
    n = rng() < 0.5 ? f : `${f}'`;
  } while (avoid && n[0] === avoid[0]);
  return n;
}

/**
 * A scramble whose reverse is the resolve (§5.1) — arrival is arithmetic, not
 * search, so it cannot fail on screen.
 *
 * The first moves get special treatment. Since the resolve is this list
 * reversed and inverted, the LAST moves of the resolve are the inverses of
 * these first ones — so choosing them from a set that disturbs only three of
 * the nine glyph stickers is what produces §5.3's near-misses. The face reads
 * six-ninths right, then two-thirds right, and only the final turn lands it.
 * That is the choreography falling out of the ordering rather than out of
 * hand-authored sequences.
 */
const QUIET = ["R", "R'", "L", "L'", "F", "F'", "B", "B'"];

export function makeScramble(rng: () => number, length = 14): string[] {
  const out: string[] = [];
  for (let i = 0; i < 4; i++) {
    let n: string;
    do {
      n = QUIET[Math.floor(rng() * QUIET.length)];
    } while (out.length && n[0] === out[out.length - 1][0]);
    out.push(n);
  }
  while (out.length < length) out.push(randomMove(rng, out[out.length - 1]));
  return out;
}

export function makeResolve(scramble: string[]): string[] {
  return scramble.slice().reverse().map(invert);
}

export function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}
