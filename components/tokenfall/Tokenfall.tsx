"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { buildAtlas, type Atlas } from "./atlas";
import { CORPUS, charsetFor } from "./corpus";
import { Field, metricsFor } from "./field";
import { FIELD_BG } from "./palette";
import { mulberry32 } from "./rng";

const STEP = 1 / 60;
/** A backgrounded tab must not come back to a thousand-step catch-up. */
const MAX_FRAME_MS = 50;

export interface TokenfallProps {
  className?: string;
  /** Fixed seed → byte-identical first frame (§6.4). */
  seed?: number;
  /** Host source to make the field out of. Defaults to the bundled corpus. */
  corpus?: string;
  /** §5.3 seam: drive this from scroll velocity, clamped 0.6–2.2. */
  speedMultiplier?: number;
}

export default function Tokenfall({
  className,
  seed = 0x9e3779b9,
  corpus = CORPUS,
  speedMultiplier = 1,
}: TokenfallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(speedMultiplier);
  speedRef.current = speedMultiplier;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const chars = charsetFor(corpus);

    let dpr = 1;
    let atlas: Atlas | null = null;
    let field: Field | null = null;
    let mobile = false;
    /** Glyph char code → atlas column. Built once; the loop never does lookups
     *  by string. */
    const codeToCol = new Int16Array(65536).fill(-1);
    for (let i = 0; i < chars.length; i++) codeToCol[chars.charCodeAt(i)] = i;

    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      const nextDpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const m = metricsFor(w, h);
      const nextMobile = w < 640;

      canvas.width = Math.round(w * nextDpr);
      canvas.height = Math.round(h * nextDpr);
      ctx.setTransform(nextDpr, 0, 0, nextDpr, 0, 0);

      // The atlas is rebuilt on DPR change or a breakpoint crossing. Nothing
      // else touches it — it is the one expensive object here.
      if (!atlas || nextDpr !== dpr || nextMobile !== mobile) {
        atlas = buildAtlas(chars, m.cellW, m.cellH, nextDpr);
        dpr = nextDpr;
        mobile = nextMobile;
      }

      if (!field) field = new Field(m, corpus, mulberry32(seed));
      else field.resize(m);
    };

    const render = () => {
      if (!field || !atlas) return;
      const m = field.m;
      ctx.fillStyle = FIELD_BG;
      ctx.fillRect(0, 0, m.w, m.h);

      const sheet = atlas.canvas;
      const { tw, th } = atlas;

      for (const c of field.cols) {
        const a = field.wake(c);
        if (a <= 0.01) continue;
        ctx.globalAlpha = a;
        const x = c.index * m.cellW;
        for (let row = 0; row < m.rows; row++) {
          if (!c.live[row]) continue;
          const col = codeToCol[c.glyphs[row]];
          if (col < 0) continue;
          ctx.drawImage(
            sheet,
            col * tw,
            c.colors[row] * th,
            tw,
            th,
            x,
            row * m.cellH,
            m.cellW,
            m.cellH,
          );
        }
      }

      ctx.globalAlpha = 1;
      for (const p of field.particles) {
        if (!p.live) continue;
        const col = codeToCol[p.glyph];
        if (col < 0) continue;
        ctx.drawImage(sheet, col * tw, p.tile * th, tw, th, p.x, p.y, m.cellW, m.cellH);
      }
    };

    measure();

    if (reduced) {
      // Not a degraded fallback — a different cut. The seeded field is already
      // composed, envelope and all, so one frame is a finished picture.
      render();
      const roStatic = new ResizeObserver(() => {
        measure();
        render();
      });
      roStatic.observe(canvas);
      return () => roStatic.disconnect();
    }

    let raf = 0;
    let last = 0;
    let acc = 0;
    let running = false;
    let onScreen = false;
    let hidden = document.hidden;

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(MAX_FRAME_MS, now - last) : 16;
      last = now;
      acc += dt / 1000;
      const mult = Math.max(0.6, Math.min(2.2, speedRef.current));
      while (acc >= STEP) {
        field?.simulate(STEP, mult);
        acc -= STEP;
      }
      render();
      if (running) raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      const should = onScreen && !hidden;
      if (should === running) return;
      running = should;
      if (should) {
        last = 0;
        acc = 0;
        raf = requestAnimationFrame(frame);
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es.some((e) => e.isIntersecting);
        sync();
      },
      { rootMargin: "0px" },
    );
    io.observe(canvas);

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      field?.setViscosity(e.clientX - rect.left);
    };
    const onLeave = () => field?.setViscosity(null);
    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      field?.toggleFreeze(e.clientX - rect.left);
    };

    const ro = new ResizeObserver(() => measure());
    ro.observe(canvas);

    document.addEventListener("visibilitychange", onVis);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, [seed, corpus]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      role="presentation"
      tabIndex={-1}
      className={cn("block h-full w-full touch-none", className)}
      style={{ background: FIELD_BG }}
    />
  );
}
