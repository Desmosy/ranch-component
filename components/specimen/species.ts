/**
 * Seven visual languages that have no business being on the same page.
 *
 * Each one is drawn from its own vocabulary — a character grid, an engraver's
 * hatch, a halftone screen, a bitmap, a typecase, a margin of notation, a
 * dither field — and each is given a body plan rather than a sprite, so it can
 * be squashed, stretched, stepped or spun by whatever physics is chasing it.
 */

export const PAPER = "#F2EDE3";
export const INK = "#15120D";
export const RED = "#B8402C";
export const BLUE = "#20419B";
export const GREEN = "#2C6448";

export type SpeciesId =
  | "ascii"
  | "ink"
  | "halftone"
  | "pixel"
  | "type"
  | "math"
  | "noise";

export const ORDER: SpeciesId[] = [
  "ascii",
  "ink",
  "halftone",
  "pixel",
  "type",
  "math",
  "noise",
];

export const LABELS: Record<SpeciesId, string> = {
  ascii: "char. grid",
  ink: "soft tissue",
  halftone: "screen 65lpi",
  pixel: "bitmap sp.",
  type: "case iv",
  math: "notation",
  noise: "dither",
};

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

const GLYPHS = "#@%&*+=-:.^~/\\|()[]{}<>";
const MATH = ["∑", "∫", "±", "θ", "λ", "≈", "∂", "∞"];

/** A hand-set bitmap. Drawn by hand because a generated one looks generated. */
const CREATURE = [
  "..XX..XX..",
  ".XXXXXXXX.",
  "XX.XXXX.XX",
  "XXXXXXXXXX",
  ".XX.XX.XX.",
  "..XXXXXX..",
  ".X.X..X.X.",
  "X..X..X..X",
];

