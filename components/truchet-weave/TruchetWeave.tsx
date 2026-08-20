"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { PALETTE, buildField, type Tile } from "./field";

const SWEEP_MS = 7200;
const TOUCH_RADIUS = 0.17;
const TOUCH_COOLDOWN = 520;

export interface TruchetWeaveProps {
  className?: string;
}

export default function TruchetWeave({ className }: TruchetWeaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let tiles: Tile[] = [];
    const touched = new WeakMap<Tile, number>();
    let pointer: { x: number; y: number } | null = null;
    let clock = 0;

    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tiles = buildField(w, h);
    };

    /**
     * Every tile is drawn in its own local frame with the origin at the corner,
     * rotated about the centre. Quarter turns only — the whole point of the
     * grammar is that the edge crossings land back on the midpoints.
     */
    const drawTile = (t: Tile) => {
      const s = t.size;
      const lw = s * 0.2;

      ctx.save();
      ctx.translate(t.x + s / 2, t.y + s / 2);
      ctx.rotate(t.turn * Math.PI * 0.5);
      ctx.translate(-s / 2, -s / 2);

      let ink = PALETTE.inks[Math.max(0, t.ink)];
      if (t.ground >= 0) {
        // Rotate the ground with the tile, so a colour block turns too.
        ctx.fillStyle = PALETTE.grounds[t.ground];
        ctx.fillRect(0, 0, s, s);
        // On a colour block the ribbon is cut out of the plate colour, so the
        // run continues through the block as negative space.
        ink = PALETTE.plate;
      }

      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineWidth = lw;
      ctx.lineCap = "butt";

      if (t.kind === "solid") {
        // The filled version of an arc: its boundary still meets the two edge
        // midpoints, so it drops into the weave without breaking a run.
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, s / 2, 0, Math.PI / 2);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.arc(s, s, s / 2, Math.PI, Math.PI * 1.5);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, s / 2, 0, Math.PI / 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(s, s, s / 2, Math.PI, Math.PI * 1.5);
        ctx.stroke();

        if (t.kind === "dot") {
          ctx.beginPath();
          ctx.arc(s / 2, s / 2, s * 0.13, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    };

    const render = () => {
      ctx.fillStyle = PALETTE.plate;
      ctx.fillRect(0, 0, w, h);
      for (const t of tiles) drawTile(t);
    };

    // --- motion --------------------------------------------------------------
    let raf = 0;
    let last = 0;
    let running = false;
    let onScreen = false;
    let hidden = document.hidden;

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      clock += dt;

      // A single sweep crosses the plate on a diagonal and turns each tile once
      // as it passes. One wave, not per-tile randomness — the field reorganises
      // as a front you can watch travel, which is the whole image.
      const cycle = Math.floor(clock / SWEEP_MS);
      const front = (clock % SWEEP_MS) / SWEEP_MS;

      for (const t of tiles) {
        if (t.cycle < cycle && front > t.phase) {
          t.cycle = cycle;
          t.target += 1;
        }

        if (pointer) {
          const dx = (t.x + t.size / 2 - pointer.x) / w;
          const dy = (t.y + t.size / 2 - pointer.y) / h;
          if (dx * dx + dy * dy < TOUCH_RADIUS * TOUCH_RADIUS) {
            const at = touched.get(t) ?? -Infinity;
            if (clock - at > TOUCH_COOLDOWN) {
              touched.set(t, clock);
              t.target += 1;
            }
          }
        }

        // Slight overshoot on the quarter turn — a tile that eases in flatly
        // reads as a fade, not as a thing that moved.
        t.vel += (t.target - t.turn) * 0.055;
        t.vel *= 0.82;
        t.turn += t.vel;
      }

      render();
      if (running) raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      const should = onScreen && !hidden && !reduced;
      if (should === running) return;
      running = should;
      if (should) {
        last = 0;
        raf = requestAnimationFrame(frame);
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    measure();
    render();

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es.some((e) => e.isIntersecting);
        sync();
      },
      { rootMargin: "150px" },
    );
    io.observe(canvas);

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => {
      pointer = null;
    };

    const ro = new ResizeObserver(() => {
      measure();
      render();
    });
    ro.observe(canvas);

    document.addEventListener("visibilitychange", onVis);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="A woven field of geometric tiles that turn in a travelling wave"
      className={cn("block h-full w-full touch-none", className)}
    />
  );
}
