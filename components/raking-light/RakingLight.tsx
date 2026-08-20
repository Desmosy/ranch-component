"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  FORESHORTEN,
  GROUND,
  HORIZON,
  INK,
  PLATE,
  SOLIDS,
  SUN,
  rakeFrom,
  sunAt,
  tracePath,
} from "./composition";

/** A full day, if you leave it alone. */
const DAY_MS = 26000;

export interface RakingLightProps {
  className?: string;
  /** Where the sun starts on its arc, 0..1 through the day. */
  dawn?: number;
}

export default function RakingLight({ className, dawn = 0.32 }: RakingLightProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /** Shadows are composed here first so they merge instead of stacking. */
    const shadow = document.createElement("canvas");
    const sctx = shadow.getContext("2d");
    if (!sctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let clock = dawn * DAY_MS;
    /** Where the sun actually is, easing toward wherever it is wanted. */
    const sun = { x: 0, y: 0 };
    let seeded = false;
    let held: { x: number; y: number } | null = null;

    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seeded = false;
    };

    const render = () => {
      const g = h * HORIZON;
      const unit = w;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = PLATE;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = GROUND;
      ctx.fillRect(0, g, w, h - g);

      // The sun sits behind the solids, so a tall object can eclipse it.
      ctx.fillStyle = SUN;
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, w * 0.042, 0, Math.PI * 2);
      ctx.fill();

      for (const s of SOLIDS) {
        ctx.fillStyle = s.fill;
        tracePath(ctx, s, unit, g);
        ctx.fill(s.kind === "ring" ? "evenodd" : "nonzero");
      }

      // Shadows are drawn opaque on their own surface first, then laid down in
      // one pass. Filling them straight onto the plate would multiply each
      // shadow against the last, so two that crossed would go twice as dark —
      // one sun casts one depth of shadow, however many objects overlap.
      const rake = rakeFrom(sun.x, sun.y, w, g);
      if (shadow.width !== canvas.width || shadow.height !== canvas.height) {
        shadow.width = canvas.width;
        shadow.height = canvas.height;
      }
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, shadow.width, shadow.height);
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Maps a point at height (g - y) onto the ground, pushed along the rake
      // and flattened by the foreshortening. Affine, because the light is
      // parallel — one matrix serves the entire scene.
      sctx.transform(1, 0, -rake, -FORESHORTEN, rake * g, g * (1 + FORESHORTEN));
      sctx.fillStyle = INK;
      for (const s of SOLIDS) {
        tracePath(sctx, s, unit, g);
        sctx.fill(s.kind === "ring" ? "evenodd" : "nonzero");
      }

      // Multiplied, so shadows fall ACROSS the solids they reach instead of
      // stopping politely at the first one. That crossing is the only thing
      // making these flat shapes share a space.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = 0.8;
      ctx.drawImage(shadow, 0, 0);
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // A hairline on the horizon — the one drawn line in the piece, and the
      // thing that stops the ground reading as a second background.
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, g + 0.5);
      ctx.lineTo(w, g + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    let last = 0;
    let running = false;
    let onScreen = false;
    let hidden = document.hidden;

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;

      const g = h * HORIZON;
      if (!held) clock += dt;
      const want = held ?? sunAt((clock / DAY_MS) * Math.PI * 2, w, g);

      // The sun has weight. Snapping it to the cursor makes the shadows feel
      // like a slider; letting it lag makes them feel like they are being led.
      if (!seeded) {
        sun.x = want.x;
        sun.y = want.y;
        seeded = true;
      } else {
        sun.x += (want.x - sun.x) * 0.06;
        sun.y += (want.y - sun.y) * 0.06;
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

    const settleStatic = () => {
      const g = h * HORIZON;
      const at = sunAt((clock / DAY_MS) * Math.PI * 2, w, g);
      sun.x = at.x;
      sun.y = at.y;
      seeded = true;
      render();
    };

    measure();
    settleStatic();

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
      const g = h * HORIZON;
      held = {
        x: e.clientX - rect.left,
        // The sun cannot go below the horizon it is casting onto, and stops
        // well short of it — at grazing height the rake outruns the plate.
        y: Math.min(g - h * 0.14, e.clientY - rect.top),
      };
    };
    const onLeave = () => {
      // No hand-off maths needed: the day kept running underneath, and the
      // same lag that made the sun feel led now glides it back onto its arc.
      held = null;
    };

    const ro = new ResizeObserver(() => {
      measure();
      settleStatic();
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
  }, [dawn]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="A row of flat geometric solids casting long shadows from a moving sun"
      className={cn("block h-full w-full touch-none", className)}
    />
  );
}
