import { ORDER, type SpeciesId } from "./species";

/**
 * The chain.
 *
 * Every body follows the body in front of it, and nothing else. It is never
 * told where the cursor is — only the leader knows that. Each link applies its
 * own integrator to the same instruction, so a turn is re-interpreted at every
 * step and the error compounds down the line. By the tail, a straight sweep of
 * the cursor has become something else entirely, which is the entire piece.
 *
 * The list is walked front to back so each body reads its parent's position as
 * already updated this frame. Walk it the other way and every link lags by
 * exactly one frame instead of accumulating, and the chain moves as one stiff
 * object.
 */

export interface Body {
  species: SpeciesId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  head: number;
  phase: number;
  seed: number;
  effort: number;
  /** Distance it is meant to hold from the body in front. */
  rest: number;
  /** Discrete movers bank up distance until they can afford a step. */
  debt: number;
}

const REST = [0, 58, 54, 62, 58, 66, 56];

export type Phase = "open" | "closing" | "closed" | "collapsing" | "collapsed";

export interface Organism {
  bodies: Body[];
  phase: Phase;
  /** How long the cursor has been engaged this cycle, in ms. */
  engaged: number;
  /** How many times the loop has been broken open again. */
  gen: number;
  /** 1 → 0 through the collapse. */
  scale: number;
  /** Where the whole thing ends up. */
  markX: number;
  markY: number;
}

export const LOOP_AFTER = 9500;
export const COLLAPSE_AT = 5;

export function makeOrganism(w: number, h: number): Organism {
  // Laid out down the plate at its own rest lengths, so it opens still and
  // already elongated rather than assembling itself in front of you.
  let y = h * 0.2;
  const bodies: Body[] = ORDER.map((species, i) => {
    const rest = REST[Math.min(i, REST.length - 1)];
    y += rest;
    return {
      species,
      x: w * 0.5,
      y,
      vx: 0,
      vy: 0,
      head: Math.PI / 2,
      phase: i * 1.7,
      seed: i * 13 + 3,
      effort: 0,
      rest,
      debt: 0,
    };
  });
  return {
    bodies,
    phase: "open",
    engaged: 0,
    gen: 0,
    scale: 1,
    markX: w * 0.5,
    markY: h * 0.5,
  };
}

function easeAngle(from: number, to: number, k: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d * k;
}

/**
 * Where a body wants to stand: `rest` behind its parent, on the line between
 * them. Holding a rest length rather than homing on the parent is what keeps
 * the organism elongated — and it is also what makes the closed loop circle
 * forever instead of collapsing to its own centroid.
 */
function station(b: Body, px: number, py: number) {
  const dx = px - b.x;
  const dy = py - b.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: px - (dx / d) * b.rest, y: py - (dy / d) * b.rest, dx, dy, d };
}

