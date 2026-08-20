import { createSound, type SoundCue, type SoundHandle } from './baseIntroSound';

export type BaseIntroOptions = {
  text: string;
  font: string;
  background: string;
  primary: string;
  palette: string[];
  speed: number;
  loop: boolean;
  autoplay: boolean;
  sound: boolean;
  onDone: (() => void) | null;
};

export type BaseIntroHandle = {
  play: () => BaseIntroHandle;
  resume: () => BaseIntroHandle;
  pause: () => BaseIntroHandle;
  seek: (ms: number) => BaseIntroHandle;
  setSound: (on: boolean) => void;
  readonly time: number;
  readonly duration: number;
  readonly playing: boolean;
  resize: () => void;
  destroy: () => void;
};

type RGB = [number, number, number];
type Pt = [number, number];
type Span = readonly [number, number];

type Particle = {
  x: number; y: number;
  gx: number; gy: number;
  bi: number;
};

type Letter = {
  advL: number; advR: number;
  ascPx: number;
  stemLeft: boolean;
};

export const DEFAULTS: BaseIntroOptions = {
  text: 'base',
  font: '700 {size}px "Helvetica Neue", Helvetica, Inter, "Segoe UI", Arial, sans-serif',
  background: '#ffffff',
  primary: '#0000FF',
  palette: ['#E8543F', '#F5D96B', '#6E97EA', '#98D45C', '#F5A9CE'],
  speed: 1,
  loop: false,
  autoplay: true,
  sound: false,
  onDone: null,
};

const T: Record<string, Span> = {
  vortexIn:  [0,    680],
  wheel:     [600,  2340],
  converge:  [1880, 2340],
  merge:     [2140, 2340],
  expand:    [2400, 2820],
  split:     [2820, 3080],
  asc:       [3000, 3240],
  flipOn:    [3280, 3600],
  flipOff:   [3640, 3920],
  reveal:    [3980, 4855],
  hold:      [4900, 5800],
  fold:      [5800, 6830],
  ascDown:   [7350, 7520],
  shuffle:   [7500, 8600],
  vortexOut: [8560, 9400],
};
const DURATION = 9520;

const FLIP_STEP = 80;
const REV_STEP = 165;
const REV_DUR = 380;
const CLOSE_STEP = 200;
const CLOSE_DUR = 430;
const REV_HIT = 0.45;
const CLOSE_HIT = 0.3;

const RIFFLE_CYCLES = 1.55;
const RIFFLE_LAG = 1.15;
const VORTEX_TURNS = 1.6;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const span = (t: number, [a, b]: Span) => clamp((t - a) / (b - a), 0, 1);
const eOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const eInCubic = (t: number) => t * t * t;
const eInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const spool = (p: number, a = 0.16, b = 0.74) => {
  const area = a / 2 + (b - a) + (1 - b) / 2;
  const d = p < a
    ? (p * p) / (2 * a)
    : p <= b
      ? a / 2 + (p - a)
      : a / 2 + (b - a) + (p - b) - ((p - b) * (p - b)) / (2 * (1 - b));
  return d / area;
};

const BAYER = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
].map((v) => (v + 0.5) / 64);
const jitter = (gx: number, gy: number) => {
  const n = Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453;
  return n - Math.floor(n);
};
const dither = (gx: number, gy: number) =>
  BAYER[(((gy % 8) + 8) % 8) * 8 + (((gx % 8) + 8) % 8)] * 0.72 + jitter(gx, gy) * 0.28;

const hex2rgb = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return h.length === 4
    ? [((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17]
    : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function roundPoly(ctx: CanvasRenderingContext2D, pts: Pt[], radii: number[]) {
  const n = pts.length;
  const d = (p: Pt, q: Pt) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const d0 = d(p1, p0) || 1, d1 = d(p1, p2) || 1;
    const r = Math.min(radii[i], d0 / 2, d1 / 2);
    const ax = p1[0] + (p0[0] - p1[0]) * (r / d0);
    const ay = p1[1] + (p0[1] - p1[1]) * (r / d0);
    if (i === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
    ctx.arcTo(p1[0], p1[1], p2[0], p2[1], r);
  }
  ctx.closePath();
}

function rectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  rl: number, rr: number,
) {
  roundPoly(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], [rl, rr, rr, rl]);
}

