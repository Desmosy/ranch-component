import { FINGERTIPS, Hand, MIDDLE_MCP, WRIST } from "./handTracker";

export interface HandGesture {
  hand: Hand;
  pinch: number;
  point: { x: number; y: number };
  span: number;
  fingertips: { x: number; y: number }[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface GestureReading {
  gestures: HandGesture[];
  bothPinched: boolean;
  spread: number;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const dist3 = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.8);

const handSpan = (hand: Hand) =>
  Math.max(0.02, dist(hand.points[WRIST], hand.points[MIDDLE_MCP]));

const PINCH_CLOSED = 0.28;
const PINCH_OPEN = 0.62;
const ENGAGE_ON = 0.7;
const ENGAGE_OFF = 0.4;

export function readGestures(hands: Hand[]): GestureReading {
  const gestures: HandGesture[] = hands.map((hand) => {
    const span = handSpan(hand);
    const thumb = hand.points[4];
    const index = hand.points[8];
    const gap = dist3(thumb, index) / span;

    const t = Math.min(1, Math.max(0, (gap - PINCH_CLOSED) / (PINCH_OPEN - PINCH_CLOSED)));
    const pinch = 1 - t * t * (3 - 2 * t);

    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;
    for (const p of hand.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    return {
      hand,
      pinch,
      point: { x: (thumb.x + index.x) * 0.5, y: (thumb.y + index.y) * 0.5 },
      span,
      fingertips: FINGERTIPS.map((i) => ({ x: hand.points[i].x, y: hand.points[i].y })),
      bounds: { minX, minY, maxX, maxY },
    };
  });

  const pinched = gestures.filter((g) => g.pinch > ENGAGE_ON);
  const bothPinched = pinched.length === 2;
  const spread = bothPinched
    ? dist(pinched[0].point, pinched[1].point) /
      Math.max(0.02, (pinched[0].span + pinched[1].span) * 0.5)
    : 0;

  return { gestures, bothPinched, spread };
}

interface Slot {
  x: number;
  y: number;
  radius: number;
  strength: number;
  engaged: boolean;
  px: number;
  py: number;
}

export class LensState {
  lenses: { x: number; y: number; radius: number; strength: number }[] = [];
  pitch = 5.6;
  warp = 0;
  flow = { x: 0, y: 0 };
  mosh = 0;
  spread = 0;
  bothPinched = false;
  handCount = 0;

  private slots: Slot[] = [
    { x: 0.5, y: 0.5, radius: 0, strength: 0, engaged: false, px: 0.5, py: 0.5 },
    { x: 0.5, y: 0.5, radius: 0, strength: 0, engaged: false, px: 0.5, py: 0.5 },
  ];

  update(reading: GestureReading | null, dt: number) {
    const ease = 1 - Math.pow(0.001, dt);
    const step = Math.max(dt, 1e-3);
    this.handCount = reading?.gestures.length ?? 0;
    this.bothPinched = !!reading?.bothPinched;

    let fastest = { x: 0, y: 0, speed: 0 };

    for (let i = 0; i < 2; i++) {
      const slot = this.slots[i];
      const g = reading?.gestures[i];

      if (g) {
        const vx = (g.point.x - slot.px) / step;
        const vy = (g.point.y - slot.py) / step;
        slot.px = g.point.x;
        slot.py = g.point.y;
        const speed = Math.hypot(vx, vy);
        if (speed > fastest.speed) fastest = { x: vx, y: vy, speed };

        slot.x += (g.point.x - slot.x) * ease;
        slot.y += (g.point.y - slot.y) * ease;

        if (!slot.engaged && g.pinch > ENGAGE_ON) slot.engaged = true;
        else if (slot.engaged && g.pinch < ENGAGE_OFF) slot.engaged = false;

        const target = slot.engaged ? g.span * (0.8 + g.pinch * 1.3) : 0;
        slot.radius += (target - slot.radius) * ease;
        slot.strength += ((slot.engaged ? g.pinch : 0) - slot.strength) * ease;
      } else {
        slot.engaged = false;
        slot.radius += (0 - slot.radius) * ease;
        slot.strength += (0 - slot.strength) * ease;
      }
    }

    this.lenses = this.slots
      .filter((l) => l.radius > 0.002)
      .map(({ x, y, radius, strength }) => ({ x, y, radius, strength }));

    if (reading?.bothPinched) {
      this.spread += (reading.spread - this.spread) * ease;
      const t = Math.min(1, Math.max(0, (this.spread - 1.2) / 6));
      this.pitch += (2.6 + t * 12 - this.pitch) * ease;
    } else {
      this.pitch += (5.6 - this.pitch) * (ease * 0.5);
    }

    const strongest = this.slots.reduce((m, l) => Math.max(m, l.strength), 0);
    this.warp += (strongest - this.warp) * ease;

    const flowEase = 1 - Math.pow(0.02, dt);
    this.flow.x += (fastest.x - this.flow.x) * flowEase;
    this.flow.y += (fastest.y - this.flow.y) * flowEase;
    const targetMosh = Math.min(1, fastest.speed / 0.9);
    this.mosh += (targetMosh - this.mosh) * (targetMosh > this.mosh ? flowEase : flowEase * 0.35);
  }
}
