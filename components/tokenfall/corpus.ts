/**
 * The material (§3.3).
 *
 * Real source, uppercased at render, treated as one continuous ring buffer
 * with a random per-column offset. Punctuation is the load-bearing part: it is
 * what makes the field read as code rather than as prose, so the corpus leans
 * on declarations, calls, member access and object literals rather than on
 * comments and long identifiers.
 *
 * Open question 1, settled for v1: bundled, not scraped from the page's own
 * bundle at runtime. Pulling the live bundle is the better idea and the worse
 * dependency — it puts a network fetch, a CSP rule and a same-origin
 * assumption in front of a decorative background. The `corpus` prop is the
 * seam: a host that wants its own source in the field can pass it in, and
 * nothing else changes.
 */

const SOURCE = `
export function createField(canvas, options = {}) {
  const { seed = 0x9e3779b9, density = 1.0, cell = { w: 18, h: 26 } } = options;
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  if (!ctx) throw new Error("2d context unavailable");
  const columns = [];
  const particles = pool(400, () => ({ x: 0, y: 0, vx: 0, vy: 0, tile: 0, glyph: 0, live: false }));
  let width = 0, height = 0, rows = 0, dpr = 1, elapsed = 0;
  return { resize, step, draw, dispose };
}

function pool(size, make) {
  const items = new Array(size);
  for (let i = 0; i < size; i++) items[i] = make();
  let cursor = 0;
  return {
    take() {
      for (let n = 0; n < size; n++) {
        const item = items[(cursor + n) % size];
        if (!item.live) { cursor = (cursor + n + 1) % size; item.live = true; return item; }
      }
      return null;
    },
    release(item) { item.live = false; },
    forEach(fn) { for (let i = 0; i < size; i++) if (items[i].live) fn(items[i], i); },
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const wrap = (i, n) => ((i % n) + n) % n;

export function envelope(y, rampStart = 0.55) {
  if (y <= rampStart) return 1;
  if (y <= 0.85) return lerp(1, 0.15, (y - rampStart) / (0.85 - rampStart));
  return lerp(0.15, 0, (y - 0.85) / 0.15);
}

class Column {
  constructor(index, rng, rows) {
    this.index = index;
    this.speed = 4.5 + rng() * 6.5;
    this.phase = rng();
    this.offset = Math.floor(rng() * CORPUS.length);
    this.multiplier = 0.7 + rng() * 0.45;
    this.colors = new Uint8Array(rows + 2);
    this.glyphs = new Uint8Array(rows + 2);
    this.thresholds = new Float32Array(rows + 2);
    this.factor = 1; this.target = 1; this.frozen = false;
    this.resetAt = 45000 + rng() * 45000;
  }
  advance(dt) {
    this.acc += this.speed * this.factor * dt;
    while (this.acc >= 1) { this.shift(); this.acc -= 1; }
  }
  shift() {
    const { glyphs, thresholds } = this;
    for (let i = glyphs.length - 1; i > 0; i--) {
      glyphs[i] = glyphs[i - 1];
      thresholds[i] = thresholds[i - 1];
    }
    glyphs[0] = CORPUS.charCodeAt(this.offset++ % CORPUS.length);
    thresholds[0] = this.rng();
  }
}

function drawColumn(ctx, column, atlas, cw, ch, rows, alpha) {
  ctx.globalAlpha = alpha;
  const x = column.index * cw;
  for (let row = 0; row < rows; row++) {
    if (!column.present[row]) continue;
    const tile = column.colors[row], glyph = column.glyphs[row];
    ctx.drawImage(atlas, glyph * cw, tile * ch, cw, ch, x, row * ch, cw, ch);
  }
  ctx.globalAlpha = 1;
}

function shedChance(y) { return clamp((y - 0.6) / 0.4, 0, 1) * 0.08; }

function stepParticles(list, dt, height, cellHeight) {
  list.forEach((p) => {
    p.vy = Math.min(p.vy + GRAVITY * dt, TERMINAL);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y > height + cellHeight) list.release(p);
  });
}

export const GRAVITY = 240, TERMINAL = 420, VISCOSITY_RADIUS = 140;

function buildAtlas(chars, tiles, cw, ch, dpr, font) {
  const atlas = document.createElement("canvas");
  atlas.width = Math.ceil(chars.length * cw * dpr);
  atlas.height = Math.ceil(tiles.length * ch * dpr);
  const g = atlas.getContext("2d");
  g.scale(dpr, dpr);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = font;
  for (let t = 0; t < tiles.length; t++) {
    for (let c = 0; c < chars.length; c++) {
      const x = c * cw, y = t * ch;
      g.fillStyle = tiles[t].hex;
      g.fillRect(x, y, cw, ch);
      g.fillStyle = tiles[t].onLight ? "#14110F" : "#FFFFFF";
      g.fillText(chars[c], x + cw / 2, y + ch / 2 + 2);
    }
  }
  return atlas;
}

const state = { pointer: { x: -1, y: -1 }, frozen: [], running: false, seed: 1 };

function viscosity(columnX, pointerX, radius) {
  if (pointerX < 0) return 1;
  const d = Math.abs(columnX - pointerX);
  return 1 - 0.75 * (1 - clamp(d / radius, 0, 1));
}

export function attach(target, options) {
  const observer = new IntersectionObserver(([entry]) => {
    state.running = entry.isIntersecting && !document.hidden;
  }, { rootMargin: "0px" });
  observer.observe(target);
  document.addEventListener("visibilitychange", () => { state.running = !document.hidden; });
  return () => { observer.disconnect(); };
}

const TOKENS = ["FUNCTION", "RETURN", "CONST", "LET", "FOR", "IF", "ELSE", "WHILE", "CLASS", "NEW", "THIS", "NULL", "TRUE", "FALSE", "AWAIT", "ASYNC", "YIELD", "TYPEOF", "IMPORT", "EXPORT", "DEFAULT", "SWITCH", "CASE", "BREAK", "CONTINUE", "TRY", "CATCH", "FINALLY", "THROW", "DELETE", "INSTANCEOF", "VOID"];

for (let i = 0; i < items.length; i++) { const { id, name, value } = items[i]; if (!seen.has(id)) { seen.add(id); out.push({ id, name, value: value ?? 0 }); } }
const matrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((row, i) => row.map((v, j) => v * scale[i][j] + offset));
if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { render(0); return; }
const { width: w, height: h } = canvas.getBoundingClientRect(); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
requestAnimationFrame(function loop(now) { const dt = Math.min(50, now - last) / 1000; acc += dt; while (acc >= STEP) { simulate(STEP); acc -= STEP; } render(); raf = requestAnimationFrame(loop); });
Object.assign(target.style, { position: "absolute", inset: "0", pointerEvents: "none", contain: "strict" });
export default { create, attach, destroy, version: "1.0.0", cell: { w: 18, h: 26 }, palette: TILES };
`;

/** Whitespace collapsed to single spaces, uppercased, one long ring buffer. */
export const CORPUS = SOURCE.replace(/\s+/g, " ").trim().toUpperCase();

/**
 * Every glyph the atlas needs. Derived from the corpus rather than hand-listed,
 * so a swapped-in corpus can never ask for a tile that was not rendered.
 */
export function charsetFor(corpus: string): string {
  const seen = new Set<string>();
  for (const ch of corpus) seen.add(ch);
  return Array.from(seen).sort().join("");
}
