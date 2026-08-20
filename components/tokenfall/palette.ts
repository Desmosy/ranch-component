import type { Rng } from "./rng";

/**
 * Muted, chalky, printed rather than emitted (§2.3).
 *
 * A dark-field variant is a swap of these values plus a re-run of the
 * luminance rule below — no structural change anywhere else, which is the
 * point of computing glyph contrast instead of hand-mapping it.
 */

export const FIELD_BG = "#DCD5CF";
export const INK = "#14110F";
export const PAPER = "#FFFFFF";

export interface Tile {
  name: string;
  hex: string;
  /** Share of cells, roughly. Not uniform — see below. */
  weight: number;
}

/**
 * `bone` and `ash` are not accents, they are holes. Without a meaningful
 * share of near-background tiles the field reads as a solid wall of confetti
 * instead of a mass with gaps in it.
 */
export const TILES: Tile[] = [
  { name: "brick", hex: "#C64B2C", weight: 18 },
  { name: "cobalt", hex: "#3B7DD8", weight: 16 },
  { name: "mustard", hex: "#B8892B", weight: 14 },
  { name: "moss", hex: "#2F5C2A", weight: 12 },
  { name: "blossom", hex: "#E8A9D8", weight: 12 },
  { name: "bone", hex: "#FAF7F2", weight: 12 },
  { name: "ash", hex: "#B4B0AB", weight: 10 },
  { name: "pine", hex: "#1E3A18", weight: 6 },
];

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. Computed once at init, never per frame. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Glyph colour for a tile. Add a colour to TILES and this just works. */
export function glyphOn(hex: string): string {
  return luminance(hex) > 0.5 ? INK : PAPER;
}

/** Cumulative weights, so a weighted pick is one binary-search-free scan. */
const CUM: number[] = (() => {
  const out: number[] = [];
  let acc = 0;
  for (const t of TILES) {
    acc += t.weight;
    out.push(acc);
  }
  return out;
})();
const TOTAL = CUM[CUM.length - 1];

export function pickTile(rng: Rng): number {
  const r = rng() * TOTAL;
  for (let i = 0; i < CUM.length; i++) if (r < CUM[i]) return i;
  return CUM.length - 1;
}
