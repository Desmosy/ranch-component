import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';

export type FirePalette = 'inferno' | 'craft' | 'cyberpunk' | 'toxic' | 'plasma' | 'monochrome';
export type CellSizeKey = 'S' | 'M' | 'L';
export type BrushSizeKey = 'S' | 'M' | 'L';

export interface PixelFireCanvasHandle {
  randomize: () => void;
  triggerShockwave: (x?: number, y?: number, power?: number) => void;
  clearGrid: () => void;
}

export interface PixelFireCanvasProps {
  cellSize?: CellSizeKey;
  brushSize?: BrushSizeKey;
  palette?: FirePalette;
  wind?: number;
  className?: string;
}

const CELL_SIZES: Record<CellSizeKey, number> = { S: 8, M: 12, L: 18 };
const BRUSH_SIZES: Record<BrushSizeKey, number> = { S: 2.5, M: 4.5, L: 7.5 };

const PALETTE_DEFINITIONS: Record<FirePalette, string[]> = {
  inferno: [
    '#1a0606', '#3b0a0a', '#660e0e', '#941414', '#c42314', '#e64010',
    '#f56c00', '#fb9b00', '#fcc200', '#fde036', '#fffa78', '#ffffc8'
  ],
  craft: [
    '#1c2541', '#283b8a', '#3b5bd9', '#7046d9', '#c43382', '#e0492a',
    '#ed7424', '#f5c518', '#e8e025', '#d8ff00', '#f2ff70', '#ffffff'
  ],
  cyberpunk: [
    '#14052b', '#2c0754', '#590a8a', '#9c0da1', '#d61198', '#e61884',
    '#f53198', '#ff54b0', '#00d5ff', '#00f0ff', '#8cf8ff', '#ffffff'
  ],
  toxic: [
    '#081408', '#0e3814', '#155e20', '#1c872d', '#2aa637', '#3fba24',
    '#68d424', '#91f822', '#bcfd4c', '#e5ff00', '#f3ff80', '#ffffff'
  ],
  plasma: [
    '#050e24', '#0c2254', '#143aa6', '#1e5ad4', '#267ce6', '#2b9bf5',
    '#38bcfd', '#66d4ff', '#00f0ff', '#70f6ff', '#bdfbff', '#ffffff'
  ],
  monochrome: [
    '#09090b', '#18181b', '#27272a', '#3f3f46', '#52525b', '#71717a',
    '#a1a1aa', '#d4d4d8', '#e4e4e7', '#f4f4f5', '#fafafa', '#ffffff'
  ]
};

