import { pickTile } from "./palette";
import { range, type Rng } from "./rng";

export const GRAVITY = 240;
export const TERMINAL = 420;
export const VISCOSITY_RADIUS = 140;
export const MAX_FROZEN = 5;

export interface Metrics {
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
  w: number;
  h: number;
  particleCap: number;
}

export function metricsFor(w: number, h: number): Metrics {
  // Mobile keeps ~28–30 columns so the field still reads as a mass rather
  // than as five lonely strips.
  const mobile = w < 640;
  const cellW = mobile ? 13 : 18;
  const cellH = mobile ? 19 : 26;
  return {
    cellW,
    cellH,
    cols: Math.max(1, Math.floor(w / cellW)),
    rows: Math.ceil(h / cellH) + 2,
    w,
    h,
    particleCap: mobile ? 200 : 400,
  };
}

export interface Column {
  index: number;
  /** Cells per second, fixed at init. */
  speed: number;
  /** Fractional step accumulator; seeded with the phase so columns never
   *  step in unison. */
  acc: number;
  /** Shedding runs off the BASE speed, not the effective one, so a frozen or
   *  viscous column keeps losing cells while it holds still (§5.2). */
  shedAcc: number;
  /** Corpus read head. */
  offset: number;
  /** Scales where the envelope's ramp begins — the ragged bottom edge. */
  multiplier: number;
  /** Colour per ROW. Bound to screen position, never to the glyph. */
  colors: Uint8Array;
  /** Glyph per cell. Shifts down one row per step. */
  glyphs: Uint16Array;
  /** Per-cell envelope threshold, travelling with its cell. */
  thresh: Float32Array;
  /** Whether a cell is currently in the ribbon at all. */
  live: Uint8Array;
  factor: number;
  target: number;
  tau: number;
  frozen: boolean;
  /** Fade for build-in and for reset (§4.1). */
  alpha: number;
  alphaTarget: number;
  resetIn: number;
  /** Build-in delay, left-to-right stagger. */
  wakeIn: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tile: number;
  glyph: number;
  live: boolean;
}

/**
 * Density envelope (§3.1). Monotonically decreasing, which is the property the
 * presence test below depends on.
 */
export function envelope(y: number, rampStart: number): number {
  if (y <= rampStart) return 1;
  if (y <= 0.85) return 1 + (0.15 - 1) * ((y - rampStart) / (0.85 - rampStart));
  return 0.15 * (1 - (y - 0.85) / 0.15);
}

export function shedChance(y: number): number {
  return Math.max(0, Math.min(1, (y - 0.6) / 0.4)) * 0.08;
}

export class Field {
  cols: Column[] = [];
  particles: Particle[] = [];
  private free: number[] = [];
  private corpus: string;
  private rng: Rng;
  m: Metrics;
  /** Seconds since the field was created; drives the build-in. */
  age = 0;
  frozenOrder: number[] = [];

  constructor(m: Metrics, corpus: string, rng: Rng) {
    this.m = m;
    this.corpus = corpus;
    this.rng = rng;
    for (let i = 0; i < m.cols; i++) this.cols.push(this.makeColumn(i, true));
    for (let i = 0; i < m.particleCap; i++) {
      this.particles.push({ x: 0, y: 0, vx: 0, vy: 0, tile: 0, glyph: 0, live: false });
      this.free.push(i);
    }
  }

  private makeColumn(index: number, initial: boolean): Column {
    const r = this.rng;
    const rows = this.m.rows;
    const c: Column = {
      index,
      speed: range(r, 4.5, 11),
      acc: r(),
      shedAcc: r(),
      offset: Math.floor(r() * this.corpus.length),
      multiplier: range(r, 0.7, 1.15),
      colors: new Uint8Array(rows),
      glyphs: new Uint16Array(rows),
      thresh: new Float32Array(rows),
      live: new Uint8Array(rows),
      factor: 1,
      target: 1,
      tau: 200,
      frozen: false,
      alpha: initial ? 0 : 1,
      alphaTarget: 1,
      resetIn: range(r, 45, 90),
      // Left-to-right stagger. 25ms apart is the intent, but at 80 columns
      // that overruns the 1400ms build-in, so the stagger compresses to fit
      // rather than the budget slipping.
      wakeIn: initial ? index * Math.min(0.025, 1.4 / Math.max(1, this.m.cols)) : 0,
    };
    this.seedColumn(c);
    return c;
  }

