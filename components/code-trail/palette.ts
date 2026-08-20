/**
 * Tonal palette.
 *
 * One hue per row. The badges inside a row are different *tones* of that hue,
 * and the ink is another tone of the same hue — so a line of code reads as one
 * colour torn into pieces rather than a row of unrelated tags. The hue itself
 * walks the wheel from row to row, so the ribbon is a gradient down its length.
 *
 * Legibility is deliberately uneven: the ink sits a varying number of steps
 * away from the paper, so a few bars read cleanly and the rest are texture.
 */

/** Hue families, walked with a coprime stride so neighbours never merge. */
export const HUES = [8, 26, 42, 92, 148, 176, 202, 226, 268, 322, 344];
const HUE_STRIDE = 4; // coprime with 11

/** Lightness ramp, light paper to deep ink. */
const TONES = [95, 86, 75, 63, 51, 40, 29, 18];

/** Saturation falls off at the ends of the ramp so the extremes stay paper-like. */
function satFor(l: number): number {
  return Math.max(24, 74 - Math.abs(l - 57) * 0.42);
}

export function tone(hue: number, index: number, shift = 0): string {
  const i = Math.max(0, Math.min(TONES.length - 1, index));
  const l = TONES[i];
  return `hsl(${(hue + shift + 360) % 360} ${satFor(l).toFixed(0)}% ${l}%)`;
}

export const TONE_COUNT = TONES.length;

/**
 * How far the ink sits from the paper, cycled rather than rolled. Small gaps
 * are nearly unreadable on purpose — the eye is meant to land on two or three
 * bars and take the rest as colour.
 */
const INK_GAPS = [5, -3, 2, -5, 4, -2, 6, -4, 3];

/** Which tone the paper of the next badge takes. Coprime stride again. */
const PAPER_STEPS = [1, 4, 2, 6, 3, 5];

export const UNDERLINE_EVERY = 7;
export const INK_EVERY = 9;
export const KNOCKOUT_EVERY = 11;

export function makeStepper(len: number, stride: number) {
  let i = Math.floor(Math.random() * len);
  return () => {
    i = (i + stride) % len;
    return i;
  };
}

export interface Skin {
  bg: string;
  fg: string;
  underline: boolean;
  /** A near-solid ink bar — punctuation for the ribbon, not a colour. */
  ink: boolean;
  /** Offset second impression, as if the plate slipped on the press. */
  ghost: string;
  /** No paper at all: outlined type over whatever is behind. Rare. */
  knockout: boolean;
}

export function makeSkinner() {
  const nextHue = makeStepper(HUES.length, HUE_STRIDE);
  let paper = 2;
  let gapAt = 0;
  let stepAt = 0;
  let sinceUnderline = 0;
  let sinceInk = Math.floor(Math.random() * INK_EVERY);
  let sinceKnock = Math.floor(Math.random() * KNOCKOUT_EVERY);

  return {
    /** One hue per row; call once before painting the row's badges. */
    nextHue: () => HUES[nextHue()],

    paint(hue: number): Skin {
      paper = (paper + PAPER_STEPS[stepAt++ % PAPER_STEPS.length]) % TONE_COUNT;

      const gap = INK_GAPS[gapAt++ % INK_GAPS.length];
      let ink = paper + gap;
      // Reflect rather than clamp, so an edge tone still gets contrast.
      if (ink < 0 || ink >= TONE_COUNT) ink = paper - gap;
      ink = Math.max(0, Math.min(TONE_COUNT - 1, ink));

      sinceUnderline++;
      const underline = sinceUnderline >= UNDERLINE_EVERY;
      if (underline) sinceUnderline = 0;

      sinceInk++;
      const isInk = sinceInk >= INK_EVERY;
      if (isInk) sinceInk = 0;

      sinceKnock++;
      const knockout = !isInk && sinceKnock >= KNOCKOUT_EVERY;
      if (knockout) sinceKnock = 0;

      // The second impression sits a long way round the wheel from the ink —
      // that is what a slipped plate looks like, not a drop shadow.
      const ghost = tone(hue, Math.min(TONE_COUNT - 1, ink + 2), gap > 0 ? -52 : 48);

      // The ink bar keeps the row's hue so it reads as the same material.
      if (isInk) {
        return {
          bg: `hsl(${hue} 42% 11%)`,
          fg: tone(hue, 0, 6),
          underline,
          ink: true,
          ghost,
          knockout: false,
        };
      }

      // A few degrees of hue drift between paper and ink keeps a tonal pair
      // from going flat without leaving the family.
      const shift = gap > 0 ? 14 : -12;
      return {
        bg: knockout ? "transparent" : tone(hue, paper),
        fg: knockout ? tone(hue, 1, shift) : tone(hue, ink, shift),
        underline,
        ink: false,
        ghost,
        knockout,
      };
    },
  };
}