/** Deterministic hash, so a body does not boil when it is standing still. */
function hash(x: number, y: number, k = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export interface DrawState {
  x: number;
  y: number;
  /** Facing, in radians. */
  head: number;
  /** 0..1, how hard this body is being pulled right now. */
  effort: number;
  /** Per-body clock. */
  phase: number;
  /** Stable per-body seed. */
  seed: number;
  /** Generations of contamination, 0 = clean. */
  gen: number;
  /** 1 → 0 as the organism collapses. */
  scale: number;
}

type Draw = (ctx: CanvasRenderingContext2D, s: DrawState) => void;

// --- bodies ------------------------------------------------------------------

const drawAscii: Draw = (ctx, s) => {
  const cell = 7 * s.scale;
  const cols = 7;
  const rows = 3;
  ctx.font = `${9 * s.scale}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // The grid is quantised in world space, so the block re-renders as it
      // travels instead of sliding — the character grid never moves smoothly.
      const gx = Math.round((s.x + (c - (cols - 1) / 2) * cell) / cell);
      const gy = Math.round((s.y + (r - (rows - 1) / 2) * cell) / cell);
      const h = hash(gx, gy, s.seed);
      if (h < 0.22) continue;
      const g = GLYPHS[Math.floor(h * GLYPHS.length)];
      ctx.fillStyle = h > 0.94 ? RED : INK;
      ctx.fillText(g, gx * cell, gy * cell);
    }
  }
};

const drawInk: Draw = (ctx, s) => {
  const r = 26 * s.scale;
  // Elastic tissue: the body squashes along the direction it is being hauled.
  const squash = 1 + s.effort * 0.5;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.head);
  ctx.scale(squash, 1 / squash);

  ctx.beginPath();
  const lobes = 7;
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const rr = r * (0.68 + hash(i, s.seed) * 0.5);
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr * 0.78;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 1.1 * s.scale;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // Engraver's hatch, clipped to the organ.
  ctx.clip();
  ctx.lineWidth = 0.6 * s.scale;
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.55;
  for (let i = -8; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(-r, i * 4 * s.scale);
    ctx.lineTo(r, i * 4 * s.scale + r * 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

const drawHalftone: Draw = (ctx, s) => {
  const R = 30 * s.scale;
  // Lags and stretches: the screen smears along its own travel.
  const stretch = 1 + s.effort * 1.1;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.head);
  ctx.scale(stretch, 1 / stretch);
  ctx.rotate(0.26); // screen angle
  ctx.fillStyle = s.gen > 2 ? BLUE : INK;
  const pitch = 5.4 * s.scale;
  for (let gy = -R; gy <= R; gy += pitch) {
    for (let gx = -R; gx <= R; gx += pitch) {
      const d = Math.hypot(gx, gy) / R;
      if (d > 1) continue;
      const rad = (1 - d) ** 0.8 * pitch * 0.62;
      if (rad < 0.25) continue;
      ctx.beginPath();
      ctx.arc(gx, gy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
};

const drawPixel: Draw = (ctx, s) => {
  const px = 3.4 * s.scale;
  const w = CREATURE[0].length;
  const h = CREATURE.length;
  // Snapped to the device grid: a bitmap that lands between pixels is a blur,
  // and a blurred bitmap is not a bitmap.
  const ox = Math.round(s.x - (w * px) / 2);
  const oy = Math.round(s.y - (h * px) / 2);
  const flip = Math.cos(s.head) < 0;
  ctx.fillStyle = INK;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (CREATURE[r][flip ? w - 1 - c : c] !== "X") continue;
      ctx.fillStyle = hash(r, c, s.seed) > 0.9 ? GREEN : INK;
      ctx.fillRect(ox + c * px, oy + r * px, Math.ceil(px), Math.ceil(px));
    }
  }
};

const drawType: Draw = (ctx, s) => {
  const word = "SPECIMEN";
  ctx.save();
  ctx.translate(s.x, s.y);
  // The only body that turns instead of travelling.
  ctx.rotate(s.head);
  ctx.font = `${13 * s.scale}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK;
  const step = 11 * s.scale;
  for (let i = 0; i < word.length; i++) {
    const x = (i - (word.length - 1) / 2) * step;
    ctx.fillText(word[i], x, 0);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.7 * s.scale;
  ctx.beginPath();
  ctx.moveTo((-word.length * step) / 2, 9 * s.scale);
  ctx.lineTo((word.length * step) / 2, 9 * s.scale);
  ctx.stroke();
  ctx.restore();
};

const drawMath: Draw = (ctx, s) => {
  const R = 22 * s.scale;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.7 * s.scale;
  ctx.setLineDash([2 * s.scale, 3 * s.scale]);
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `${11 * s.scale}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 4; i++) {
    const a = s.phase * 1.4 + (i / 4) * Math.PI * 2;
    ctx.fillStyle = i === 1 ? RED : INK;
    ctx.fillText(MATH[(i + s.seed) % MATH.length], Math.cos(a) * R, Math.sin(a) * R);
  }
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(-R - 5 * s.scale, 0);
  ctx.lineTo(-R + 3 * s.scale, 0);
  ctx.moveTo(R - 3 * s.scale, 0);
  ctx.lineTo(R + 5 * s.scale, 0);
  ctx.stroke();
  ctx.restore();
};

const drawNoise: Draw = (ctx, s) => {
  const px = 3 * s.scale;
  const n = 11;
  const ox = Math.round(s.x - (n * px) / 2);
  const oy = Math.round(s.y - (n * px) / 2);
  ctx.fillStyle = INK;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const d = Math.hypot(c - n / 2, r - n / 2) / (n / 2);
      // Ordered dither, not random pixels — the field has to look printed.
      const level = (1 - d) * 16 + s.effort * 5;
      if (level <= BAYER[r % 4][c % 4]) continue;
      ctx.fillRect(ox + c * px, oy + r * px, Math.ceil(px), Math.ceil(px));
    }
  }
};

export const BODIES: Record<SpeciesId, Draw> = {
  ascii: drawAscii,
  ink: drawInk,
  halftone: drawHalftone,
  pixel: drawPixel,
  type: drawType,
  math: drawMath,
  noise: drawNoise,
};

/**
 * The smallest possible signature of each language — one mark. Contamination
 * is these turning up inside a body that is not theirs.
 */
export function stamp(
  ctx: CanvasRenderingContext2D,
  from: SpeciesId,
  x: number,
  y: number,
  k: number,
  scale: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.6 * scale;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  switch (from) {
    case "ascii":
      ctx.font = `${8 * scale}px ${MONO}`;
      ctx.fillText(GLYPHS[k % GLYPHS.length], 0, 0);
      break;
    case "ink":
      ctx.beginPath();
      ctx.arc(0, 0, 3 * scale, 0.4, 4.2);
      ctx.stroke();
      break;
    case "halftone":
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(i * 3 * scale - 3 * scale, 0, (1.4 - i * 0.35) * scale, 0, 6.3);
        ctx.fill();
      }
      break;
    case "pixel":
      ctx.fillRect(-1.5 * scale, -1.5 * scale, 3 * scale, 3 * scale);
      break;
    case "type":
      ctx.font = `${8 * scale}px ${MONO}`;
      ctx.fillText("SPECIMEN"[k % 8], 0, 0);
      break;
    case "math":
      ctx.font = `${9 * scale}px ${MONO}`;
      ctx.fillStyle = RED;
      ctx.fillText(MATH[k % MATH.length], 0, 0);
      break;
    case "noise":
      for (let i = 0; i < 4; i++) {
        const h = hash(i, k);
        ctx.fillRect((h - 0.5) * 8 * scale, (hash(k, i) - 0.5) * 8 * scale, scale, scale);
      }
      break;
  }
  ctx.restore();
}

export { hash };
