/**
 * The type bed (§2.2).
 *
 * Four discrete size steps, never interpolated — the jump between steps is
 * what gives the poster its rhythm. Sizes are in `cqw`, not `vw`, because this
 * lives in a card: the bed has to scale with its container, not with the
 * window, or the same component is unreadable in a grid tile and enormous on
 * its own page.
 *
 * Composed by hand. A generated bed lands the size changes in the wrong places
 * — the rhythm is the design.
 */

export const STEPS = [12, 7, 4.5, 2.5] as const;

export interface Line {
  text: string;
  /** Index into STEPS. */
  step: number;
  /** Horizontal bleed, in cqw. Negative runs off the left edge. */
  shift: number;
}

/**
 * Open question 4, answered provisionally: short, punchy, and about the thing
 * itself. Swap via the `lines` prop — the composition below is the seam where
 * real copy drops in, and the only rule is that the strings stay short enough
 * to repeat across a line at 12cqw.
 */
export const DEFAULT_LINES = [
  "CLEARING",
  "PUSH IT ASIDE",
  "IT FLOWS BACK",
  "READ WHAT IS UNDER",
];

/** Repeat counts and size steps per row, hand-set. */
const COMPOSITION: Array<[line: number, step: number, repeats: number, shift: number]> = [
  [0, 1, 3, -6],
  [1, 3, 6, -2],
  [0, 0, 2, -10],
  [2, 2, 4, -4],
  [3, 3, 4, -1],
  [1, 0, 2, -14],
  [0, 2, 5, -3],
  [2, 1, 3, -8],
  [3, 2, 4, -2],
  [1, 1, 3, -5],
  [0, 3, 6, -1],
  [2, 0, 2, -9],
  [3, 1, 3, -4],
  [1, 2, 5, -2],
  [0, 1, 3, -11],
];

export function composeBed(lines: string[]): Line[] {
  return COMPOSITION.map(([li, step, repeats, shift]) => ({
    text: Array(repeats).fill(lines[li % lines.length]).join("   "),
    step,
    shift,
  }));
}

export const BED_FONT =
  '"Druk Condensed", "Founders Grotesk Condensed", "Archivo Narrow", Oswald, "Haettenschweiler", "Arial Narrow", Impact, sans-serif';
