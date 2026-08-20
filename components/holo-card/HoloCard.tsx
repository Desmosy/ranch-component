"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import espanaHoloCard from "../assets/espana_holo_card.webp";

interface Spark {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  hue: number;
  sat: number;
  lum: number;
}

function createSparks(count: number): Spark[] {
  const sparks: Spark[] = [];
  for (let i = 0; i < count; i++) {
    const hue = [0, 30, 190, 280, 55][Math.floor(Math.random() * 5)];
    sparks.push({
      x: Math.random(),
      y: Math.random(),
      r: 0.8 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      speed: 1.5 + Math.random() * 3,
      hue,
      sat: Math.random() < 0.55 ? 0 : 30 + Math.random() * 50,
      lum: 85 + Math.random() * 15,
    });
  }
  return sparks;
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const inner = r * 0.25;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const dist = i % 2 === 0 ? r : inner;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}


export interface HoloCardProps extends React.HTMLAttributes<HTMLDivElement> {
  image?: string;
  tilt?: number;
  holo?: number;
  glare?: number;
  sparkle?: number;
  radius?: number;
  idle?: boolean;
  pop?: number;
}

export default function HoloCard({
  image = espanaHoloCard,
  tilt = 16,
  holo = 1,
  glare = 1,
  sparkle = 1,
  radius = 18,
  idle = true,
  pop = 1,
  className,
  style,
  ...props
}: HoloCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const sparkleRafRef = useRef<number>(0);
  const uid = useMemo(() => `holo-${Math.random().toString(36).slice(2, 8)}`, []);
  const sparksRef = useRef<Spark[]>(createSparks(120));

  const setVars = useCallback((v: Record<string, string>) => {
    const el = rootRef.current;
    if (!el) return;
    for (const key in v) el.style.setProperty(key, v[key]);
  }, []);

  const update = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const px = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      const py = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
      const dx = px - 0.5;
      const dy = py - 0.5;
      const dist = Math.min(Math.hypot(dx, dy) / 0.7071, 1);

      setVars({
        "--px": `${(px * 100).toFixed(2)}%`,
        "--py": `${(py * 100).toFixed(2)}%`,
        "--rx": `${(-dy * tilt * 2).toFixed(2)}deg`,
        "--ry": `${(dx * tilt * 2).toFixed(2)}deg`,
        "--bx": `${(15 + px * 70).toFixed(2)}%`,
        "--by": `${(15 + py * 70).toFixed(2)}%`,
        "--active": `${(0.4 + dist * 0.6).toFixed(3)}`,
      });
    },
    [tilt, setVars]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const x = e.clientX;
      const y = e.clientY;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => update(x, y));
    },
    [update]
  );

  const onEnter = useCallback(() => {
    const el = rootRef.current;
    if (el) el.dataset.active = "true";
  }, []);

  const onLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const el = rootRef.current;
    if (!el) return;
    el.dataset.active = "false";
    setVars({
      "--px": "50%",
      "--py": "50%",
      "--rx": "0deg",
      "--ry": "0deg",
      "--bx": "50%",
      "--by": "50%",
      "--active": "0",
    });
  }, [setVars]);

  // ── Sparkle canvas animation loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sparks = sparksRef.current;
    let running = true;

    const draw = (time: number) => {
      if (!running) return;
      const t = time / 1000; // seconds

      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (canvas.width !== w * 2 || canvas.height !== h * 2) {
        canvas.width = w * 2;
        canvas.height = h * 2;
        ctx.scale(2, 2); // retina
      }

      ctx.clearRect(0, 0, w, h);

      for (const s of sparks) {
        const blink = Math.sin(t * s.speed + s.phase);
        if (blink < 0.3) continue;

        const alpha = ((blink - 0.3) / 0.7) * sparkle * 0.8;
        const px = s.x * w;
        const py = s.y * h;

        drawStar(ctx, px, py, s.r * 1.8);
        ctx.fillStyle = `hsla(${s.hue}, ${s.sat}%, ${s.lum}%, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      sparkleRafRef.current = requestAnimationFrame(draw);
    };

    sparkleRafRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(sparkleRafRef.current);
    };
  }, [sparkle]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div
      ref={rootRef}
      data-active="false"
      className={className}
      onPointerMove={onPointerMove}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      style={{
        ["--tilt" as string]: `${tilt}deg`,
        ["--holo" as string]: `${holo}`,
        ["--glare" as string]: `${glare}`,
        ["--sparkle" as string]: `${sparkle}`,
        ["--radius" as string]: `${radius}px`,
        ["--pop" as string]: `${pop}`,
        ["--img" as string]: `url(${JSON.stringify(image)})`,
        ["--px" as string]: "50%",
        ["--py" as string]: "50%",
        ["--rx" as string]: "0deg",
        ["--ry" as string]: "0deg",
        ["--bx" as string]: "50%",
        ["--by" as string]: "50%",
        ["--active" as string]: "0",
        position: "relative",
        aspectRatio: "2 / 3",
        perspective: "900px",
        touchAction: "none",
        cursor: "pointer",
        ...style,
      }}
      {...props}
    >
      <style>{css(uid, idle)}</style>
      <div className={`${uid}-card`}>
        <div className={`${uid}-shine`} />
        <div className={`${uid}-glare`} />
        <canvas
          ref={canvasRef}
          className={`${uid}-sparkle`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function css(u: string, idle: boolean) {
  return `
.${u}-card {
  position: absolute;
  inset: 0;
  border-radius: var(--radius);
  background-image: var(--img);
  background-size: cover;
  background-position: center;
  transform-style: preserve-3d;
  transform: rotateX(var(--rx)) rotateY(var(--ry)) translateZ(0);
  transition: transform 320ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 320ms ease;
  box-shadow: 0 8px 22px -12px rgba(0,0,0,0.7), 0 0 8px 1px rgba(255, 214, 92, 0.28);
  will-change: transform;
  overflow: hidden;
  isolation: isolate;
  pointer-events: none;
}
[data-active="true"] > .${u}-card {
  transition: transform 80ms ease-out, box-shadow 80ms ease-out;
  transform: rotateX(var(--rx)) rotateY(var(--ry)) translateZ(calc(28px * var(--pop)));
  box-shadow: 0 26px 44px -18px rgba(0,0,0,0.75), 0 0 16px 2px rgba(255, 214, 92, 0.45);
}

.${u}-card > div,
.${u}-card > canvas {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}
.${u}-card > canvas {
  width: 100%;
  height: 100%;
  mix-blend-mode: color-dodge;
}

/* Rainbow holographic sheen */
.${u}-shine {
  background-image:
    repeating-linear-gradient(
      110deg,
      rgba(255, 0, 132, 0.5) 0%,
      rgba(255, 215, 0, 0.5) 12%,
      rgba(0, 255, 178, 0.5) 24%,
      rgba(0, 174, 255, 0.5) 36%,
      rgba(160, 0, 255, 0.5) 48%,
      rgba(255, 0, 132, 0.5) 60%
    ),
    linear-gradient(
      115deg,
      transparent 20%,
      rgba(0, 231, 255, 0.55) 40%,
      rgba(255, 0, 231, 0.55) 60%,
      transparent 80%
    );
  background-size: 220% 220%, 300% 300%;
  background-position: var(--bx) var(--by), var(--bx) var(--by);
  background-blend-mode: color-dodge;
  mix-blend-mode: color-dodge;
  filter: brightness(0.9) contrast(1.35) saturate(1.5);
  opacity: calc(var(--active) * 0.65 * var(--holo));
  transition: opacity 320ms ease;
  ${idle ? `animation: ${u}-drift 8s ease-in-out infinite;` : ""}
}

/* Moving light / glare that tracks the cursor */
.${u}-glare {
  background: radial-gradient(
    farthest-corner circle at var(--px) var(--py),
    rgba(255, 255, 255, 0.8) 0%,
    rgba(255, 255, 255, 0.32) 12%,
    rgba(120, 120, 140, 0.1) 40%,
    rgba(0, 0, 0, 0.5) 100%
  );
  mix-blend-mode: overlay;
  opacity: calc((0.3 + var(--active) * 0.75) * var(--glare));
  transition: opacity 320ms ease;
}

@keyframes ${u}-drift {
  0%, 100% { filter: brightness(0.9) contrast(1.35) saturate(1.5); }
  50% { filter: brightness(1.1) contrast(1.5) saturate(1.7); }
}

@media (prefers-reduced-motion: reduce) {
  .${u}-card { transition: none; }
  .${u}-shine { animation: none; }
}
`;
}
