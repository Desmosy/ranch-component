import { FRAGMENTS, drawMatching, makeBag, type Fragment } from "./fragments";
import { makeSkinner, type Skin } from "./palette";

export interface Vec {
  x: number;
  y: number;
}

export interface Badge extends Skin {
  text: string;
  comment: boolean;
  /**
   * A torn left edge, as four px offsets down the height. Badges overlap their
   * neighbour by a hair, so a tear reveals the piece underneath rather than the
   * plate — the run reads as source that got sliced and re-laid, not as tags.
   */
  tear: [number, number, number, number];
}

/** Clip path for a torn left edge. Right edge stays true so runs still butt. */
export function tearPath(t: Badge["tear"]): string {
  return (
    `polygon(${t[0].toFixed(1)}px 0%, 100% 0%, 100% 100%, ` +
    `${t[3].toFixed(1)}px 100%, ${t[2].toFixed(1)}px 66%, ${t[1].toFixed(1)}px 33%)`
  );
}

export interface RowData {
  badges: Badge[];
  /** Small per-row tilt, so the stack reads as laid paper rather than a shear. */
  tilt: number;
}

export const ROWS = 24;
export const MAX_BADGES = 3;

/** Tear amplitude, and the overlap that keeps a tear off the plate. */
export const TEAR_PX = 5;
export const LAP_PX = 3;
/** Second impression offset — a slipped plate, not a shadow. */
export const MISPRINT_PX = 1.4;

export const FONT_RATIO = 1 / 42;
export const LINE_RATIO = 1.24;
export const PAD_RATIO = 0.34;
/** dx = -step, dy = +line -> atan(1 / 1.43) ≈ 35deg down-and-left. */
export const STEP_RATIO = 1.43;

/** A new row is pushed once the head has travelled this fraction of the width. */
export const TRAVEL_RATIO = 0.055;

/**
 * The chase rate ramps down the chain. One rate for every row makes the stack
 * move as a single rigid object; the gradient is what makes it feel dragged.
 */
const CHASE_HEAD = 0.34;
const CHASE_TAIL = 0.16;

export function chaseRate(slot: number, total: number): number {
  const t = total <= 1 ? 0 : slot / (total - 1);
  return CHASE_HEAD + (CHASE_TAIL - CHASE_HEAD) * t;
}

/**
 * Badge count as a spindle: 1 at the head, swelling through the belly, 1 at
 * the tail — so the ribbon has a shape instead of being a sheared rectangle.
 */
export function badgeCount(slot: number, total: number): number {
  const t = total <= 1 ? 0 : slot / (total - 1);
  const swell = Math.sin(Math.PI * t) ** 0.7;
  return Math.max(1, Math.min(MAX_BADGES, 1 + Math.round(swell * (MAX_BADGES - 1))));
}

/** Tail rows sink toward the plate instead of simply fading out. */
export function presence(slot: number, total: number): number {
  const t = total <= 1 ? 0 : slot / (total - 1);
  const START = 0.55;
  if (t <= START) return 1;
  const fade = 1 - ((t - START) / (1 - START)) ** 1.5;
  return Math.max(0, Math.min(1, fade));
}

export function makeRowFactory() {
  const nextFragment = makeBag(FRAGMENTS);
  const skinner = makeSkinner();

  return function buildRow(): RowData {
    const hue = skinner.nextHue();
    const badges: Badge[] = [];

    let need: Fragment["in"] = "free";
    for (let i = 0; i < MAX_BADGES; i++) {
      const f: Fragment = i === 0 ? nextFragment() : drawMatching(nextFragment, need);
      const tear = Array.from({ length: 4 }, () => Math.random() * TEAR_PX) as Badge["tear"];
      badges.push({
        ...skinner.paint(hue),
        text: f.text,
        comment: f.comment === true,
        tear,
      });
      need = f.out === "end" ? "free" : f.out;
      if (f.comment) break;
    }

    return { badges, tilt: (Math.random() - 0.5) * 1.1 };
  };
}

/**
 * Resting motion: straight runs at constant speed with hard turns and a pause
 * on arrival.
 *
 * A looping curve is the obvious way to drift something and it is wrong here:
 * the chain always bends toward wherever the head went, so a path that is
 * always curving gives a ribbon that is always curved and the clean diagonal
 * staircase never appears. Travelling straight and then holding lets the tail
 * catch up and compress the stack into a tight stair before the next run pulls
 * it out again.
 */
export class Drift {
  private at: Vec = { x: 0, y: 0 };
  private from: Vec = { x: 0, y: 0 };
  private target: Vec = { x: 0, y: 0 };
  private elapsed = 0;
  private duration = 1;
  private hold = 0;
  private started = false;

  /** px per ms — duration comes from length / speed, so every run is the same pace. */
  private speed = 0.42;
  private pause = 460;

  constructor(
    private w: number,
    private h: number,
  ) {}

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  /** Continue from the pointer's last position instead of snapping to the middle. */
  reseed(at: Vec) {
    this.at = { ...at };
    this.started = true;
    this.retarget();
  }

  private retarget() {
    const m = 0.16;
    const span = 1 - m * 2;
    let best = { x: this.w * 0.5, y: this.h * 0.5 };
    let bestLen = -1;

    // Prefer a run with some length in it — short hops never let the stack
    // stretch out before it compresses again.
    for (let i = 0; i < 4; i++) {
      const c = {
        x: (m + Math.random() * span) * this.w,
        y: (m + Math.random() * span) * this.h,
      };
      const len = Math.hypot(c.x - this.at.x, c.y - this.at.y);
      if (len > bestLen) {
        bestLen = len;
        best = c;
      }
    }

    this.from = { ...this.at };
    this.target = best;
    this.duration = Math.max(240, bestLen / this.speed);
    this.elapsed = 0;
    this.hold = 0;
  }

  step(dt: number): Vec {
    if (!this.started) {
      this.at = { x: this.w * 0.62, y: this.h * 0.3 };
      this.started = true;
      this.retarget();
    }

    // Paused on arrival: the tail keeps closing while the head stands still,
    // which is when the staircase actually resolves.
    if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold <= 0) this.retarget();
      return { ...this.at };
    }

    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / this.duration);
    this.at = {
      x: this.from.x + (this.target.x - this.from.x) * t,
      y: this.from.y + (this.target.y - this.from.y) * t,
    };

    if (t >= 1) this.hold = this.pause;

    return { ...this.at };
  }
}