/** Each species answers the same instruction in its own physics. */
function advance(b: Body, tx: number, ty: number, dt: number, swim: number) {
  const k = dt / 16.7;
  const px = b.x;
  const py = b.y;

  switch (b.species) {
    case "ascii": {
      // Precise. Almost no lag, no overshoot.
      const a = 1 - (1 - 0.3) ** k;
      b.x += (tx - b.x) * a;
      b.y += (ty - b.y) * a;
      break;
    }
    case "ink": {
      // Elastic tissue — a spring that overshoots and settles.
      b.vx += (tx - b.x) * 0.05 * k;
      b.vy += (ty - b.y) * 0.05 * k;
      b.vx *= 0.88 ** k;
      b.vy *= 0.88 ** k;
      b.x += b.vx * k;
      b.y += b.vy * k;
      break;
    }
    case "halftone": {
      // Lags, and the lag is the point — it is what stretches the screen.
      const a = 1 - (1 - 0.055) ** k;
      b.x += (tx - b.x) * a;
      b.y += (ty - b.y) * a;
      break;
    }
    case "pixel": {
      // Discrete. It banks distance and spends it in whole steps.
      const dx = tx - b.x;
      const dy = ty - b.y;
      const d = Math.hypot(dx, dy);
      b.debt += d * 0.06 * k;
      const STEP = 5;
      while (b.debt >= STEP && d > 0.001) {
        b.x += (dx / d) * STEP;
        b.y += (dy / d) * STEP;
        b.debt -= STEP;
      }
      break;
    }
    case "type": {
      // Holds its ground and turns instead. The chain has to bend around it.
      const a = 1 - (1 - 0.014) ** k;
      b.x += (tx - b.x) * a;
      b.y += (ty - b.y) * a;
      break;
    }
    case "math": {
      // Orbits rather than arrives — it is never where it was sent.
      b.phase += 0.045 * k;
      const a = 1 - (1 - 0.09) ** k;
      const orbit = 16;
      b.x += (tx + Math.cos(b.phase * 1.4) * orbit - b.x) * a;
      b.y += (ty + Math.sin(b.phase * 1.4) * orbit - b.y) * a;
      break;
    }
    case "noise": {
      // Barely keeps up, and wanders while failing to.
      const a = 1 - (1 - 0.022) ** k;
      b.x += (tx - b.x) * a + Math.sin(b.phase * 3.1) * 0.25 * k;
      b.y += (ty - b.y) * a + Math.cos(b.phase * 2.3) * 0.25 * k;
      break;
    }
  }

  if (swim !== 0) {
    // A tangential nudge, only ever applied once the ring is closed: a loop of
    // pure followers has no reason to keep moving, and would quietly wind down
    // to a dot. This is the organism's own heartbeat.
    const dx = b.x - px;
    const dy = b.y - py;
    const d = Math.hypot(dx, dy) || 1;
    b.x += (-dy / d) * swim * k;
    b.y += (dx / d) * swim * k;
  }

  const mx = b.x - px;
  const my = b.y - py;
  const moved = Math.hypot(mx, my);
  b.effort += (Math.min(1, moved / 6) - b.effort) * 0.12 * k;
  if (moved > 0.12) b.head = easeAngle(b.head, Math.atan2(my, mx), 0.18 * k);
  b.phase += 0.02 * k;
}

export function step(
  org: Organism,
  pointer: { x: number; y: number } | null,
  dt: number,
  w: number,
  h: number,
) {
  const list = org.bodies;
  const head = list[0];
  const tail = list[list.length - 1];

  if (org.phase === "collapsed") {
    const tx = pointer ? pointer.x : w * 0.5;
    const ty = pointer ? pointer.y : h * 0.52;
    org.markX += (tx - org.markX) * 0.055 * (dt / 16.7);
    org.markY += (ty - org.markY) * 0.055 * (dt / 16.7);
    return;
  }

  if (org.phase === "open" && pointer) {
    org.engaged += dt;
    if (org.engaged > LOOP_AFTER) org.phase = "closing";
  }

  if (org.phase === "collapsing") {
    org.scale -= dt / 2600;
    for (const b of list) b.rest *= 1 - dt / 2200;
    if (org.scale <= 0.06) {
      org.phase = "collapsed";
      org.markX = head.x;
      org.markY = head.y;
      return;
    }
  }

  // Who the leader is chasing. In a closed loop there is no leader left — it
  // is chasing the tail, which is chasing everything back round to itself.
  const chasingTail = org.phase === "closing" || org.phase === "closed" || org.phase === "collapsing";
  const swim = org.phase === "closed" || org.phase === "collapsing" ? 1.5 : 0;

  const leadX = chasingTail ? tail.x : pointer ? pointer.x : head.x;
  const leadY = chasingTail ? tail.y : pointer ? pointer.y : head.y;

  if (chasingTail) {
    const st = station(head, leadX, leadY);
    advance(head, st.x, st.y, dt, swim);
    if (org.phase === "closing" && st.d < head.rest * 1.35) org.phase = "closed";
  } else if (pointer) {
    advance(head, leadX, leadY, dt, 0);
  } else {
    advance(head, head.x, head.y, dt, 0);
  }

  for (let i = 1; i < list.length; i++) {
    const b = list[i];
    const p = list[i - 1];
    const st = station(b, p.x, p.y);
    advance(b, st.x, st.y, dt, swim);
    if (b.species === "type") {
      // It does not travel to its parent; it faces it.
      b.head = easeAngle(b.head, Math.atan2(p.y - b.y, p.x - b.x), 0.12 * (dt / 16.7));
    }
  }
}

/** The cursor coming back breaks the ring open, and costs the organism a life. */
export function reengage(org: Organism) {
  if (org.phase !== "closed") return;
  org.gen += 1;
  org.engaged = 0;
  org.phase = org.gen >= COLLAPSE_AT ? "collapsing" : "open";
}
