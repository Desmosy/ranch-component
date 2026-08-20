/**
 * Glyph art (§3).
 *
 * Each letter is authored on a 12×12 grid and painted into a 96×96 canvas, so
 * one art pixel is 8 texels — chunky by construction, and the 3×3 cut divides
 * evenly (each sticker gets a 4×4 block of art pixels).
 *
 * Every letter carries a one-pixel frame. That is not decoration: §3.3 requires
 * visible content in all nine tiles or the solved face comes back with blank
 * stickers, and no honest drawing of an H puts ink in the top-middle third.
 * The frame guarantees the eight outer tiles, and every letter here crosses its
 * own centre, which guarantees the ninth.
 */

export const ART = 12;
export const TEX = 96;

const A = [
  "############",
  "#..........#",
  "#...####...#",
  "#..##..##..#",
  "#..##..##..#",
  "#..######..#",
  "#..##..##..#",
  "#..##..##..#",
  "#..##..##..#",
  "#..##..##..#",
  "#..........#",
  "############",
];

const E = [
  "############",
  "#..........#",
  "#..######..#",
  "#..##......#",
  "#..##......#",
  "#..#####...#",
  "#..##......#",
  "#..##......#",
  "#..##......#",
  "#..######..#",
  "#..........#",
  "############",
];

const H = [
  "############",
  "#..........#",
  "#..##..##..#",
  "#..##..##..#",
  "#..##..##..#",
  "#..######..#",
  "#..######..#",
  "#..##..##..#",
  "#..##..##..#",
  "#..##..##..#",
  "#..........#",
  "############",
];

const K = [
  "############",
  "#..........#",
  "#..##..##..#",
  "#..##.##...#",
  "#..####....#",
  "#..###.....#",
  "#..####....#",
  "#..##.##...#",
  "#..##..##..#",
  "#..##..###.#",
  "#..........#",
  "############",
];

const M = [
  "############",
  "#..........#",
  "#.##....##.#",
  "#.###..###.#",
  "#.########.#",
  "#.##.##.##.#",
  "#.##.##.##.#",
  "#.##....##.#",
  "#.##....##.#",
  "#.##....##.#",
  "#..........#",
  "############",
];

const N = [
  "############",
  "#..........#",
  "#.##....##.#",
  "#.###...##.#",
  "#.####..##.#",
  "#.##.##.##.#",
  "#.##.##.##.#",
  "#.##..####.#",
  "#.##...###.#",
  "#.##....##.#",
  "#..........#",
  "############",
];

const R = [
  "############",
  "#..........#",
  "#..#####...#",
  "#..##..##..#",
  "#..##..##..#",
  "#..#####...#",
  "#..####....#",
  "#..##.##...#",
  "#..##..##..#",
  "#..##...##.#",
  "#..........#",
  "############",
];

const S = [
  "############",
  "#..........#",
  "#...#####..#",
  "#..##......#",
  "#..##......#",
  "#...####...#",
  "#......##..#",
  "#......##..#",
  "#..#####...#",
  "#..........#",
  "#..........#",
  "############",
];

const W = [
  "############",
  "#..........#",
  "#.##....##.#",
  "#.##....##.#",
  "#.##....##.#",
  "#.##.##.##.#",
  "#.##.##.##.#",
  "#.########.#",
  "#.###..###.#",
  "#.##....##.#",
  "#..........#",
  "############",
];

const X = [
  "############",
  "#..........#",
  "#.##....##.#",
  "#..##..##..#",
  "#...####...#",
  "#....##....#",
  "#....##....#",
  "#...####...#",
  "#..##..##..#",
  "#.##....##.#",
  "#..........#",
  "############",
];

export const GLYPHS: Record<string, string[]> = { A, E, H, K, M, N, R, S, W, X };
export const GLYPH_ORDER = ["H", "A", "N", "S", "M", "E", "R", "K", "W", "X"];

/**
 * Decorative fragments for the blue faces (§3.4, option B — see the note in
 * the component about why option A cannot coexist with the §5.1 guarantee).
 * Deliberately unreadable: marks, not letters.
 */
const FRAGMENTS = [
  ["....", ".##.", ".##.", "...."],
  ["#...", "##..", ".##.", "..##"],
  ["####", "#..#", "#..#", "####"],
  ["..#.", ".##.", "##..", "#..."],
  ["##..", "##..", "..##", "..##"],
  ["....", "####", "####", "...."],
];

export function paintGlyph(letter: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TEX;
  c.height = TEX;
  const g = c.getContext("2d")!;
  const rows = GLYPHS[letter] ?? GLYPHS.H;
  const px = TEX / ART;

  g.fillStyle = "#F2D53C";
  g.fillRect(0, 0, TEX, TEX);
  g.fillStyle = "#0A0A0A";
  for (let y = 0; y < ART; y++) {
    for (let x = 0; x < ART; x++) {
      if (rows[y][x] === "#") g.fillRect(x * px, y * px, px, px);
    }
  }
  return c;
}

/**
 * Line-art cut of a glyph: the same 12×12 art, drawn as stroked outlines on
 * transparent instead of filled blocks on citron.
 *
 * Drawn at 2× so the strokes survive nearest-neighbour sampling — a 1px stroke
 * in a 96px texture lands on half a texel and comes back broken.
 */
export function paintGlyphLines(letter: string, stroke: string): HTMLCanvasElement {
  const scale = 2;
  const size = TEX * scale;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  const rows = GLYPHS[letter] ?? GLYPHS.H;
  const px = size / ART;

  g.strokeStyle = stroke;
  g.lineWidth = 2;
  for (let y = 0; y < ART; y++) {
    for (let x = 0; x < ART; x++) {
      if (rows[y][x] !== "#") continue;
      g.strokeRect(x * px + 1, y * px + 1, px - 2, px - 2);
    }
  }
  return c;
}

/** One 32×32 tile of white marks on azure, for a single sticker. */
export function paintFragment(index: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const g = c.getContext("2d")!;
  const cells = FRAGMENTS[index % FRAGMENTS.length];
  g.fillStyle = "#4A6BF5";
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = "#FFFFFF";
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if (cells[y][x] === "#") g.fillRect(x * 8, y * 8, 8, 8);
    }
  }
  return c;
}
