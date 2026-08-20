import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';

export type PixelDesign = 'wiener' | 'pacman' | 'heart' | 'rings' | 'marquee';

export interface CraftPixelCanvasHandle {
  randomize: () => void;
  triggerShockwave: (x?: number, y?: number, power?: number) => void;
  clearGrid: () => void;
}

export interface CraftPixelCanvasProps {
  cellSize?: 'S' | 'M' | 'L';
  brushSize?: 'S' | 'M' | 'L';
  design?: PixelDesign;
  className?: string;
  children?: React.ReactNode;
}

const CELL_SIZES = { S: 9, M: 14, L: 22 };
const BRUSH_SIZES = { S: 7, M: 10, L: 16 };

const BANDS: [number, string][] = [
  [0.30, '#1c2541'],
  [0.46, '#3b5bd9'],
  [0.62, '#f5c518'],
  [0.78, '#e0492a'],
];
const NEON_COLOR = '#d8ff00';

export const CraftPixelCanvas = forwardRef<CraftPixelCanvasHandle, CraftPixelCanvasProps>(({
  cellSize = 'S',
  brushSize = 'M',
  design = 'wiener',
  className = '',
  children,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stateRef = useRef({
    cell: CELL_SIZES[cellSize],
    brush: BRUSH_SIZES[brushSize],
    design: design,
    width: 0,
    height: 0,
    cols: 0,
    rows: 0,
    heat: new Float32Array(0),
    seed: Math.random() * 1000,
    t: 0,
    lastTime: performance.now(),
    mx: -1,
    my: -1,
    pmx: -1,
    pmy: -1,
    lastMove: 0,
    charging: false,
    chargeStart: 0,
    chargePos: { x: 0, y: 0 },
    shake: 0,
    waves: [] as Array<{ x: number; y: number; t0: number; pow: number }>,
    pacOn: false,
    pacx: 0,
    pacy: 0,
    pacDir: 1,
    pacStart: 0,
    pacAge: 0,
    pFood: 34,
  });

  useEffect(() => {
    stateRef.current.cell = CELL_SIZES[cellSize];
    stateRef.current.brush = BRUSH_SIZES[brushSize];
    stateRef.current.design = design;
  }, [cellSize, brushSize, design]);

  const depositHeat = useCallback((cx: number, cy: number, amt: number, sig: number) => {
    const s = stateRef.current;
    if (s.cols === 0 || s.rows === 0) return;
    const cc = cx / s.cell;
    const cr = cy / s.cell;
    const rad = Math.ceil(sig * 1.6);
    const inv = 1 / (2 * sig * sig * 0.18);

    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const c = Math.floor(cc + dc);
        const r = Math.floor(cr + dr);
        if (c < 0 || r < 0 || c >= s.cols || r >= s.rows) continue;
        const dx = c + 0.5 - cc;
        const dy = r + 0.5 - cr;
        const w = Math.exp(-(dx * dx + dy * dy) * inv);
        if (w < 0.02) continue;
        const id = r * s.cols + c;
        const vv = s.heat[id] + amt * w;
        s.heat[id] = vv > 1.2 ? 1.2 : vv;
      }
    }
  }, []);

  const followPointer = useCallback(
    (x: number, y: number, sig: number) => {
      const s = stateRef.current;
      if (s.pmx < 0) {
        s.pmx = x;
        s.pmy = y;
      }
      const dx = x - s.pmx;
      const dy = y - s.pmy;
      const dl = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.min(48, Math.round(dl / (s.cell * 0.8))));

      for (let i = 1; i <= steps; i++) {
        const f = i / steps;
        depositHeat(s.pmx + dx * f, s.pmy + dy * f, 0.22, sig);
      }
      s.pmx = x;
      s.pmy = y;
    },
    [depositHeat]
  );

  const triggerShockwave = useCallback(
    (x?: number, y?: number, power = 1.8) => {
      const s = stateRef.current;
      const px = x ?? (s.mx > 0 ? s.mx : s.width / 2);
      const py = y ?? (s.my > 0 ? s.my : s.height / 2);
      const now = performance.now() / 1000;
      s.waves.push({ x: px, y: py, t0: now, pow: power });
      depositHeat(px, py, 1.2, s.brush * (2.5 + power * 10));
      s.shake = Math.max(s.shake, 0.4 + power * 1.2);
    },
    [depositHeat]
  );

  const randomize = useCallback(() => {
    stateRef.current.seed = Math.random() * 1000;
    triggerShockwave(undefined, undefined, 2.2);
  }, [triggerShockwave]);

  const clearGrid = useCallback(() => {
    stateRef.current.heat.fill(0);
  }, []);

  useImperativeHandle(ref, () => ({
    randomize,
    triggerShockwave,
    clearGrid,
  }));

  const stampPacman = useCallback((cx: number, cy: number, rad: number, ang: number, mouth: number, val: number) => {
    const s = stateRef.current;
    const c0 = Math.floor((cx - rad) / s.cell);
    const c1 = Math.ceil((cx + rad) / s.cell);
    const r0 = Math.floor((cy - rad) / s.cell);
    const r1 = Math.ceil((cy + rad) / s.cell);
    const rr = rad * rad;

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (c < 0 || r < 0 || c >= s.cols || r >= s.rows) continue;
        const dx = (c + 0.5) * s.cell - cx;
        const dy = (r + 0.5) * s.cell - cy;
        if (dx * dx + dy * dy > rr) continue;
        const angleToCell = Math.atan2(dy, dx);
        const da = Math.abs((((angleToCell - ang) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
        if (da < mouth) continue;

        const id = r * s.cols + c;
        const v = val + 0.03 * Math.sin(c * 0.7 + r * 0.7 - s.t * 0.01);
        if (v > s.heat[id]) s.heat[id] = v;
      }
    }
  }, []);

  const updateAgent = useCallback(
    () => {
      const s = stateRef.current;
      if (!s.pacOn) {
        s.pacOn = true;
        s.pacDir = s.mx > 0 && s.mx < s.width * 0.5 ? 1 : -1;
        s.pacx = s.width * 0.2;
        s.pacy = s.height * 0.45;
        s.pacStart = s.pacx;
        s.pacAge = 0;
        s.pFood = s.brush * 3.4;
      }

      const rad = s.brush * 3.4;
      s.pacAge++;
      s.pacx += s.pacDir * 3.2;

      if (s.pacx > s.width + rad + 20 || s.pacx < -rad - 20) {
        s.pacDir = Math.random() < 0.5 ? 1 : -1;
        s.pacy = 80 + Math.random() * Math.max(100, s.height - 160);
        s.pacx = s.pacDir > 0 ? -rad : s.width + rad;
        s.pacStart = s.pacx;
        s.pacAge = 0;
      }

      const ang = s.pacDir > 0 ? 0 : Math.PI;
      const pr = Math.round(s.pacy / s.cell);

      for (let k = 1; k <= 60; k++) {
        const px = s.pacStart + s.pacDir * s.pFood * k;
        if (px < -20 || px > s.width + 20) continue;
        if (s.pacDir * (px - s.pacx) > rad * 0.7) {
          const pc = Math.round(px / s.cell);
          if (pc >= 0 && pr >= 0 && pc < s.cols && pr < s.rows) {
            const pid = pr * s.cols + pc;
            if (0.72 > s.heat[pid]) s.heat[pid] = 0.72;
          }
        }
      }

      const mouth = 0.05 + 0.6 * Math.abs(Math.sin(s.pacAge * 0.16));
      stampPacman(s.pacx, s.pacy, rad, ang, mouth, 0.72);
    },
    [stampPacman]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);

      stateRef.current.width = w;
      stateRef.current.height = h;

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cell = stateRef.current.cell;
      const cols = Math.ceil(w / cell) + 1;
      const rows = Math.ceil(h / cell) + 1;

      if (cols !== stateRef.current.cols || rows !== stateRef.current.rows) {
        stateRef.current.cols = cols;
        stateRef.current.rows = rows;
        stateRef.current.heat = new Float32Array(cols * rows);
      }
    };

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
    resize();

    const hashNoise = (c: number, r: number, seed: number) => {
      const n = Math.sin(c * 127.1 + r * 311.7 + seed * 0.13) * 43758.5453;
      return n - Math.floor(n);
    };

    const baseNoise = (nx: number, ny: number, tt: number, seed: number) => {
      nx += Math.sin(ny * 5 + tt * 0.5 + seed) * 0.05;
      ny += Math.cos(nx * 5 - tt * 0.4) * 0.05;
      const v =
        Math.sin(nx * 5.6 + seed * 1.3 + tt * 0.3) * Math.cos(ny * 4.7 - seed * 0.7 + tt * 0.22) +
        Math.sin((nx * 1.4 + ny * 1.7) * 4.1 - seed + tt * 0.16) +
        Math.sin(ny * 9 + seed * 2.1 + nx * 3) * 0.5 +
        Math.sin(nx * 13 - seed * 1.7) * 0.28;
      return 0.5 + 0.5 * (v / 2.55);
    };

    const render = (time: number) => {
      const s = stateRef.current;
      const dt = Math.min((time - s.lastTime) / 1000, 0.1);
      s.lastTime = time;
      s.t += dt * 1000;
      const tt = s.t * 0.001;
      const now = time / 1000;

      for (let i = 0; i < s.heat.length; i++) {
        s.heat[i] *= 0.88;
        if (s.heat[i] < 0.003) s.heat[i] = 0;
      }

      const idleTime = now - s.lastMove;
      if (s.mx > 0 && s.my > 0) {
        if (idleTime < 1.5) {
          s.pacOn = false;
          followPointer(s.mx, s.my, s.brush);
        } else {
          updateAgent();
        }
      } else {
        updateAgent();
      }

      if (s.charging) {
        const chg = Math.min((now - s.chargeStart) / 1.8, 1.0);
        depositHeat(s.chargePos.x, s.chargePos.y, 0.45 + chg * 0.5, s.brush * (2 + chg * 8));
        s.shake = Math.max(s.shake, 0.1 + chg * 0.3);
      }

      for (let wi = s.waves.length - 1; wi >= 0; wi--) {
        const wv = s.waves[wi];
        const age = now - wv.t0;
        if (age > 1.4) {
          s.waves.splice(wi, 1);
          continue;
        }
        const pow = wv.pow || 1;
        const R = age * Math.hypot(s.width, s.height) * 1.6;
        const sig = s.cell * 5.0 * pow;
        const amp = Math.max(0, 1 - age / 1.4) * 1.2 * pow;
        const inv = 1 / (2 * sig * sig);

        for (let r = 0; r < s.rows; r++) {
          for (let c = 0; c < s.cols; c++) {
            const dx = (c + 0.5) * s.cell - wv.x;
            const dy = (r + 0.5) * s.cell - wv.y;
            const dd = Math.sqrt(dx * dx + dy * dy);
            const g = amp * Math.exp(-((dd - R) * (dd - R)) * inv);
            if (g > 0.02) {
              const id = r * s.cols + c;
              if (g > s.heat[id]) s.heat[id] = g;
            }
          }
        }
      }

      ctx.save();
      if (s.shake > 0.01) {
        s.shake *= 0.88;
        const dx = (Math.random() - 0.5) * s.shake * 16;
        const dy = (Math.random() - 0.5) * s.shake * 16;
        ctx.translate(dx, dy);
      } else {
        s.shake = 0;
      }

      ctx.clearRect(-20, -20, s.width + 40, s.height + 40);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-20, -20, s.width + 40, s.height + 40);

      const cell = s.cell;
      const pixelSize = cell - 1;
      ctx.strokeStyle = 'rgba(10, 10, 10, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = 0; gx <= s.width; gx += cell) {
        ctx.moveTo(gx + 0.5, 0);
        ctx.lineTo(gx + 0.5, s.height);
      }
      for (let gy = 0; gy <= s.height; gy += cell) {
        ctx.moveTo(0, gy + 0.5);
        ctx.lineTo(s.width, gy + 0.5);
      }
      ctx.stroke();

      const aspect = (s.cols * cell) / (s.rows * cell);

      for (let r = 0; r < s.rows; r++) {
        const ny = (r + 0.5) / s.rows;
        for (let c = 0; c < s.cols; c++) {
          const nx = (c + 0.5) / s.cols;
          const id = r * s.cols + c;
          let v = s.heat[id] * 0.92;

          if (s.design === 'wiener') {
            const gx = Math.floor(nx * 18 * Math.max(1, aspect));
            const gy = Math.floor(ny * 18);
            const diamond = (gx + gy) % 2 === 0;
            const chevron = Math.abs(((gx + gy * 0.7) % 6) - 3.0) < 1.4;

            if (diamond || chevron) {
              const ambientWave = baseNoise(nx, ny, tt, s.seed);
              if (ambientWave > 0.40) {
                v += 0.35 + 0.25 * Math.sin(nx * 8 + ny * 8 + tt * 1.5);
              }
            }
          } else if (s.design === 'rings') {
            const dx = (nx - 0.5) * Math.max(1, aspect);
            const dy = ny - 0.5;
            const dist = Math.hypot(dx, dy);
            const ring = Math.floor(dist * 16) % 2 === 0;

            if (ring) {
              const ambientWave = baseNoise(nx, ny, tt, s.seed);
              if (ambientWave > 0.35) {
                v += 0.38 + 0.22 * Math.cos(dist * 10 - tt * 2.0);
              }
            }
          } else if (s.design === 'heart') {
            const hx = (nx - 0.5) * 2.6 * Math.max(1, aspect / 1.2);
            const hy = (ny - 0.48) * 2.6;
            const heartEq = Math.pow(hx * hx + hy * hy - 1, 3) - hx * hx * Math.pow(hy, 3);

            if (heartEq <= 0) {
              v += 0.65 + 0.2 * Math.sin(tt * 4.0);
            } else {
              const ambientWave = baseNoise(nx, ny, tt, s.seed);
              if (ambientWave > 0.48) v += 0.30;
            }
          } else if (s.design === 'marquee') {
            const bar = Math.floor((nx * 14 * aspect + ny * 10 + tt * 3)) % 2 === 0;
            if (bar) {
              v += 0.38 + 0.25 * Math.sin(nx * 10 + tt * 2.0);
            }
          } else {
            const ambientWave = baseNoise(nx, ny, tt, s.seed);
            if (ambientWave > 0.45 && hashNoise(c * 1.7, r * 1.3, s.seed) < 0.88) {
              v += baseNoise(nx, ny, tt, s.seed) * 0.5 + (hashNoise(c, r, s.seed) - 0.5) * 0.12;
            }
          }

          if (v < 0.28 && !(v >= 0.86 && v < 1.02)) continue;

          let col = BANDS[0][1];
          if (v >= BANDS[1][0]) col = BANDS[1][1];
          if (v >= BANDS[2][0]) col = BANDS[2][1];
          if (v >= BANDS[3][0]) col = BANDS[3][1];
          if (v >= 0.86 && v < 1.02) col = NEON_COLOR;

          ctx.fillStyle = col;
          ctx.fillRect(c * cell, r * cell, pixelSize, pixelSize);
        }
      }

      ctx.restore();
      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
    };
  }, [followPointer, depositHeat, updateAgent]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = stateRef.current;
    s.mx = x;
    s.my = y;
    s.lastMove = performance.now() / 1000;
  };

  const handlePointerLeave = () => {
    const s = stateRef.current;
    s.mx = -1;
    s.my = -1;
    s.charging = false;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = stateRef.current;
    s.charging = true;
    s.chargeStart = performance.now() / 1000;
    s.chargePos = { x, y };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (!s.charging) return;
    s.charging = false;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const duration = performance.now() / 1000 - s.chargeStart;
    const power = 0.5 + Math.min(duration / 1.5, 1.0) * 1.8;
    triggerShockwave(x, y, power);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    triggerShockwave(e.clientX - rect.left, e.clientY - rect.top, 2.5);
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      className={`relative w-full h-full overflow-hidden select-none bg-white ${className}`}
      style={{ touchAction: 'none' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block pointer-events-none z-0" />
      <div className="relative z-10 w-full h-full pointer-events-auto">{children}</div>
    </div>
  );
});

CraftPixelCanvas.displayName = 'CraftPixelCanvas';

export default CraftPixelCanvas;
