"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { PAPER, INK, RED, hash } from "./species";

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const GLYPHS = "#@%&*+=-:.^~/\\|()[]{}<>";

export interface SpecimenProps {
  className?: string;
}

export default function Specimen({ className }: SpecimenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;

    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    let hasPointer = false;
    let seed = 42;

    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!hasPointer) {
        x = targetX = w * 0.5;
        y = targetY = h * 0.45;
      }
    };

    /** Speckle in the stock. Fixed to the plate, never regenerated. */
    const paper = () => {
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = INK;
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < 260; i++) {
        const px = hash(i, 1) * w;
        const py = hash(i, 2) * h;
        ctx.fillRect(px, py, 1, hash(i, 3) > 0.85 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    };

    /** Plate furniture: corner ticks, a rule, a caption. Archive, not chrome. */
    const furniture = () => {
      const m = 16;
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 0.8;
      for (const [cx, cy, sx, sy] of [
        [m, m, 1, 1],
        [w - m, m, -1, 1],
        [m, h - m, 1, -1],
        [w - m, h - m, -1, -1],
      ]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + sy * 9);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + sx * 9, cy);
        ctx.stroke();
      }

      ctx.globalAlpha = 0.6;
      ctx.font = `8px ${MONO}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = INK;
      ctx.fillText("PL. I — POINTER GRID", m + 2, h - m - 4);
      ctx.textAlign = "right";
      ctx.fillText("01 CHAR. GRID", w - m - 2, h - m - 4);
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    };

    /** Hairline margin annotation line pointing to the grid */
    const annotate = (ax: number, ay: number) => {
      const side = ax > w * 0.5 ? -1 : 1;
      const marginX = side < 0 ? 28 : w - 28;

      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.5;

      ctx.beginPath();
      ctx.moveTo(ax + side * 36, ay);
      ctx.lineTo(marginX - side * 4, ay);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ax + side * 36, ay, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();

      ctx.font = `7.5px ${MONO}`;
      ctx.fillStyle = INK;
      ctx.textAlign = side < 0 ? "left" : "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("01 char. grid", marginX - side * 4, ay - 3);
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    };

    /** Render Quantized World-Space ASCII Character Matrix */
    const drawAsciiGrid = (cx: number, cy: number) => {
      const cell = 7.5;
      const cols = 7;
      const rows = 3;

      ctx.font = `9px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const gx = Math.round((cx + (c - (cols - 1) / 2) * cell) / cell);
          const gy = Math.round((cy + (r - (rows - 1) / 2) * cell) / cell);
          const h = hash(gx, gy, seed);

          if (h < 0.22) continue;
          const g = GLYPHS[Math.floor(h * GLYPHS.length)];
          ctx.fillStyle = h > 0.93 ? RED : INK;
          ctx.fillText(g, gx * cell, gy * cell);
        }
      }

      // Red Leader Point
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    };

    let raf = 0;
    let last = 0;

    const render = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paper();
      drawAsciiGrid(x, y);
      annotate(x, y);
      furniture();
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(48, now - last) : 16;
      last = now;

      // Smooth lag integrator
      const k = dt / 16.7;
      const a = 1 - (1 - 0.28) ** k;
      x += (targetX - x) * a;
      y += (targetY - y) * a;

      render();
      raf = requestAnimationFrame(loop);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
      hasPointer = true;
    };

    const onPointerLeave = () => {
      hasPointer = false;
      targetX = w * 0.5;
      targetY = h * 0.45;
    };

    window.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <div
      className={cn(
        "relative aspect-[4/5] w-full max-w-[560px] overflow-hidden rounded-sm select-none",
        className
      )}
      style={{
        boxShadow:
          "0 1px 2px rgba(21,18,13,0.06), 0 12px 32px -8px rgba(21,18,13,0.18)",
      }}
    >
      <canvas ref={canvasRef} className="h-full w-full block cursor-crosshair" />
    </div>
  );
}
