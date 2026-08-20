import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";

export type PaletteKey = "nebula" | "solar" | "aurora" | "iridescent" | "monochrome";

export const PALETTES: Record<PaletteKey, { name: string; bg: string; colors: string[]; glow: string }> = {
  nebula: {
    name: "Nebula",
    bg: "#05060a",
    colors: ["#6366f1", "#a855f7", "#ec4899", "#38bdf8", "#f43f5e", "#e0e7ff"],
    glow: "#818cf8",
  },
  solar: {
    name: "Solar",
    bg: "#0a0502",
    colors: ["#f97316", "#ef4444", "#facc15", "#fb923c", "#f43f5e", "#fffbeb"],
    glow: "#f97316",
  },
  aurora: {
    name: "Aurora",
    bg: "#020a08",
    colors: ["#10b981", "#06b6d4", "#3b82f6", "#a7f3d0", "#6ee7b7", "#e0f2fe"],
    glow: "#10b981",
  },
  iridescent: {
    name: "Prism",
    bg: "#08070d",
    colors: ["#ec4899", "#8b5cf6", "#06b6d4", "#fde047", "#a855f7", "#f472b6"],
    glow: "#c084fc",
  },
  monochrome: {
    name: "Mono",
    bg: "#080808",
    colors: ["#ffffff", "#e2e8f0", "#94a3b8", "#64748b", "#cbd5e1", "#f8fafc"],
    glow: "#ffffff",
  },
};

export interface ChromaticFlowHandle {
  randomize: () => void;
}

export interface ChromaticFlowProps {
  palette?: PaletteKey;
  speed?: number;
  density?: "S" | "M" | "L";
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  trail: Array<{ x: number; y: number }>;
}

export const ChromaticFlow = forwardRef<ChromaticFlowHandle, ChromaticFlowProps>(
  ({ palette = "nebula", speed = 1.0, density = "M" }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animFrameRef = useRef<number | null>(null);
    const timeRef = useRef<number>(0);

    const mouseRef = useRef<{ x: number; y: number; isDown: boolean }>({
      x: -9999,
      y: -9999,
      isDown: false,
    });

    const activePalette = PALETTES[palette] || PALETTES.nebula;
    const particleCount = density === "S" ? 400 : density === "M" ? 850 : 1400;

    const initParticles = useCallback(
      (width: number, height: number) => {
        const colors = activePalette.colors;
        const pList: Particle[] = [];

        for (let i = 0; i < particleCount; i++) {
          pList.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            life: Math.random() * 200 + 50,
            maxLife: Math.random() * 200 + 100,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 2.0 + 0.8,
            trail: [],
          });
        }
        particlesRef.current = pList;
      },
      [activePalette, particleCount]
    );

    useImperativeHandle(ref, () => ({
      randomize: () => {
        const canvas = canvasRef.current;
        if (canvas) {
          initParticles(canvas.width, canvas.height);
        }
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;

      let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
      let height = (canvas.height = canvas.parentElement?.clientHeight || 500);

      const handleResize = () => {
        if (!canvas || !canvas.parentElement) return;
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = canvas.parentElement.clientHeight;
        initParticles(width, height);
      };

      window.addEventListener("resize", handleResize);
      initParticles(width, height);

      const render = () => {
        timeRef.current += 0.007 * speed;
        const t = timeRef.current;

        // Long soft motion trail fade
        ctx.fillStyle = activePalette.bg + "18";
        ctx.fillRect(0, 0, width, height);

        ctx.globalCompositeOperation = "lighter";

        const mouse = mouseRef.current;
        const particles = particlesRef.current;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          // Smooth multi-octave Curl Noise field
          const s = 0.0032;
          const n1 = Math.sin(p.x * s + t * 0.4) * Math.cos(p.y * s + t * 0.3);
          const n2 = Math.sin((p.x + p.y) * s * 0.7 - t * 0.5);
          const n3 = Math.cos(Math.sqrt(p.x * p.x + p.y * p.y) * s * 0.5 + t * 0.2);
          const angle = ((n1 + n2 + n3) / 3) * Math.PI * 4;

          const fx = Math.cos(angle) * 1.6 * speed;
          const fy = Math.sin(angle) * 1.6 * speed;

          p.vx = p.vx * 0.92 + fx * 0.08;
          p.vy = p.vy * 0.92 + fy * 0.08;

          // Interactive mouse gravitation
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 180 && dist > 1) {
            const force = (1 - dist / 180) * (mouse.isDown ? -4.5 : 2.5);
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }

          const prevX = p.x;
          const prevY = p.y;

          p.x += p.vx;
          p.y += p.vy;

          // Edge respawn - clear trail when wrapping so NO horizontal lines are drawn!
          let hasWrapped = false;
          if (p.x < 0) {
            p.x = width;
            hasWrapped = true;
          } else if (p.x > width) {
            p.x = 0;
            hasWrapped = true;
          }
          if (p.y < 0) {
            p.y = height;
            hasWrapped = true;
          } else if (p.y > height) {
            p.y = 0;
            hasWrapped = true;
          }

          if (hasWrapped) {
            p.trail = [];
          } else {
            p.trail.push({ x: prevX, y: prevY });
            if (p.trail.length > 6) p.trail.shift();
          }

          p.life++;
          if (p.life > p.maxLife) {
            p.x = Math.random() * width;
            p.y = Math.random() * height;
            p.life = 0;
            p.trail = [];
            p.color = activePalette.colors[Math.floor(Math.random() * activePalette.colors.length)];
          }

          // Render Streamlines without cross-canvas wrapping lines
          if (p.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(p.trail[0].x, p.trail[0].y);
            for (let j = 1; j < p.trail.length; j++) {
              // Safety check: skip if jump distance is large (prevent wrapping lines)
              const segDist = Math.hypot(p.trail[j].x - p.trail[j - 1].x, p.trail[j].y - p.trail[j - 1].y);
              if (segDist < 50) {
                ctx.lineTo(p.trail[j].x, p.trail[j].y);
              }
            }
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.lineCap = "round";
            ctx.stroke();
          }

          // Luminous Core Dot
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.1, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }

        ctx.globalCompositeOperation = "source-over";
        animFrameRef.current = requestAnimationFrame(render);
      };

      animFrameRef.current = requestAnimationFrame(render);

      return () => {
        window.removeEventListener("resize", handleResize);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }, [activePalette, speed, particleCount, initParticles]);

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };

    const handlePointerLeave = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
      mouseRef.current.isDown = false;
    };

    const handlePointerDown = () => {
      mouseRef.current.isDown = true;
    };

    const handlePointerUp = () => {
      mouseRef.current.isDown = false;
    };

    return (
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        className="w-full h-full block cursor-crosshair"
      />
    );
  }
);

ChromaticFlow.displayName = "ChromaticFlow";
export default ChromaticFlow;
