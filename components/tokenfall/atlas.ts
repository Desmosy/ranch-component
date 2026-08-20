import { TILES, glyphOn } from "./palette";

/**
 * Pre-rendered glyph atlas (§6.1).
 *
 * Every (character × tile colour) pair is rendered once, so a frame is nothing
 * but drawImage blits — no fillText, no font shaping, no text layout in the
 * loop. At 18×26 with ~70 characters and 8 colours this is roughly 560 tiles
 * and well under a megabyte, which is why this is Canvas 2D and not WebGL.
 *
 * Rebuilt only on DPR change or a breakpoint crossing. Nothing else touches it.
 */

export const FONT_STACK =
  '"Berkeley Mono", "Martian Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export interface Atlas {
  canvas: HTMLCanvasElement;
  /** Device-pixel size of one tile in the sheet. */
  tw: number;
  th: number;
  index: Map<string, number>;
  chars: string;
}

export function buildAtlas(
  chars: string,
  cellW: number,
  cellH: number,
  dpr: number,
): Atlas | null {
  const canvas = document.createElement("canvas");
  const tw = Math.round(cellW * dpr);
  const th = Math.round(cellH * dpr);
  canvas.width = tw * chars.length;
  canvas.height = th * TILES.length;

  const g = canvas.getContext("2d");
  if (!g) return null;

  g.textAlign = "center";
  g.textBaseline = "middle";
  // 700 weight: glyphs have to hold their own against saturated tiles.
  g.font = `700 ${Math.round(cellH * 0.72 * dpr)}px ${FONT_STACK}`;

  for (let t = 0; t < TILES.length; t++) {
    const tile = TILES[t];
    const ink = glyphOn(tile.hex);
    for (let c = 0; c < chars.length; c++) {
      const x = c * tw;
      const y = t * th;
      g.fillStyle = tile.hex;
      g.fillRect(x, y, tw, th);
      const ch = chars[c];
      if (ch === " ") continue;
      g.fillStyle = ink;
      // Optical centring: a monospace cap sits high of true centre, so the
      // baseline is nudged down. Without this the ribbons look top-heavy.
      g.fillText(ch, x + tw / 2, y + th / 2 + 2 * dpr);
    }
  }

  const index = new Map<string, number>();
  for (let i = 0; i < chars.length; i++) index.set(chars[i], i);

  return { canvas, tw, th, index, chars };
}