export const PixelFireCanvas = forwardRef<PixelFireCanvasHandle, PixelFireCanvasProps>(({
  cellSize = 'S',
  brushSize = 'M',
  palette = 'inferno',
  wind = 0,
  className = '',
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stateRef = useRef({
    cell: CELL_SIZES[cellSize],
    brush: BRUSH_SIZES[brushSize],
    paletteName: palette,
    paletteColors: PALETTE_DEFINITIONS[palette],
    wind: wind,
    width: 0,
    height: 0,
    cols: 0,
    rows: 0,
    heat: new Float32Array(0),
    seed: Math.random() * 1000,
    t: 0,
    mx: -1,
    my: -1,
    pmx: -1,
    pmy: -1,
    isPointerDown: false,
    shake: 0,
    waves: [] as Array<{ x: number; y: number; t0: number; pow: number }>,
  });

  useEffect(() => {
    stateRef.current.cell = CELL_SIZES[cellSize];
    stateRef.current.brush = BRUSH_SIZES[brushSize];
    stateRef.current.paletteName = palette;
    stateRef.current.paletteColors = PALETTE_DEFINITIONS[palette];
    stateRef.current.wind = wind;
  }, [cellSize, brushSize, palette, wind]);

  const depositHeat = useCallback((cx: number, cy: number, amt: number, sig: number) => {
    const s = stateRef.current;
    if (s.cols === 0 || s.rows === 0) return;
    const cc = cx / s.cell;
    const cr = cy / s.cell;
    const rad = Math.ceil(sig * 1.8);
    const inv = 1 / (2 * sig * sig * 0.2);

    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const c = Math.floor(cc + dc);
        const r = Math.floor(cr + dr);
        if (c < 0 || r < 0 || c >= s.cols || r >= s.rows) continue;
        const dx = c + 0.5 - cc;
        const dy = r + 0.5 - cr;
        const w = Math.exp(-(dx * dx + dy * dy) * inv);
        if (w < 0.015) continue;
        const id = r * s.cols + c;
        const v = s.heat[id] + amt * w;
        s.heat[id] = v > 1.2 ? 1.2 : v;
      }
    }
  }, []);

  const followPointer = useCallback((x: number, y: number, sig: number, amt = 0.6) => {
    const s = stateRef.current;
    if (s.pmx < 0) {
      s.pmx = x;
      s.pmy = y;
    }
    const dx = x - s.pmx;
    const dy = y - s.pmy;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.min(60, Math.round(dist / (s.cell * 0.5))));

    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      depositHeat(s.pmx + dx * f, s.pmy + dy * f, amt, sig);
    }
    s.pmx = x;
    s.pmy = y;
  }, [depositHeat]);

  const triggerShockwave = useCallback((x?: number, y?: number, power = 1.8) => {
    const s = stateRef.current;
    const px = x ?? (s.mx > 0 ? s.mx : s.width / 2);
    const py = y ?? (s.my > 0 ? s.my : s.height * 0.7);
    const now = performance.now() / 1000;
    s.waves.push({ x: px, y: py, t0: now, pow: power });
    depositHeat(px, py, 1.2, s.brush * (2.5 + power * 4));
    s.shake = Math.max(s.shake, 0.4 + power * 0.8);
  }, [depositHeat]);

  const randomize = useCallback(() => {
    stateRef.current.seed = Math.random() * 1000;
    triggerShockwave(undefined, undefined, 2.0);
  }, [triggerShockwave]);

  const clearGrid = useCallback(() => {
    stateRef.current.heat.fill(0);
  }, []);

  useImperativeHandle(ref, () => ({
    randomize,
    triggerShockwave,
    clearGrid,
  }));

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let animFrameId: number;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      if (w === 0 || h === 0) return;

      const cell = stateRef.current.cell;
      const cols = Math.ceil(w / cell);
      const rows = Math.ceil(h / cell);

      canvas.width = w;
      canvas.height = h;
      stateRef.current.width = w;
      stateRef.current.height = h;

      if (cols !== stateRef.current.cols || rows !== stateRef.current.rows) {
        stateRef.current.cols = cols;
        stateRef.current.rows = rows;
        stateRef.current.heat = new Float32Array(cols * rows);
      }
    };

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
    resize();

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let lastTime = performance.now();

    const render = () => {
      animFrameId = requestAnimationFrame(render);

      const now = performance.now();
      const delta = now - lastTime;
      if (delta < 14) return;
      lastTime = now;

      const s = stateRef.current;
      s.t += 1;
      const timeSec = now / 1000;
      const { cols, rows, cell, heat, paletteColors, wind } = s;

      if (cols === 0 || rows === 0 || heat.length === 0) return;

      // Dynamic Organic Flame Height Ignition (Harmonic Sine Waves & Peaks)
      const tt = timeSec * 2.2;
      const r1 = (rows - 1) * cols;
      const r2 = (rows - 2) * cols;
      const r3 = (rows - 3) * cols;
      const r4 = (rows - 4) * cols;

      for (let c = 0; c < cols; c++) {
        const nx = c / cols;
        // Combine harmonic waves to create moving high peaks & low valleys across columns
        const w1 = Math.sin(nx * 12 + tt);
        const w2 = Math.sin(nx * 24 - tt * 1.6) * 0.6;
        const w3 = Math.sin(nx * 6 + tt * 0.7) * 0.9;
        const peakFactor = Math.max(0, (w1 + w2 + w3) / 1.8); // 0.0 to 1.2+

        // Dynamic modulated heat intensity per column
        const colHeat = 0.2 + peakFactor * 0.75 + (Math.random() - 0.5) * 0.15;

        if (colHeat > 0.15) {
          heat[r1 + c] = Math.min(1.2, Math.max(heat[r1 + c], colHeat));
        } else {
          heat[r1 + c] *= 0.8;
        }

        if (colHeat > 0.4) {
          heat[r2 + c] = Math.min(1.2, Math.max(heat[r2 + c], colHeat * 0.88));
        }

        // Higher flame tongues on peak columns
        if (colHeat > 0.75 && Math.random() > 0.25) {
          heat[r3 + c] = Math.min(1.2, Math.max(heat[r3 + c], colHeat * 0.95));
        }
        if (colHeat > 0.95 && Math.random() > 0.4) {
          heat[r4 + c] = Math.min(1.2, Math.max(heat[r4 + c], colHeat * 0.9));
        }
      }

      // Pointer drag heat deposition
      if (s.isPointerDown && s.mx >= 0 && s.my >= 0) {
        followPointer(s.mx, s.my, s.brush * 1.5, 0.55);
      } else if (s.mx >= 0 && s.my >= 0) {
        depositHeat(s.mx, s.my, 0.25, s.brush);
      }

      // Process expanding shockwaves
      for (let wi = s.waves.length - 1; wi >= 0; wi--) {
        const wv = s.waves[wi];
        const age = timeSec - wv.t0;
        if (age > 1.2) {
          s.waves.splice(wi, 1);
          continue;
        }
        const pow = wv.pow || 1;
        const R = age * Math.hypot(s.width, s.height) * 1.4;
        const sig = cell * 4.0 * pow;
        const amp = Math.max(0, 1 - age / 1.2) * 1.1 * pow;
        const inv = 1 / (2 * sig * sig);

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const dx = (c + 0.5) * cell - wv.x;
            const dy = (r + 0.5) * cell - wv.y;
            const dd = Math.sqrt(dx * dx + dy * dy);
            const g = amp * Math.exp(-((dd - R) * (dd - R)) * inv);
            if (g > 0.02) {
              const id = r * cols + c;
              heat[id] = Math.max(heat[id], g);
            }
          }
        }
      }

      // Upward Fire Propagation & Variable Column Cooling Decay
      const windOffset = Math.round(wind);
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
          const srcIdx = (r + 1) * cols + c;
          const val = heat[srcIdx];

          if (val <= 0.01) {
            heat[r * cols + c] *= 0.82;
          } else {
            // Per-column cooling variation creates uneven dancing flame spikes
            const colWave = Math.sin((c / cols) * 12 + tt);
            const coolingRate = 0.03 + (0.035 - colWave * 0.02) + Math.random() * 0.045;
            const dstVal = Math.max(0, val - coolingRate);

            // Horizontal wind shift with slight displacement
            const randWind = Math.floor(Math.random() * 3) - 1 + windOffset;
            const dstCol = Math.min(cols - 1, Math.max(0, c + randWind));

            heat[r * cols + dstCol] = dstVal;
          }
        }
      }

      // Camera Shake
      ctx.save();
      if (s.shake > 0.01) {
        s.shake *= 0.88;
        const dx = (Math.random() - 0.5) * s.shake * 12;
        const dy = (Math.random() - 0.5) * s.shake * 12;
        ctx.translate(dx, dy);
      } else {
        s.shake = 0;
      }

      // Fill white background (#ffffff)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-20, -20, s.width + 40, s.height + 40);

      // Craft Pixel grid lines
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

      // Render Fire Grid Pixels
      const numColors = paletteColors.length;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = heat[r * cols + c];
          if (v < 0.04) continue;

          const colorIdx = Math.min(numColors - 1, Math.floor(v * (numColors - 1)));
          const col = paletteColors[colorIdx];

          ctx.fillStyle = col;
          ctx.fillRect(c * cell, r * cell, pixelSize, pixelSize);
        }
      }

      ctx.restore();
    };

    animFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
    };
  }, [depositHeat, followPointer]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = stateRef.current;
    s.isPointerDown = true;
    s.mx = x;
    s.my = y;
    s.pmx = x;
    s.pmy = y;
    depositHeat(x, y, 0.9, s.brush * 2.2);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = stateRef.current;
    s.mx = x;
    s.my = y;
    if (s.isPointerDown) {
      followPointer(x, y, s.brush * 1.6, 0.6);
    }
  };

  const handlePointerUp = () => {
    const s = stateRef.current;
    s.isPointerDown = false;
    s.pmx = -1;
    s.pmy = -1;
  };

  const handlePointerLeave = () => {
    const s = stateRef.current;
    s.isPointerDown = false;
    s.mx = -1;
    s.my = -1;
    s.pmx = -1;
    s.pmy = -1;
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className={`relative w-full h-full overflow-hidden bg-white touch-none cursor-crosshair ${className}`}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
});

PixelFireCanvas.displayName = 'PixelFireCanvas';

export default PixelFireCanvas;