  /**
   * Fill a column as though it had already been running. The field must never
   * look like it grew downward after you arrived.
   */
  private seedColumn(c: Column) {
    const r = this.rng;
    for (let row = 0; row < this.m.rows; row++) {
      c.colors[row] = pickTile(r);
      c.glyphs[row] = this.corpus.charCodeAt((c.offset + row) % this.corpus.length);
      c.thresh[row] = r();
      c.live[row] = 1;
    }
    c.offset = (c.offset + this.m.rows) % this.corpus.length;
    this.applyEnvelope(c);
  }

  /**
   * Presence test.
   *
   * Each cell carries a fixed random threshold from birth, and is in the
   * ribbon while envelope(y) is above it. Because the envelope only ever
   * decreases downward, a cell's presence can flip exactly once, on the way
   * out — so the ribbons never strobe, which re-rolling per frame would cause,
   * and the fray still develops as cells descend, which a one-shot roll at the
   * top could not produce (the envelope is 1.0 up there, so nothing would ever
   * be culled).
   */
  private applyEnvelope(c: Column) {
    const ramp = 0.55 * c.multiplier;
    for (let row = 0; row < this.m.rows; row++) {
      const y = (row * this.m.cellH) / this.m.h;
      if (c.live[row] && c.thresh[row] > envelope(y, ramp)) c.live[row] = 0;
    }
  }

  private takeParticle(): Particle | null {
    const i = this.free.pop();
    // At cap we refuse the shed rather than culling a live particle — an
    // established particle vanishing mid-flight is far more visible than one
    // that never left the ribbon.
    if (i === undefined) return null;
    const p = this.particles[i];
    p.live = true;
    return p;
  }

  private releaseParticle(index: number) {
    this.particles[index].live = false;
    this.free.push(index);
  }

  /** One whole-cell step. No interpolation — the stepping IS the look. */
  private stepColumn(c: Column) {
    const rows = this.m.rows;

    for (let row = rows - 1; row > 0; row--) {
      c.glyphs[row] = c.glyphs[row - 1];
      c.thresh[row] = c.thresh[row - 1];
      c.live[row] = c.live[row - 1];
      // Colours deliberately do NOT shift (§2.4).
    }
    c.glyphs[0] = this.corpus.charCodeAt(c.offset);
    c.thresh[0] = this.rng();
    c.live[0] = 1;

    const next = c.offset + 1;
    c.offset = next % this.corpus.length;
    if (next >= this.corpus.length) this.requestReset(c);
  }

  /** Detachment, bottom up. Driven independently of the scroll. */
  private shedPass(c: Column) {
    const rows = this.m.rows;
    const ramp = 0.55 * c.multiplier;
    for (let row = rows - 1; row >= 0; row--) {
      if (!c.live[row]) continue;
      const y = (row * this.m.cellH) / this.m.h;
      // Rows past the bottom edge are not visible, so there is nothing to hide:
      // cull them outright rather than spending a particle on them.
      if (y > 1) {
        c.live[row] = 0;
        continue;
      }
      const culled = c.thresh[row] > envelope(y, ramp);
      if (!culled && this.rng() > shedChance(y)) continue;

      // Both routes out of a ribbon go through the same door. A cell that
      // simply blinked off at the envelope boundary would pop; handing it to
      // the particle system means the handoff is invisible either way.
      const p = this.takeParticle();
      if (!p) {
        if (culled) c.live[row] = 0;
        continue;
      }
      c.live[row] = 0;
      p.x = c.index * this.m.cellW;
      p.y = row * this.m.cellH;
      p.vx = range(this.rng, -14, 14);
      p.vy = c.speed * this.m.cellH * range(this.rng, 0.85, 1);
      p.tile = c.colors[row];
      p.glyph = c.glyphs[row];
    }
  }

  private requestReset(c: Column) {
    c.alphaTarget = 0;
    c.resetIn = -1;
  }

  setViscosity(pointerX: number | null) {
    for (const c of this.cols) {
      if (c.frozen) continue;
      if (pointerX === null) {
        c.target = 1;
        continue;
      }
      const x = c.index * this.m.cellW + this.m.cellW / 2;
      const d = Math.abs(x - pointerX);
      c.target = 1 - 0.75 * (1 - Math.max(0, Math.min(1, d / VISCOSITY_RADIUS)));
    }
  }

