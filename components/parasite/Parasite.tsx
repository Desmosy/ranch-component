"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  MAX_GENS,
  N,
  REST,
  arcLength,
  extent,
  follow,
  host,
  notation,
  renormalize,
  type Params,
} from "./curve";

const PAPER = "#F0EBE0";
const INK = "#141210";
const ACCENT = "#B23A22";
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

/** Deterministic noise — no assets, no textures, arithmetic only. */
function noise(x: number, y = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export interface ParasiteProps {
  className?: string;
}

export default function Parasite({ className }: ParasiteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const view = canvasRef.current;
    if (!view) return;
    const vctx = view.getContext("2d");
    if (!vctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const paper = document.createElement("canvas");
    const pctx = paper.getContext("2d");
    if (!pctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let R = 1;

    const cur = new Float64Array(N * 2);
    const nxt = new Float64Array(N * 2);
    /** Every generation is kept so the host can be struck last, on top. The
     *  pool is allocated once — 24 arrays a frame would be pure GC pressure. */
    const kept = Array.from({ length: MAX_GENS }, () => new Float64Array(N * 2));

    // Live parameters, and where the cursor is asking them to go.
    const p: Params = { ...REST };
    const want: Params = { ...REST };

    let pointer: { x: number; y: number } | null = null;
    let gens = 1;
    /** How strongly the attractor is allowed to speak. Grows in your absence. */
    let mu = 0;
    let ratio = 1;
    let idle = 0;

    const layPaper = () => {
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pctx.fillStyle = PAPER;
      pctx.fillRect(0, 0, w, h);
      pctx.fillStyle = "#000";
      for (let i = 0; i < 1500; i++) {
        const x = noise(i, 1.7) * w;
        const y = noise(i, 3.3) * h;
        const v = noise(x * 0.06, y * 0.06);
        pctx.globalAlpha = 0.01 + v * 0.02;
        pctx.fillRect(x, y, 1, v > 0.88 ? 2 : 1);
      }
      pctx.globalAlpha = 1;
    };

    const measure = () => {
      const rect = view.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      R = Math.min(w, h) * 0.34;
      for (const c of [view, paper]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layPaper();
    };

    /** Construction: the marks a plate carries because it was set up, not
     *  because it was decorated. */
    const scaffold = () => {
      const cx = w / 2;
      const cy = h / 2;
      vctx.strokeStyle = INK;
      vctx.lineWidth = 0.5;

      vctx.globalAlpha = 0.16;
      vctx.setLineDash([2, 4]);
      for (const k of [0.5, 1, 1.34]) {
        vctx.beginPath();
        vctx.arc(cx, cy, R * k, 0, Math.PI * 2);
        vctx.stroke();
      }
      vctx.setLineDash([]);

      // Graduations every 15°, longer every 90°.
      vctx.globalAlpha = 0.28;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const len = i % 6 === 0 ? 9 : 4;
        const r0 = R * 1.42;
        vctx.beginPath();
        vctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        vctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
        vctx.stroke();
      }

      vctx.globalAlpha = 0.22;
      vctx.beginPath();
      vctx.moveTo(cx - 7, cy);
      vctx.lineTo(cx + 7, cy);
      vctx.moveTo(cx, cy - 7);
      vctx.lineTo(cx, cy + 7);
      vctx.stroke();
      vctx.globalAlpha = 1;
    };

    /**
     * One generation, laid down. Later generations are struck with dropouts
     * and lighter weight — not to look old, but because a plate carrying this
     * many hairlines could not hold them all, and the ones it loses are the
     * ones that were drawn last.
     */
    const strike = (buf: Float64Array, k: number) => {
      const t = k / Math.max(1, MAX_GENS - 1);
      const cx = w / 2;
      const cy = h / 2;

      vctx.strokeStyle = k === 0 ? ACCENT : INK;
      vctx.lineWidth = k === 0 ? 0.8 : 0.5 - t * 0.12;
      vctx.globalAlpha = k === 0 ? 0.95 : 0.5 * (1 - t * 0.5);

      // Struck as one unbroken closed path. The dropouts that used to sit here
      // were indistinguishable from the seam artefact they sat next to, so the
      // plate is cleaner without them — the only imperfection left is a hair of
      // sub-pixel displacement, which is the one that reads as printing.
      vctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const j = (i % N) * 2;
        const jx = (noise(j, k) - 0.5) * 0.35;
        const jy = (noise(k, j) - 0.5) * 0.35;
        const x = cx + buf[j] + jx;
        const y = cy + buf[j + 1] + jy;
        if (i === 0) vctx.moveTo(x, y);
        else vctx.lineTo(x, y);
      }
      vctx.closePath();
      vctx.stroke();
      vctx.globalAlpha = 1;
    };

    const legend = () => {
      vctx.font = `7px ${MONO}`;
      vctx.fillStyle = INK;
      vctx.textBaseline = "alphabetic";

      vctx.globalAlpha = 0.5;
      vctx.textAlign = "left";
      vctx.fillText(`b=${Math.max(1, Math.round(p.b))}  A=${p.amp.toFixed(2)}  λ=${p.lam.toFixed(2)}`, 18, h - 16);

      // What the machine currently admits to doing.
      vctx.textAlign = "right";
      vctx.globalAlpha = ratio > 2.4 ? 0.9 : 0.62;
      vctx.font = `${ratio > 2.4 ? 8 : 9}px ${MONO}`;
      vctx.fillStyle = ratio > 1.75 ? ACCENT : INK;
      vctx.fillText(notation(ratio), w - 18, h - 16);

      vctx.font = `7px ${MONO}`;
      vctx.fillStyle = INK;
      vctx.globalAlpha = 0.4;
      vctx.textAlign = "left";
      vctx.fillText(`GEN ${String(Math.round(gens)).padStart(2, "0")}`, 18, 24);
      vctx.textAlign = "right";
      vctx.fillText(mu > 0.02 ? "ATTRACTOR" : "FREE", w - 18, 24);
      vctx.globalAlpha = 1;
      vctx.textAlign = "left";
    };

    const tick = (dt: number) => {
      const k = dt / 16.7;

      if (pointer) {
        idle = 0;
        // You are not drawing. You are holding three variables.
        const nx = pointer.x / w;
        const ny = pointer.y / h;
        const dx = nx - 0.5;
        const dy = ny - 0.5;
        const rad = Math.min(1, Math.hypot(dx, dy) * 2);
        want.b = 2 + nx * 7;
        want.amp = 0.55 + (1 - ny) * 0.62;
        want.lam = 0.25 + rad * 0.85;
      } else {
        idle += dt;
        want.b = REST.b;
        want.amp = REST.amp;
        want.lam = REST.lam;
      }

      // Inertia on the parameters themselves, so a flick of the wrist is a
      // change of regime rather than a jump cut.
      p.b += (want.b - p.b) * 0.035 * k;
      p.amp += (want.amp - p.amp) * 0.045 * k;
      p.lam += (want.lam - p.lam) * 0.035 * k;
      p.phi += 0.0022 * k;

      // Generations arrive while you work and are given back when you stop.
      const target = pointer ? MAX_GENS : 1;
      gens += Math.sign(target - gens) * Math.min(Math.abs(target - gens), 0.05 * k);

      // The attractor only gets a voice once the cursor's has faded. This is
      // the whole late arc: chaos is not resolved by force, it is resolved by
      // the one smooth thing in the system finally being audible.
      const wantMu = pointer ? 0 : Math.min(0.34, (idle - 900) / 9000);
      mu += (Math.max(0, wantMu) - mu) * 0.02 * k;
    };

    const render = () => {
      vctx.setTransform(1, 0, 0, 1, 0, 0);
      vctx.drawImage(paper, 0, 0);
      vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scaffold();

      host(cur, p, R);
      const base = extent(cur).r;
      const len0 = arcLength(cur);
      let last = len0;

      const shown = Math.min(MAX_GENS, Math.max(1, Math.round(gens)));
      for (let g = 0; g < shown; g++) {
        kept[g].set(cur);
        if (g === shown - 1) break;
        // λ varies a little per generation, so the family is not a geometric
        // series of one shape at increasing size.
        const lam = p.lam * (0.75 + noise(g * 3.7) * 0.5);
        follow(cur, nxt, lam, mu * ((g + 1) / shown) ** 1.4, R * 0.92);
        cur.set(nxt);
        renormalize(cur, base * (1 + g * 0.014));
        last = arcLength(cur);
      }

      // Struck back to front, so the host — the only line you are actually
      // steering — ends up on top of everything it has spawned.
      for (let g = shown - 1; g >= 0; g--) strike(kept[g], g);

      ratio += (last / Math.max(1, len0) - ratio) * 0.08;
      legend();
    };

    let raf = 0;
    let lastT = 0;
    let running = false;
    let onScreen = false;
    let hidden = document.hidden;

    const frame = (now: number) => {
      raf = 0;
      const dt = lastT ? Math.min(40, now - lastT) : 16;
      lastT = now;
      tick(dt);
      render();
      if (running) raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      const should = onScreen && !hidden && !reduced;
      if (should === running) return;
      running = should;
      if (should) {
        lastT = 0;
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
    io.observe(view);

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    const onMove = (e: PointerEvent) => {
      const rect = view.getBoundingClientRect();
      pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => {
      pointer = null;
    };

    const ro = new ResizeObserver(() => {
      measure();
      render();
    });
    ro.observe(view);

    document.addEventListener("visibilitychange", onVis);
    view.addEventListener("pointermove", onMove);
    view.addEventListener("pointerleave", onLeave);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      view.removeEventListener("pointermove", onMove);
      view.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="A parametric curve and the generations of curves that follow its derivative"
      className={cn("block aspect-square h-full w-full touch-none", className)}
    />
  );
}