export function createBaseIntro(
  canvas: HTMLCanvasElement,
  options: Partial<BaseIntroOptions> = {},
): BaseIntroHandle {
  const o: BaseIntroOptions = { ...DEFAULTS, ...options };
  const ctx = canvas.getContext('2d')!;

  const BG = hex2rgb(o.background);
  const BLUE = hex2rgb(o.primary);
  const PAL = o.palette.map(hex2rgb);
  const [RED, YELLOW, SKY, GREEN, PINK] = PAL;
  const ACCENT = [RED, YELLOW, SKY, GREEN];

  const DECK = [
    { z: 6, hue: BLUE },
    { z: 4, hue: YELLOW },
    { z: 3, hue: SKY },
    { z: 2, hue: GREEN },
    { z: 5, hue: RED },
    { z: 1, hue: PINK },
  ];

  const CELL_DIV = 9;

  let W = 0, H = 0, DPR = 1;
  let N = Math.max(1, o.text.length);
  let S = 0, gp = 0, rad = 0, cx = 0, cy = 0, baseY = 0, rowW = 0;
  let fontSize = 0, textX = 0, cell = 0, gridX = 0, gridY = 0;
  let particles: Particle[] = [];
  let letters: Letter[] = [];
  let xhRatio = 0.52;

  let raf = 0, t0 = 0, t = 0, playing = false;

  const sound: SoundHandle = createSound();
  sound.setEnabled(o.sound);
  let cues: { t: number; cue: SoundCue; i: number }[] = [];
  let cueAt = 0;

  function measureXHeight() {
    const c = document.createElement('canvas');
    c.width = c.height = 220;
    const g = c.getContext('2d')!;
    g.font = o.font.replace('{size}', '100');
    g.textBaseline = 'alphabetic';
    g.fillText('x', 20, 170);
    const d = g.getImageData(0, 0, 220, 220).data;
    let top = 1e9, bot = -1;
    for (let y = 0; y < 220; y++) {
      for (let x = 0; x < 220; x++) {
        if (d[(y * 220 + x) * 4 + 3] > 128) { if (y < top) top = y; if (y > bot) bot = y; }
      }
    }
    return bot > 0 ? (bot - top + 1) / 100 : 0.52;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    N = Math.max(1, o.text.length);
    S = Math.max(24, Math.min((W * 0.44) / N, H * 0.25));
    gp = S * 0.055;
    rad = S * 0.16;
    cx = W / 2; cy = H / 2;
    rowW = N * S + (N - 1) * gp;
    baseY = cy + S / 2;
    fontSize = S / xhRatio;

    buildParticles();
  }

  function buildParticles() {
    particles = [];
    letters = [];

    const fw = Math.ceil(Math.max(W * 1.4, fontSize * N * 1.6));
    const fh = Math.ceil(fontSize * 2.4);
    const c = document.createElement('canvas');
    c.width = fw; c.height = fh;
    const g = c.getContext('2d')!;
    const penX = fw * 0.1, penY = fh * 0.72;
    g.font = o.font.replace('{size}', String(fontSize));
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#000';
    g.fillText(o.text, penX, penY);

    const adv: number[] = [0];
    for (let i = 1; i <= N; i++) adv.push(g.measureText(o.text.slice(0, i)).width);

    const img = g.getImageData(0, 0, fw, fh).data;
    const ink = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < fw && y < fh && img[(y * fw + x) * 4 + 3] > 120;

    let L = 1e9, R = -1, TOP = 1e9, BOT = -1;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        if (!ink(x, y)) continue;
        if (x < L) L = x; if (x > R) R = x;
        if (y < TOP) TOP = y; if (y > BOT) BOT = y;
      }
    }
    if (R < 0) return;

    const inkW = R - L + 1;
    textX = cx - (L - penX) - inkW / 2;
    const offX = textX - penX, offY = baseY - penY;

    cell = Math.max(3, S / CELL_DIV);

    type Bounds = { x0: number; x1: number; y0: number; y1: number; topX: number[] };
    const bounds: Bounds[] = [];
    for (let i = 0; i < N; i++) {
      const lo = penX + adv[i], hi = penX + adv[i + 1];
      const b: Bounds = { x0: 1e9, x1: -1, y0: 1e9, y1: -1, topX: [] };
      for (let y = TOP; y <= BOT; y++) {
        for (let x = Math.floor(lo); x < Math.ceil(hi); x++) {
          if (!ink(x, y)) continue;
          if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
          if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
        }
      }
      bounds.push(b);
      if (b.x1 >= 0) {
        for (let x = b.x0; x <= b.x1; x++) if (ink(x, b.y0)) b.topX.push(x);
      }
      const h = b.x1 < 0 ? 0 : b.y1 - b.y0 + 1;
      const ascPx = Math.max(0, h - S);
      const midTop = b.topX.length ? b.topX.reduce((s, v) => s + v, 0) / b.topX.length : 0;
      letters.push({
        advL: penX + adv[i] + offX,
        advR: penX + adv[i + 1] + offX,
        ascPx: ascPx > S * 0.18 ? Math.min(ascPx, S * 0.72) : 0,
        stemLeft: midTop < (b.x0 + b.x1) / 2,
      });
    }

    gridX = L + offX; gridY = TOP + offY;
    for (let sy = TOP; sy <= BOT; sy += cell) {
      for (let sx = L; sx <= R; sx += cell) {
        const mx = Math.round(sx + cell / 2), my = Math.round(sy + cell / 2);
        if (!ink(mx, my)) continue;

        let bi = N - 1;
        for (let i = 0; i < N; i++) {
          if (mx < penX + adv[i + 1]) { bi = i; break; }
        }
        particles.push({
          x: sx + offX, y: sy + offY,
          gx: Math.round((sx - L) / cell),
          gy: Math.round((sy - TOP) / cell),
          bi,
        });
      }
    }
  }

  const LAG = 60;
  const GROW = 64;
  const R_RING = 0.84;
  const TURN = 560;
  const DEG = Math.PI / 180;

  const theta = (ms: number) => TURN * spool(span(ms, T.wheel));

  function ringState(i: number, ms: number) {
    const th = theta(ms);
    const born = clamp((th - i * LAG) / GROW, 0, 1);
    const grow = eOutCubic(born);
    const shut = eInOut(span(ms, T.converge));
    const ang = (th - i * LAG) * DEG;
    const r = lerp(R_RING * grow, 0.012, shut);
    const gone = i === 0 ? 0 : eInOut(span(ms, T.merge));
    return {
      dx: Math.cos(ang) * r,
      dy: Math.sin(ang) * r,
      rot: lerp((th - i * LAG) * 0.34, 0, shut),
      sc: (i === 0 ? 1 : lerp(0.8, 1, grow)) * (1 - gone),
      a: (i === 0 ? 1 : Math.min(1, born * 5)) * (1 - gone),
    };
  }

  function rowGeom(ms: number) {
    let w = S, gap = 0, inner = 0, ascK = 0;
    if (ms >= T.expand[0]) w = lerp(S, rowW, eInOut(span(ms, T.expand)));
    if (ms >= T.split[0]) {
      const k = eInOut(span(ms, T.split));
      gap = gp * k; inner = rad * k;
    }
    if (ms >= T.asc[0]) ascK = eOutCubic(span(ms, T.asc));
    if (ms >= T.ascDown[0]) ascK *= 1 - eInOut(span(ms, T.ascDown));
    return { w, gap, inner, ascK };
  }

  function blockRect(i: number, geom: { w: number; gap: number }) {
    const bw = (geom.w - (N - 1) * geom.gap) / N;
    return { x: cx - geom.w / 2 + i * (bw + geom.gap), y: baseY - S, w: bw, h: S };
  }

  function vortex(ms: number, dir: 1 | -1) {
    const p = span(ms, dir === 1 ? T.vortexIn : T.vortexOut);
    const k = dir === 1 ? 1 - eOutCubic(p) : eInCubic(p);
    const ang = k * VORTEX_TURNS * 360;
    const r = S * 0.24 * Math.sin(Math.PI * k);
    return {
      x: cx + Math.cos(ang * DEG) * r,
      y: cy + Math.sin(ang * DEG) * r,
      rot: dir === 1 ? -ang : ang,
      sc: 1 - k,
    };
  }

  const BLUE_AT = 0.8;

  function riffleState(i: number, ms: number) {
    const p = span(ms, T.shuffle);
    const geom = rowGeom(T.shuffle[0]);
    const b = blockRect(i, geom);
    const home = b.x + b.w / 2;
    const gather = eInOut(clamp((p - 0.3) / 0.7, 0, 1));
    const swing = S * 0.58 * (1 - eOutCubic(p));
    const phase = p * Math.PI * 2 * RIFFLE_CYCLES + i * RIFFLE_LAG;
    const settle = clamp((p - 0.68) / 0.32, 0, 1);
    return {
      x: lerp(home, cx, gather) + Math.sin(phase) * swing,
      y: cy,
      rot: 0,
      depth: Math.cos(phase) * (1 - settle) + (i === 0 ? 2 : -0.1 * i) * settle,
      a: i === 0 ? 1 : 1 - clamp((p - 0.86) / 0.14, 0, 1),
      col: i === 0 && p >= BLUE_AT ? BLUE : ACCENT[i % ACCENT.length],
    };
  }

  const flipOnAt = (i: number) => T.flipOn[0] + i * FLIP_STEP;
  const flipOffAt = (i: number) => T.flipOff[0] + i * (FLIP_STEP - 8);
  const revealAt = (i: number) => T.reveal[0] + i * REV_STEP;
  const foldAt = (i: number) => T.fold[0] + (N - 1 - i) * CLOSE_STEP;

  type Phase = {
    solid: number;
    col: RGB;
    glyph: number;
    mosaic: number;
  };

  function letterPhase(i: number, ms: number): Phase {
    const acc = ACCENT[i % ACCENT.length];
    const ph: Phase = { solid: 0, col: BLUE, glyph: 0, mosaic: 0 };

    if (ms >= flipOnAt(i)) ph.col = acc;
    if (ms >= flipOffAt(i)) ph.col = BLUE;

    if (ms >= revealAt(i) && ms < foldAt(i)) {
      const q = span(ms, [revealAt(i), revealAt(i) + REV_DUR]);
      ph.solid = clamp(q / 0.62, 0, 1);
      ph.glyph = clamp((q - 0.72) / 0.28, 0, 1);
      ph.mosaic = 1 - ph.glyph;
    } else if (ms >= foldAt(i)) {
      const q = span(ms, [foldAt(i), foldAt(i) + CLOSE_DUR]);
      ph.glyph = 1 - clamp(q / 0.22, 0, 1);
      ph.solid = 1 - clamp((q - 0.14) / 0.72, 0, 1);
      ph.mosaic = 1 - ph.glyph;
      ph.col = acc;
    }
    return ph;
  }

  function blockPath(g: CanvasRenderingContext2D, i: number, geom: ReturnType<typeof rowGeom>) {
    const b = blockRect(i, geom);
    const asc = (letters[i]?.ascPx ?? 0) * geom.ascK;
    const rl = i === 0 ? rad : geom.inner;
    const rr = i === N - 1 ? rad : geom.inner;

    if (asc > 2) {
      const stem = b.w * 0.44;
      const y = b.y - asc;
      const r = rad;
      if (letters[i].stemLeft) {
        roundPoly(g, [
          [b.x, y], [b.x + stem, y], [b.x + stem, b.y],
          [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h],
        ], [r, r, r * 0.5, rr, rr, rl]);
      } else {
        roundPoly(g, [
          [b.x + b.w - stem, y], [b.x + b.w, y], [b.x + b.w, b.y + b.h],
          [b.x, b.y + b.h], [b.x, b.y], [b.x + b.w - stem, b.y],
        ], [r, r, rr, rl, rl, r * 0.5]);
      }
    } else {
      rectPath(g, b.x, b.y, b.w, b.h, rl, rr);
    }
  }

  function drawBlock(g: CanvasRenderingContext2D, i: number, geom: ReturnType<typeof rowGeom>, ph: Phase) {
    if (ph.solid >= 1) return;
    const b = blockRect(i, geom);
    const asc = (letters[i]?.ascPx ?? 0) * geom.ascK;
    g.save();
    blockPath(g, i, geom);
    g.clip();
    g.fillStyle = css(ph.col);
    if (ph.solid <= 0.001) {
      g.fillRect(b.x, b.y - asc, b.w, b.h + asc);
    } else {
      const x0 = Math.floor((b.x - gridX) / cell) * cell + gridX;
      const y0 = Math.floor((b.y - asc - gridY) / cell) * cell + gridY;
      for (let y = y0; y < b.y + b.h; y += cell) {
        for (let x = x0; x < b.x + b.w; x += cell) {
          const gx = Math.round((x - gridX) / cell), gy = Math.round((y - gridY) / cell);
          if (dither(gx, gy) < ph.solid) continue;
          g.fillRect(x, y, cell + 0.6, cell + 0.6);
        }
      }
    }
    g.restore();
  }

  function drawCells(g: CanvasRenderingContext2D, i: number, ph: Phase) {
    if (ph.mosaic <= 0.002) return;
    const acc = ACCENT[i % ACCENT.length];
    const sz = Math.max(1, cell - lerp(cell * 0.16, 0, ph.glyph));
    const r = sz * 0.14;

    for (const p of particles) {
      if (p.bi !== i) continue;
      const th = dither(p.gx, p.gy);
      if (th >= ph.solid) continue;
      const age = clamp((ph.solid - th) / 0.3, 0, 1);
      const pop = 0.62 + 0.38 * eOutCubic(age);
      const d = (sz * (1 - pop)) / 2;

      g.globalAlpha = ph.mosaic * Math.min(1, age * 3);
      g.fillStyle = css(age > 0.55 ? BLUE : acc);
      rectPath(g, p.x + d, p.y + d, sz * pop, sz * pop, r, r);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function drawGlyph(g: CanvasRenderingContext2D, i: number, ph: Phase) {
    if (ph.glyph <= 0.002 || !letters[i]) return;
    g.save();
    g.beginPath();
    g.rect(letters[i].advL, 0, letters[i].advR - letters[i].advL, H);
    g.clip();
    g.globalAlpha = ph.glyph;
    g.font = o.font.replace('{size}', String(fontSize));
    g.textBaseline = 'alphabetic';
    g.fillStyle = css(BLUE);
    g.fillText(o.text, textX, baseY);
    g.restore();
  }

  function card(g: CanvasRenderingContext2D, x: number, y: number, rot: number, sc: number, a: number, col: RGB) {
    if (a <= 0.002 || sc <= 0.002) return;
    g.save();
    g.globalAlpha = a;
    g.translate(x, y);
    g.rotate(rot * DEG);
    g.scale(sc, sc);
    g.fillStyle = css(col);
    rectPath(g, -S / 2, -S / 2, S, S, rad, rad);
    g.fill();
    g.restore();
  }

  function scene(ms: number) {
    const g = ctx;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.fillStyle = css(BG);
    g.fillRect(0, 0, W, H);

    if (ms < T.converge[1]) {
      if (ms < T.wheel[0]) {
        const v = vortex(ms, 1);
        card(g, v.x, v.y, v.rot, v.sc, 1, BLUE);
        return;
      }
      const order = DECK.map((_d, i) => i).sort((a, b) => DECK[a].z - DECK[b].z);
      for (const i of order) {
        const rs = ringState(i, ms);
        card(g, cx + rs.dx * S, cy + rs.dy * S, rs.rot, rs.sc, rs.a, DECK[i].hue);
      }
      return;
    }

    if (ms >= T.shuffle[0]) {
      if (ms >= T.vortexOut[0]) {
        const v = vortex(ms, -1);
        card(g, v.x, v.y, v.rot, v.sc, 1, BLUE);
        return;
      }
      const order = [...Array(N).keys()].sort(
        (a, b) => riffleState(a, ms).depth - riffleState(b, ms).depth,
      );
      for (const i of order) {
        const r = riffleState(i, ms);
        card(g, r.x, r.y, r.rot, 1, r.a, r.col);
      }
      return;
    }

    const geom = rowGeom(ms);
    for (let i = 0; i < N; i++) {
      const ph = letterPhase(i, ms);
      drawBlock(g, i, geom, ph);
      drawCells(g, i, ph);
      drawGlyph(g, i, ph);
    }
  }

  function buildCues() {
    const list: { t: number; cue: SoundCue; i: number }[] = [
      { t: 40, cue: 'seed', i: 0 },
      { t: T.wheel[0] + 40, cue: 'wheel', i: 0 },
      { t: T.converge[1] - 140, cue: 'collapse', i: 0 },
      { t: T.expand[0], cue: 'expand', i: 0 },
      { t: T.split[1] - 40, cue: 'split', i: 0 },
      { t: revealAt(N - 1) + REV_DUR - 60, cue: 'chord', i: 0 },
      { t: T.shuffle[0], cue: 'contract', i: 0 },
      { t: T.vortexOut[0], cue: 'absorb', i: 0 },
    ];
    for (let i = 0; i < DECK.length; i++) {
      let ms = T.wheel[0];
      while (ms < T.wheel[1] && theta(ms) < i * LAG) ms += 8;
      list.push({ t: ms, cue: 'card', i });
    }
    for (let i = 0; i < N; i++) {
      list.push({ t: flipOnAt(i), cue: 'flipOn', i });
      list.push({ t: flipOffAt(i), cue: 'flipOff', i });
      list.push({ t: revealAt(i) + REV_DUR * REV_HIT, cue: 'reveal', i });
      list.push({ t: foldAt(i) + CLOSE_DUR * CLOSE_HIT, cue: 'fold', i: N - 1 - i });
    }
    list.push({ t: T.shuffle[0] + (T.shuffle[1] - T.shuffle[0]) * 0.8, cue: 'flipOff', i: 0 });

    const shuffleMs = T.shuffle[1] - T.shuffle[0];
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < 8; k++) {
        const p =
          (Math.PI / 2 + k * Math.PI - i * RIFFLE_LAG) / (Math.PI * 2 * RIFFLE_CYCLES);
        if (p <= 0.02 || p >= 0.95) continue;
        if (Math.pow(1 - p, 3) < 0.1) continue;
        list.push({ t: T.shuffle[0] + p * shuffleMs, cue: 'riffle', i });
      }
    }
    list.sort((a, b) => a.t - b.t);
    cues = list;
  }

  function fireCues(from: number, to: number) {
    while (cueAt < cues.length && cues[cueAt].t <= to) {
      const c = cues[cueAt++];
      if (c.t > from) sound.play(c.cue, c.i);
    }
  }

  function seekCues(to: number) {
    cueAt = 0;
    while (cueAt < cues.length && cues[cueAt].t <= to) cueAt++;
  }

  function frame(now: number) {
    if (!t0) t0 = now;
    const prev = t;
    t = (now - t0) * o.speed;
    if (t >= DURATION) {
      if (o.loop) { t0 = now; t = 0; cueAt = 0; }
      else {
        t = DURATION;
        fireCues(prev, t);
        scene(t);
        playing = false;
        o.onDone && o.onDone();
        return;
      }
    }
    fireCues(prev, t);
    scene(t);
    raf = requestAnimationFrame(frame);
  }

  const api: BaseIntroHandle = {
    play() {
      cancelAnimationFrame(raf);
      t0 = 0; t = 0; cueAt = 0; playing = true;
      if (o.sound) sound.unlock();
      raf = requestAnimationFrame(frame);
      return api;
    },
    resume() {
      if (playing) return api;
      cancelAnimationFrame(raf);
      playing = true;
      t0 = performance.now() - t / o.speed;
      raf = requestAnimationFrame(frame);
      return api;
    },
    pause() { cancelAnimationFrame(raf); playing = false; return api; },
    seek(ms: number) {
      cancelAnimationFrame(raf);
      playing = false;
      t = clamp(ms, 0, DURATION);
      seekCues(t);
      scene(t);
      return api;
    },
    setSound(on: boolean) { o.sound = on; sound.setEnabled(on); },
    get time() { return t; },
    get duration() { return DURATION; },
    get playing() { return playing; },
    resize,
    destroy() {
      cancelAnimationFrame(raf);
      playing = false;
      ro && ro.disconnect();
      sound.close();
    },
  };

  xhRatio = measureXHeight();
  resize();
  buildCues();

  const ro = ('ResizeObserver' in window) ? new ResizeObserver(() => {
    resize();
    if (!playing) scene(t);
  }) : null;
  ro && ro.observe(canvas);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { xhRatio = measureXHeight(); resize(); if (!playing) scene(t); });
  }

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { api.seek(T.hold[0] + 200); o.onDone && setTimeout(o.onDone, 900); }
  else if (o.autoplay) api.play();

  return api;
}

export default createBaseIntro;