  toggleFreeze(x: number) {
    const i = Math.floor(x / this.m.cellW);
    const c = this.cols[i];
    if (!c) return;
    if (c.frozen) {
      c.frozen = false;
      c.tau = 400;
      this.frozenOrder = this.frozenOrder.filter((k) => k !== i);
      return;
    }
    if (this.frozenOrder.length >= MAX_FROZEN) {
      const oldest = this.frozenOrder.shift();
      if (oldest !== undefined && this.cols[oldest]) {
        this.cols[oldest].frozen = false;
        this.cols[oldest].tau = 400;
      }
    }
    c.frozen = true;
    c.tau = 200;
    c.target = 0;
    this.frozenOrder.push(i);
  }

  /** Fixed 60Hz simulation step. dt is always 1/60. */
  simulate(dt: number, speedMultiplier: number) {
    this.age += dt;

    for (const c of this.cols) {
      if (c.wakeIn > 0) {
        c.wakeIn -= dt;
        continue;
      }
      // A timed 600ms fade, not an exponential approach — the reset has to be
      // over when the spec says it is, so resets never visibly overlap.
      c.alpha += Math.sign(c.alphaTarget - c.alpha) * Math.min(Math.abs(c.alphaTarget - c.alpha), dt / 0.6);
      if (c.alphaTarget === 0 && c.alpha < 0.02) {
        // Re-seed under cover of the fade, then come back.
        const rows = this.m.rows;
        for (let row = 0; row < rows; row++) c.colors[row] = pickTile(this.rng);
        c.offset = Math.floor(this.rng() * this.corpus.length);
        this.seedColumn(c);
        c.resetIn = range(this.rng, 45, 90);
        c.alphaTarget = 1;
      }

      if (c.resetIn > 0) {
        c.resetIn -= dt;
        if (c.resetIn <= 0) this.requestReset(c);
      }

      const k = 1 - Math.exp((-dt * 1000) / c.tau);
      c.factor += ((c.frozen ? 0 : c.target) - c.factor) * k;

      c.acc += c.speed * c.factor * speedMultiplier * dt;
      let guard = 0;
      while (c.acc >= 1 && guard++ < 8) {
        this.stepColumn(c);
        c.acc -= 1;
      }

      c.shedAcc += c.speed * speedMultiplier * dt;
      let sguard = 0;
      while (c.shedAcc >= 1 && sguard++ < 8) {
        this.shedPass(c);
        c.shedAcc -= 1;
      }
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.live) continue;
      p.vy = Math.min(p.vy + GRAVITY * dt, TERMINAL);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // They leave at full opacity. Fading reads as evaporation; this piece is
      // shedding, not dissolving.
      if (p.y > this.m.h + this.m.cellH) this.releaseParticle(i);
    }
  }

  /** Resize keeps every column it can and re-seeds only what actually changed. */
  resize(m: Metrics) {
    const rowsChanged = m.rows !== this.m.rows;
    const cellChanged = m.cellW !== this.m.cellW || m.cellH !== this.m.cellH;
    const prev = this.m;
    this.m = m;

    if (cellChanged) {
      this.cols = [];
      for (let i = 0; i < m.cols; i++) this.cols.push(this.makeColumn(i, false));
    } else {
      if (m.cols < this.cols.length) this.cols.length = m.cols;
      while (this.cols.length < m.cols) this.cols.push(this.makeColumn(this.cols.length, false));
      if (rowsChanged) {
        for (const c of this.cols) {
          const colors = new Uint8Array(m.rows);
          const glyphs = new Uint16Array(m.rows);
          const thresh = new Float32Array(m.rows);
          const live = new Uint8Array(m.rows);
          const keep = Math.min(prev.rows, m.rows);
          colors.set(c.colors.subarray(0, keep));
          glyphs.set(c.glyphs.subarray(0, keep));
          thresh.set(c.thresh.subarray(0, keep));
          live.set(c.live.subarray(0, keep));
          for (let row = keep; row < m.rows; row++) {
            colors[row] = pickTile(this.rng);
            glyphs[row] = this.corpus.charCodeAt((c.offset + row) % this.corpus.length);
            thresh[row] = this.rng();
            live[row] = 1;
          }
          c.colors = colors;
          c.glyphs = glyphs;
          c.thresh = thresh;
          c.live = live;
          this.applyEnvelope(c);
        }
      }
    }

    if (m.particleCap !== this.particles.length) {
      this.particles = [];
      this.free = [];
      for (let i = 0; i < m.particleCap; i++) {
        this.particles.push({ x: 0, y: 0, vx: 0, vy: 0, tile: 0, glyph: 0, live: false });
        this.free.push(i);
      }
    }
  }

  /** Build-in progress for a column, 0..1. */
  wake(c: Column): number {
    return c.wakeIn > 0 ? 0 : c.alpha;
  }
}
