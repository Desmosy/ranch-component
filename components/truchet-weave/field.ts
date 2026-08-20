/**
 * A multi-scale Truchet field.
 *
 * Every tile carries the same contract: its four edges are crossed at the
 * midpoint, or not at all. That single rule is what makes the field work —
 * neighbours always connect, at any size, in any rotation, so turning one tile
 * re-routes the ribbon through the whole composition instead of breaking it.
 * The subdivision is clustered rather than uniform, so the piece has dense
 * passages and quiet ones, the way a designed composition does and a grid of
 * random cells does not.
 */

export type Kind = "arc" | "solid" | "dot";

export interface Tile {
  x: number;
  y: number;
  size: number;
  kind: Kind;
  /** Index into the palette's ink list. */
  ink: number;
  /** Filled ground behind the tile, or -1 for the plate. */
  ground: number;
  /** Current rotation in quarter turns, and where it is heading. */
  turn: number;
  target: number;
  vel: number;
  /** Position along the sweep, 0..1. */
  phase: number;
  /** Last sweep cycle this tile fired on. */
  cycle: number;
}

export interface Palette {
  plate: string;
  inks: string[];
  grounds: string[];
}

/** Flat, hard-edged, four values. Anything more starts to read as decoration. */
export const PALETTE: Palette = {
  plate: "#EFE7D7",
  inks: ["#16130F", "#16130F", "#16130F", "#D8452B", "#2246C7"],
  grounds: ["#D8452B", "#2246C7", "#E8B531", "#16130F"],
};

const MAX_DEPTH = 2;
const BASE_COLS = 5;

/** Two smooth blobs of "interest" — subdivision clusters where they overlap. */
function interestAt(nx: number, ny: number, seed: number): number {
  const a = Math.sin(nx * 3.1 + seed) * Math.cos(ny * 2.3 - seed * 1.7);
  const b = Math.sin((nx + ny) * 2.2 - seed * 0.6);
  return (a * 0.6 + b * 0.4 + 1) / 2;
}

export function buildField(w: number, h: number): Tile[] {
  const seed = Math.random() * 10;
  const base = w / BASE_COLS;
  const tiles: Tile[] = [];

  const emit = (x: number, y: number, size: number, depth: number) => {
    const nx = (x + size / 2) / w;
    const ny = (y + size / 2) / h;
    const interest = interestAt(nx, ny, seed);

    // Deeper levels need more interest to split, so fine detail stays in
    // pockets instead of spreading evenly over the whole plate.
    const need = 0.42 + depth * 0.22;
    if (depth < MAX_DEPTH && interest > need) {
      const half = size / 2;
      emit(x, y, half, depth + 1);
      emit(x + half, y, half, depth + 1);
      emit(x, y + half, half, depth + 1);
      emit(x + half, y + half, half, depth + 1);
      return;
    }

    const r = Math.random();
    const kind: Kind = r < 0.08 ? "dot" : r < 0.24 ? "solid" : "arc";

    // Bigger tiles carry the colour; small ones stay black, or the field
    // turns to confetti.
    const bold = size > base * 0.6;
    const ground =
      bold && Math.random() < 0.16
        ? Math.floor(Math.random() * PALETTE.grounds.length)
        : -1;
    const ink =
      ground >= 0
        ? -1
        : bold
          ? Math.floor(Math.random() * PALETTE.inks.length)
          : 0;

    const start = Math.floor(Math.random() * 4);
    tiles.push({
      x,
      y,
      size,
      kind,
      ink,
      ground,
      turn: start,
      target: start,
      vel: 0,
      // Scaled short of 1 so the far corner still fires before the cycle ends.
      phase: (nx * 0.62 + ny * 0.38) * 0.92,
      cycle: -1,
    });
  };

  for (let y = -base; y < h + base; y += base) {
    for (let x = 0; x < w; x += base) emit(x, y, base, 0);
  }

  return tiles;
}
