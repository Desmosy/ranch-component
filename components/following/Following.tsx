"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  ACCENT,
  INK,
  LAG,
  MAX_PENS,
  PAPER,
  makePen,
  noise,
  pastPoint,
  record,
  steer,
  styleFor,
  type Pen,
} from "./pens";

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

/** Leader travel between one generation emerging and the next. */
const SPAWN_EVERY = 74;
/** How long the cursor must be gone before the structure starts coming home. */
const RETURN_AFTER = 6500;
/** A pen is retired this often once the return has begun. */
const RETIRE_EVERY = 620;
/** How often a trajectory decides to follow something that is not its parent. */
const STRAY_EVERY = 3400;

export interface FollowingProps {
  className?: string;
}

export default function Following({ className }: FollowingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const view = canvasRef.current;
    if (!view) return;
    const vctx = view.getContext("2d");
    if (!vctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Three surfaces: the stock, the ink laid on it, and what you look at.
    // The ink has to live on its own layer because it accumulates and is
    // lifted slowly — do that on the visible canvas and the paper grain
    // washes out along with the drawing.
    const paper = document.createElement("canvas");
    const pctx = paper.getContext("2d");
    const ink = document.createElement("canvas");
    const ictx = ink.getContext("2d");
    if (!pctx || !ictx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let pens: Pen[] = [];
    let pointer: { x: number; y: number } | null = null;
    let awayFor = 0;
    let travelled = 0;
    let sinceRetire = 0;
    let sinceStray = 0;
    let frames = 0;
    let returning = false;
    /** Nothing emerges until the plate has been disturbed at least once. */
    let awoken = false;

    /** Warm stock: flat tone, then microscopic arithmetic grain. Drawn once. */
    const layPaper = () => {
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pctx.fillStyle = PAPER;
      pctx.fillRect(0, 0, w, h);

      // Density variation — a few very soft, very low-amplitude patches.
      pctx.fillStyle = "#000";
      for (let i = 0; i < 1400; i++) {
        const x = noise(i, 1.1) * w;
        const y = noise(i, 2.7) * h;
        const v = noise(x * 0.07, y * 0.07);
        pctx.globalAlpha = 0.012 + v * 0.022;
        pctx.fillRect(x, y, 1, v > 0.86 ? 2 : 1);
      }
      // Occasional imperfection: a fibre in the sheet.
      for (let i = 0; i < 9; i++) {
        const x = noise(i, 9.3) * w;
        const y = noise(i, 4.1) * h;
        pctx.globalAlpha = 0.05;
        pctx.fillRect(x, y, 1, 3 + noise(i, 6) * 7);
      }
      pctx.globalAlpha = 1;
    };

    const measure = () => {
      const rect = view.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      for (const c of [view, paper, ink]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layPaper();
      // One line, at the centre, already drifting.
      pens = [makePen(0, w * 0.5, h * 0.5, -0.4)];
      awayFor = 0;
      travelled = 0;
      returning = false;
    };

    /**
     * Deposit the newest segment of a pen. Only the new piece is drawn — the
     * ink layer holds everything that came before, which is what lets density
     * build into mass without redrawing tens of thousands of points a frame.
     */
    const deposit = (p: Pen, fx: number, fy: number) => {
      const style = styleFor(p.gen);
      const stray = p.strayed;
      const col = stray ? ACCENT : INK;
      const n = noise(p.x * 0.31, p.y * 0.29);
      const n2 = noise(p.y * 0.17, p.x * 0.23);

      // Print imperfection, applied to every style: a hair of subpixel
      // displacement, weight that breathes, and the occasional dropout.
      const jx = (n - 0.5) * 0.5;
      const jy = (n2 - 0.5) * 0.5;
      const weight = 0.45 + n * 0.35;
      const fade = p.life * (0.55 + n2 * 0.45);
      if (n > 0.985) return;

      ictx.strokeStyle = col;
      ictx.fillStyle = col;
      ictx.lineCap = "butt";

      const seg = (ox: number, oy: number, a: number, lw: number) => {
        ictx.globalAlpha = a;
        ictx.lineWidth = lw;
        ictx.beginPath();
        ictx.moveTo(fx + ox + jx, fy + oy + jy);
        ictx.lineTo(p.x + ox + jx, p.y + oy + jy);
        ictx.stroke();
      };

      const nx = -Math.sin(p.dir);
      const ny = Math.cos(p.dir);

      switch (style) {
        case "solid":
          seg(0, 0, 0.92 * fade, weight);
          break;
        case "engraved":
          // Two passes a hair apart — the plate never registers perfectly.
          seg(nx * 0.7, ny * 0.7, 0.7 * fade, weight * 0.8);
          seg(-nx * 0.7, -ny * 0.7, 0.45 * fade, weight * 0.7);
          break;
        case "dotted":
          if (n > 0.42) seg(0, 0, 0.72 * fade, weight * 0.9);
          break;
        case "hatch": {
          // Micro-hatching: short ticks across the path, not along it.
          const len = 1.6 + n * 2.6;
          ictx.globalAlpha = 0.6 * fade;
          ictx.lineWidth = 0.42;
          ictx.beginPath();
          ictx.moveTo(p.x + nx * len, p.y + ny * len);
          ictx.lineTo(p.x - nx * len, p.y - ny * len);
          ictx.stroke();
          break;
        }
        case "stipple": {
          const count = 1 + (n > 0.7 ? 1 : 0);
          for (let i = 0; i < count; i++) {
            const s = noise(p.x + i * 3.1, p.y - i * 2.3);
            ictx.globalAlpha = (0.35 + s * 0.4) * fade;
            ictx.fillRect(
              p.x + (s - 0.5) * 4.5,
              p.y + (noise(s * 91, i) - 0.5) * 4.5,
              0.85,
              0.85,
            );
          }
          break;
        }
        case "halftone": {
          // Dot size reads the pen's own speed, so the screen opens where the
          // trajectory runs and closes where it hesitates.
          const r = 0.35 + (2.4 - Math.min(2.4, p.speed)) * 0.55 + n * 0.3;
          ictx.globalAlpha = 0.5 * fade;
          ictx.beginPath();
          ictx.arc(p.x + jx * 2, p.y + jy * 2, r, 0, Math.PI * 2);
          ictx.fill();
          break;
        }
        case "fragment": {
          // Past here the line has stopped being a line.
          if (n < 0.55) break;
          const s = noise(p.y * 0.51, p.x * 0.47);
          ictx.globalAlpha = (0.2 + s * 0.42) * fade;
          ictx.fillRect(
            p.x + (s - 0.5) * 7,
            p.y + (n - 0.5) * 7,
            0.8 + (s > 0.9 ? 0.8 : 0),
            0.8,
          );
          break;
        }
      }
      ictx.globalAlpha = 1;
    };

    /** Lift ink off the plate. Rare and small, so the memory is minutes long. */
    const lift = () => {
      const every = returning ? 5 : 26;
      if (frames % every) return;
      ictx.save();
      ictx.setTransform(1, 0, 0, 1, 0, 0);
      ictx.globalCompositeOperation = "destination-out";
      ictx.fillStyle = `rgba(0,0,0,${returning ? 0.05 : 0.011})`;
      ictx.fillRect(0, 0, ink.width, ink.height);
      ictx.restore();
    };

    const annotate = () => {
      vctx.font = `7px ${MONO}`;
      vctx.fillStyle = INK;
      vctx.globalAlpha = 0.45;
      vctx.textBaseline = "alphabetic";
      vctx.textAlign = "left";
      vctx.fillText("FOLLOWING", 18, h - 16);
      vctx.textAlign = "right";
      vctx.fillText(String(pens.length).padStart(2, "0"), w - 18, h - 16);
      vctx.globalAlpha = 1;
      vctx.textAlign = "left";
    };

    const tick = (dt: number) => {
      frames++;
      if (!pointer) awayFor += dt;

      if (!returning && awayFor > RETURN_AFTER && pens.length > 1) returning = true;

      // --- the chain, front to back so each pen reads a parent already moved --
      const lead = pens[0];
      const before = { x: lead.x, y: lead.y };

      if (pointer) {
        // The cursor is not a point to hit; it is a region the head is drawn
        // into. The pen keeps its own curvature the whole way there.
        steer(lead, pointer.x, pointer.y, dt, w, h);
      } else if (returning) {
        steer(lead, w * 0.5, h * 0.5, dt, w, h);
      } else {
        // No target: it keeps the trajectory it already had. Standing still
        // does not stop the drawing.
        steer(lead, lead.x + Math.cos(lead.dir) * 40, lead.y + Math.sin(lead.dir) * 40, dt, w, h);
      }
      record(lead);
      deposit(lead, before.x, before.y);
      travelled += Math.hypot(lead.x - before.x, lead.y - before.y);

      for (let i = 1; i < pens.length; i++) {
        const p = pens[i];
        const src = pens[Math.min(p.follows, pens.length - 1)] ?? lead;
        const back = pastPoint(src, LAG);
        // Its own lateral distortion, shrinking as the structure comes home.
        const off = p.offset * (returning ? p.life : 1);
        const ox = -Math.sin(src.dir) * off;
        const oy = Math.cos(src.dir) * off;

        const was = { x: p.x, y: p.y };
        steer(p, back.x + ox, back.y + oy, dt, w, h);
        record(p);
        deposit(p, was.x, was.y);
      }

      // --- generations emerge as the leader works ----------------------------
      if (awoken && !returning && travelled > SPAWN_EVERY && pens.length < MAX_PENS) {
        travelled = 0;
        const parent = pens[pens.length - 1];
        pens.push(makePen(pens.length, parent.x, parent.y, parent.dir));
      }

      // --- a trajectory decides to follow another trajectory -----------------
      sinceStray += dt;
      if (sinceStray > STRAY_EVERY && pens.length > 8 && !returning) {
        sinceStray = 0;
        const strayed = pens.filter((p) => p.strayed).length;
        if (strayed < pens.length * 0.3) {
          const i = 4 + Math.floor(noise(frames * 0.7) * (pens.length - 5));
          const p = pens[i];
          if (p && !p.strayed) {
            // Anything but its own parent — this is the moment the system
            // stops being a chain and becomes a graph.
            p.follows = 1 + Math.floor(noise(frames * 1.9, i) * (i - 2));
            p.strayed = true;
          }
        }
      }

      // --- coming home -------------------------------------------------------
      if (returning) {
        sinceRetire += dt;
        for (const p of pens) if (p.gen > 0) p.life = Math.max(0, p.life - dt / 5200);
        if (sinceRetire > RETIRE_EVERY && pens.length > 1) {
          sinceRetire = 0;
          pens.pop();
        }
        if (pens.length === 1) {
          returning = false;
          awayFor = 0;
          lead.life = 1;
        }
      }

      lift();
    };

    const compose = () => {
      vctx.setTransform(1, 0, 0, 1, 0, 0);
      vctx.drawImage(paper, 0, 0);
      vctx.drawImage(ink, 0, 0);
      vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      annotate();
    };

    let raf = 0;
    let last = 0;
    let running = false;
    let onScreen = false;
    let hidden = document.hidden;

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(40, now - last) : 16;
      last = now;
      tick(dt);
      compose();
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
    compose();

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
      awayFor = 0;
      awoken = true;
      if (returning) {
        // Caught on the way home: the survivors get their weight back rather
        // than carrying the fade of an interrupted collapse for ever.
        returning = false;
        for (const p of pens) p.life = 1;
      }
    };
    const onLeave = () => {
      pointer = null;
    };

    const ro = new ResizeObserver(() => {
      measure();
      compose();
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
      aria-label="A generative plate of trajectories, each one following the line before it"
      className={cn("block aspect-square h-full w-full touch-none", className)}
    />
  );
}
