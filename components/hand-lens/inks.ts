export type SealInk = "sumi" | "vermilion" | "indigo";

export interface InkSpec {
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

export const INKS: Record<SealInk, InkSpec> = {
  sumi: {
    name: "Sumi",
    paper: rgb("#efe7d6"),
    ink: rgb("#15120f"),
    accent: rgb("#c8241c"),
    additive: 0,
    css: { paper: "#efe7d6", ink: "#15120f", accent: "#c8241c", faint: "rgba(21,18,15,0.4)" },
  },
  vermilion: {
    name: "Vermilion",
    paper: rgb("#120d0b"),
    ink: rgb("#f4e7d2"),
    accent: rgb("#ff4a1c"),
    additive: 1,
    css: { paper: "#120d0b", ink: "#f4e7d2", accent: "#ff4a1c", faint: "rgba(244,231,210,0.35)" },
  },
  indigo: {
    name: "Indigo",
    paper: rgb("#0a1830"),
    ink: rgb("#cfe0ff"),
    accent: rgb("#5ce1c4"),
    additive: 1,
    css: { paper: "#0a1830", ink: "#cfe0ff", accent: "#5ce1c4", faint: "rgba(207,224,255,0.35)" },
  },
};

export const INK_KEYS = Object.keys(INKS) as SealInk[];
