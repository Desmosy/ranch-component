export interface ScatterConfig {
  spread: number;
  chaos: number;
  seed: number;
}

export const SHATTER_DEFAULTS: ScatterConfig = {
  spread: 1,
  chaos: 1,
  seed: 42,
};

export interface LetterHome {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ScatterTarget {
  x: number;
  y: number;
  rot: number;
  scale: number;
  ripple: number;
}

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Placed {
  x: number;
  y: number;
  r: number;
}

function relax(
  points: Placed[],
  stage: { w: number; h: number },
  ex: number,
  ey: number,
  iterations = 14
) {
  const cx = stage.w / 2;
  const cy = stage.h / 2;

  for (let pass = 0; pass < iterations; pass++) {
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.r + b.r;
        if (d >= min || d === 0) continue;

        const push = (min - d) / 2;
        dx /= d;
        dy /= d;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }

    for (const p of points) {
      p.x = clamp(p.x, p.r, stage.w - p.r);
      p.y = clamp(p.y, p.r, stage.h - p.r);

      const nx = (p.x - cx) / ex;
      const ny = (p.y - cy) / ey;
      const dist = Math.hypot(nx, ny);
      if (dist < 1 && dist > 0) {
        p.x = cx + (nx / dist) * ex;
        p.y = cy + (ny / dist) * ey;
      }
    }
  }
}

export function buildScatter(
  homes: LetterHome[],
  stage: { w: number; h: number },
  exclusion: { w: number; h: number },
  cfg: ScatterConfig
): ScatterTarget[] {
  const n = homes.length;
  const rand = mulberry32(cfg.seed * 2654435761 + n);
  const cx = stage.w / 2;
  const cy = stage.h / 2;

  const ex = Math.max(exclusion.w / 2 + stage.w * 0.055, stage.w * 0.12);
  const ey = Math.max(exclusion.h / 2 + stage.h * 0.06, stage.h * 0.14);

  const order = homes.map((_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  let maxHomeDist = 1;
  for (const h of homes) {
    const d = Math.hypot(h.x - cx, h.y - cy);
    if (d > maxHomeDist) maxHomeDist = d;
  }

  const rots: number[] = new Array(n);
  const scales: number[] = new Array(n);
  const placed: Placed[] = new Array(n);

  for (let slot = 0; slot < n; slot++) {
    const i = order[slot];
    const home = homes[i];

    const theta = (slot * GOLDEN_ANGLE + rand() * 0.3 - 0.15) % TAU;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const scale = 1 + (rand() * 0.24 - 0.1) * cfg.chaos;
    rots[i] = (rand() * 2 - 1) * 13 * cfg.chaos;
    scales[i] = scale;

    const padX = (home.w * scale) / 2 + stage.w * 0.025;
    const padY = (home.h * scale) / 2 + stage.h * 0.025;

    const toEdge = Math.min(
      Math.abs(cos) < 1e-4 ? Infinity : (cx - padX) / Math.abs(cos),
      Math.abs(sin) < 1e-4 ? Infinity : (cy - padY) / Math.abs(sin)
    );
    const toEllipse = 1 / Math.hypot(cos / ex, sin / ey);

    const inner = Math.min(toEllipse * 1.04, toEdge * 0.9);
    const band = clamp(0.42 + rand() * 0.58 * clamp(cfg.spread, 0, 2), 0, 1);
    const r = inner + (toEdge - inner) * band;

    placed[i] = {
      x: clamp(cx + cos * r, padX, stage.w - padX),
      y: clamp(cy + sin * r, padY, stage.h - padY),
      r: (Math.max(home.w, home.h * 0.72) * scale) / 2 + 3,
    };
  }

  relax(placed, stage, ex, ey);

  const targets: ScatterTarget[] = new Array(n);
  for (let i = 0; i < n; i++) {
    targets[i] = {
      x: placed[i].x - homes[i].x,
      y: placed[i].y - homes[i].y,
      rot: rots[i],
      scale: scales[i],
      ripple: Math.hypot(homes[i].x - cx, homes[i].y - cy) / maxHomeDist,
    };
  }

  return targets;
}
