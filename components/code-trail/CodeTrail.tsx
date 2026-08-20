"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Drift,
  FONT_RATIO,
  LAP_PX,
  MISPRINT_PX,
  TEAR_PX,
  tearPath,
  LINE_RATIO,
  MAX_BADGES,
  PAD_RATIO,
  ROWS,
  STEP_RATIO,
  TRAVEL_RATIO,
  badgeCount,
  chaseRate,
  makeRowFactory,
  presence,
  type RowData,
} from "./engine";

const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace';

const GRAIN =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E` +
  `%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E` +
  `%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

interface Row {
  el: HTMLDivElement;
  spans: HTMLSpanElement[];
  data: RowData;
  pos: { x: number; y: number };
  slot: number;
}

export interface CodeTrailProps {
  className?: string;
  /** Plate colour behind the ribbon. Kept plain so the tones carry the image. */
  plate?: string;
}

export default function CodeTrail({ className, plate = "#0C0C0E" }: CodeTrailProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const buildRow = makeRowFactory();

    let w = host.clientWidth || 1;
    let h = host.clientHeight || 1;
    let font = 14;
    let line = 18;
    let step = 26;

    // --- fixed pool: 24 rows x 3 spans, created once, only ever moved ---------
    const rows: Row[] = [];
    for (let i = 0; i < ROWS; i++) {
      const el = document.createElement("div");
      // Screen blend, so where a strip laps the one behind it the two inks add
      // instead of one simply hiding the other — overprint, not occlusion.
      el.style.cssText =
        "position:absolute;top:0;left:0;display:flex;align-items:flex-start;" +
        "will-change:transform,opacity;transform-origin:100% 50%;" +
        "mix-blend-mode:screen";
      const spans: HTMLSpanElement[] = [];
      for (let j = 0; j < MAX_BADGES; j++) {
        const s = document.createElement("span");
        s.style.cssText = `flex:0 0 auto;white-space:pre;font-family:${MONO};`;
        el.appendChild(s);
        spans.push(s);
      }
      host.appendChild(el);
      rows.push({ el, spans, data: buildRow(), pos: { x: 0, y: 0 }, slot: i });
    }
    /** Head to tail. Recycling rotates this array; slot is just the index. */
    const order = rows.slice();

    const paintRow = (r: Row) => {
      const shown = Math.min(badgeCount(r.slot, ROWS), r.data.badges.length);
      for (let j = 0; j < MAX_BADGES; j++) {
        const s = r.spans[j];
        const b = r.data.badges[j];
        if (j >= shown || !b) {
          s.style.display = "none";
          continue;
        }
        s.style.display = "block";
        s.textContent = b.text;
        s.style.background = b.bg;
        s.style.color = b.fg;
        // Height overshoots the line so each strip laps the row behind it.
        s.style.height = `${line + LAP_PX}px`;
        s.style.lineHeight = `${line}px`;
        s.style.fontSize = `${font}px`;
        s.style.padding = `0 ${font * PAD_RATIO}px`;
        s.style.fontStyle = b.comment ? "italic" : "normal";
        s.style.opacity = b.comment ? "0.82" : "1";
        s.style.textDecoration = b.underline ? "underline" : "none";
        s.style.textDecorationThickness = b.underline ? "2px" : "";
        s.style.textUnderlineOffset = b.underline ? "2px" : "";
        // Torn left edge; strips overlap so the tear falls on the piece behind.
        s.style.clipPath = tearPath(b.tear);
        s.style.marginLeft = j === 0 ? "0" : `-${TEAR_PX + 1}px`;
        // The plate slipped: a second impression sits off-register behind the
        // type. On a knocked-out strip it is the only thing holding the line.
        s.style.textShadow = `${MISPRINT_PX}px ${MISPRINT_PX * 0.6}px 0 ${b.ghost}`;
        if (b.knockout) {
          s.style.background = "transparent";
          s.style.webkitTextStrokeWidth = "0.6px";
          s.style.webkitTextStrokeColor = b.ghost;
        } else {
          s.style.webkitTextStrokeWidth = "0";
        }
      }
    };

    const measure = () => {
      w = host.clientWidth || 1;
      h = host.clientHeight || 1;
      font = Math.max(9, w * FONT_RATIO);
      line = font * LINE_RATIO;
      step = line * STEP_RATIO;
      drift.resize(w, h);
      for (const r of rows) paintRow(r);
    };

    const drift = new Drift(w, h);

    let headTarget = { x: w * 0.66, y: h * 0.26 };
    let lastPush = { ...headTarget };
    let pointerInside = false;

    measure();

    // Seed the pool already resolved, so it never assembles itself on screen.
    const layout = () => {
      for (const r of rows) {
        r.pos.x = headTarget.x - r.slot * step;
        r.pos.y = headTarget.y + r.slot * line;
      }
    };
    layout();

    const write = () => {
      for (const r of rows) {
        const pr = presence(r.slot, ROWS);
        // Anchored by the right edge, so runs grow leftward and clip off frame.
        r.el.style.transform =
          `translate3d(${r.pos.x.toFixed(2)}px, ${r.pos.y.toFixed(2)}px, 0)` +
          ` rotate(${r.data.tilt.toFixed(2)}deg) translateX(-100%)`;
        r.el.style.opacity = pr.toFixed(3);
        // Tail rows lose their colour into the plate rather than only fading.
        r.el.style.filter = `saturate(${(0.25 + pr * 0.75).toFixed(3)}) brightness(${(0.72 + pr * 0.28).toFixed(3)})`;
        r.el.style.zIndex = String(ROWS - r.slot);
      }
    };
    write();

    if (reduced) {
      // One static, resolved staircase. Nothing moves, nothing is scheduled.
      return () => {
        for (const r of rows) r.el.remove();
      };
    }

    /** Recycle the tail as the new head — the element count never changes. */
    const push = () => {
      const reborn = order.pop() as Row;
      reborn.data = buildRow();
      reborn.pos = { ...headTarget };
      order.unshift(reborn);
      for (let i = 0; i < order.length; i++) order[i].slot = i;
      for (const r of rows) paintRow(r);
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

      if (!pointerInside) headTarget = drift.step(dt);

      // Front to back, so each row reads its parent's already-updated position.
      // Walk it the other way and the lag never accumulates — the whole chain
      // ends up uniformly one frame behind instead of trailing.
      for (let i = 0; i < order.length; i++) {
        const r = order[i];
        const k = chaseRate(r.slot, ROWS);
        const tx = i === 0 ? headTarget.x : order[i - 1].pos.x - step;
        const ty = i === 0 ? headTarget.y : order[i - 1].pos.y + line;
        r.pos.x += (tx - r.pos.x) * k;
        r.pos.y += (ty - r.pos.y) * k;
      }

      write();

      // Push by distance, never by time: a still pointer cannot bury the stack
      // on one spot, and a fast sweep lays a longer ribbon than a slow one.
      const travelled = Math.hypot(headTarget.x - lastPush.x, headTarget.y - lastPush.y);
      if (travelled >= w * TRAVEL_RATIO) {
        lastPush = { ...headTarget };
        push();
      }

      if (running) raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      const should = onScreen && !hidden;
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

    const onPointer = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointerInside = true;
      headTarget = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => {
      pointerInside = false;
      drift.reseed(headTarget);
    };
    const onVis = () => {
      hidden = document.hidden;
      sync();
    };

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es.some((e) => e.isIntersecting);
        sync();
      },
      { rootMargin: "200px" },
    );
    io.observe(host);

    const ro = new ResizeObserver(() => measure());
    ro.observe(host);

    host.addEventListener("pointermove", onPointer);
    host.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      host.removeEventListener("pointermove", onPointer);
      host.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      for (const r of rows) r.el.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="A trail of code fragments on tonal coloured bars, stacked into a staircase that follows the pointer"
      style={{ background: plate, isolation: "isolate" }}
      className={cn(
        "relative aspect-[1344/620] w-full select-none overflow-hidden rounded-[12px]",
        className,
      )}
    >
      {/* Press grain over everything, so the ribbon sits in the paper rather
          than floating on top of it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[999] opacity-[0.16] mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px" }}
      />
    </div>
  );
}
