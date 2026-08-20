export type PressPalette = "riso" | "newsprint" | "blueprint" | "acid";

export interface PaletteSpec {
  name: string;
  paper: [number, number, number];
  ink: [number, number, number];
  accent: [number, number, number];
  additive: number;
  css: { paper: string; ink: string; accent: string; faint: string };
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const PALETTES: Record<PressPalette, PaletteSpec> = {
  riso: {
    name: "Riso",
    paper: rgb("#f2e9d5"),
    ink: rgb("#191413"),
    accent: rgb("#ff4a1c"),
    additive: 0,
    css: { paper: "#f2e9d5", ink: "#191413", accent: "#ff4a1c", faint: "rgba(25,20,19,0.35)" },
  },
  newsprint: {
    name: "Newsprint",
    paper: rgb("#e4e1d6"),
    ink: rgb("#14171c"),
    accent: rgb("#1f4ed8"),
    additive: 0,
    css: { paper: "#e4e1d6", ink: "#14171c", accent: "#1f4ed8", faint: "rgba(20,23,28,0.35)" },
  },
  blueprint: {
    name: "Blueprint",
    paper: rgb("#0b2038"),
    ink: rgb("#cfe3ff"),
    accent: rgb("#ffc94d"),
    additive: 1,
    css: { paper: "#0b2038", ink: "#cfe3ff", accent: "#ffc94d", faint: "rgba(207,227,255,0.35)" },
  },
  acid: {
    name: "Acid",
    paper: rgb("#0d0d0d"),
    ink: rgb("#e8ff2b"),
    accent: rgb("#ff2f87"),
    additive: 1,
    css: { paper: "#0d0d0d", ink: "#e8ff2b", accent: "#ff2f87", faint: "rgba(232,255,43,0.3)" },
  },
};

export const PALETTE_KEYS = Object.keys(PALETTES) as PressPalette[];
