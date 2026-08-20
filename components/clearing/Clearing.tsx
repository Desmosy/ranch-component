"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  DAMPING,
  EDGE,
  INFLUENCE_RADIUS,
  MAX_PUSH,
  PAPER,
  POINTER_R,
  REST_POSE,
  RESTING_HOLES,
  STIFFNESS,
  THRESHOLD,
  ULTRA,
  VERMILION,
  WAKE_LEN,
  WAKE_MS,
  easeOutQuint,
} from "./pose";
import { BED_FONT, DEFAULT_LINES, STEPS, composeBed } from "./typebed";

const NODES = REST_POSE.length;
const HOLES = RESTING_HOLES.length;
const EATERS = HOLES + WAKE_LEN;
const ENTER_DELAY = 500;
const ENTER_MS = 1100;

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/**
 * One field, two signs.
 *
 * Nodes add inverse-square falloff; eaters — the resting clearings and every
 * sample of the pointer's wake — subtract it. The surface is the isoline where
 * the sum crosses the threshold, so a hole is bounded by exactly the same
 * curve as the outer edge of the mass would be. That is why the clearing has
 * hard, printed edges rather than looking erased.
 *
 * Necking is not animated anywhere. As a wake sample decays, the field it was
 * suppressing recovers from the rim inward, so the channel closes as a
 * thinning bridge that meets and snaps. It falls out of the falloff.
 *
 * EDGE exists only to antialias. Widen it and the mass becomes an airbrushed
 * blob, which is the opposite of the vinyl-cut edge this needs.
 */
const FRAG = (n: number, e: number) => `
precision highp float;
uniform vec3 uNodes[${n}];
uniform vec4 uEaters[${e}];
uniform vec3 uColor;
uniform float uEdge;
uniform float uThreshold;
void main() {
  vec2 p = gl_FragCoord.xy;
  float f = 0.0;
  for (int i = 0; i < ${n}; i++) {
    vec2 d = p - uNodes[i].xy;
    float r = uNodes[i].z;
    f += (r * r) / max(dot(d, d), 1.0);
  }
  for (int i = 0; i < ${e}; i++) {
    float wgt = uEaters[i].w;
    if (wgt <= 0.0) continue;
    vec2 d = p - uEaters[i].xy;
    float r = uEaters[i].z;
    f -= wgt * (r * r) / max(dot(d, d), 1.0);
  }
  float a = smoothstep(uThreshold - uEdge, uThreshold + uEdge, f);
  gl_FragColor = vec4(uColor * a, a);
}
`;

export interface ClearingProps {
  className?: string;
  /** Short, punchy strings. See typebed.ts. */
  lines?: string[];
}

export default function Clearing({ className, lines = DEFAULT_LINES }: ClearingProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bed = composeBed(lines);
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


    // --- preallocated state. Nothing in the frame loop allocates. -----------
    const home = new Float32Array(NODES * 2);
    const pos = new Float32Array(NODES * 2);
    const vel = new Float32Array(NODES * 2);
    const rad = new Float32Array(NODES);
    const nodeUni = new Float32Array(NODES * 3);
    const eatUni = new Float32Array(EATERS * 4);
    const wakeX = new Float32Array(WAKE_LEN);
    const wakeY = new Float32Array(WAKE_LEN);
    let wakeCount = 0;
    let wakeAt = 0;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let born = 0;
    let touchRelease = 0;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
    });

    let ctx2d: CanvasRenderingContext2D | null = null;
    let uNodes: WebGLUniformLocation | null = null;
    let uEaters: WebGLUniformLocation | null = null;

    if (gl) {
      const compile = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
      };
      const program = gl.createProgram()!;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG(NODES, EATERS)));
      gl.linkProgram(program);
      gl.useProgram(program);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      uNodes = gl.getUniformLocation(program, "uNodes");
      uEaters = gl.getUniformLocation(program, "uEaters");
      const c = ULTRA.slice(1);
      gl.uniform3f(
        gl.getUniformLocation(program, "uColor"),
        parseInt(c.slice(0, 2), 16) / 255,
        parseInt(c.slice(2, 4), 16) / 255,
        parseInt(c.slice(4, 6), 16) / 255,
      );
      gl.uniform1f(gl.getUniformLocation(program, "uEdge"), EDGE);
      gl.uniform1f(gl.getUniformLocation(program, "uThreshold"), THRESHOLD);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
    } else {
      ctx2d = canvas.getContext("2d");
    }

    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      // Capped at 2 — at this edge sharpness nobody can tell, and 3x triples
      // the fill cost for nothing.
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);

      for (let i = 0; i < NODES; i++) {
        home[i * 2] = REST_POSE[i].x * w;
        home[i * 2 + 1] = REST_POSE[i].y * h;
        rad[i] = REST_POSE[i].r * h;
      }
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    };

    /**
     * `offscreen` places the mass where the entrance starts. Seeding it at
     * home would have the first frame spring it OUT to the entrance position
     * and back, which reads as the mass flinching before it arrives.
     */
    const seed = (offscreen: boolean) => {
      const ox = offscreen ? -w * 0.55 : 0;
      const oy = offscreen ? -h * 0.4 : 0;
      for (let i = 0; i < NODES; i++) {
        pos[i * 2] = home[i * 2] + ox;
        pos[i * 2 + 1] = home[i * 2 + 1] + oy;
        vel[i * 2] = 0;
        vel[i * 2 + 1] = 0;
      }
    };

    /**
     * Ambient drift (§2.4). Two non-harmonic sines per axis stand in for a
     * simplex walk — at this amplitude and period the difference is not
     * visible, and it costs four trig calls a node instead of a noise lookup.
     */
    const drift = (i: number, t: number, out: [number, number]) => {
      const amp = Math.max(8, Math.min(18, rad[i] * 0.05));
      const p1 = 6 + ((i * 2.7) % 8);
      const p2 = 7.3 + ((i * 1.9) % 6.4);
      out[0] = Math.sin((t / p1) * Math.PI * 2 + i) * amp;
      out[1] = Math.cos((t / p2) * Math.PI * 2 + i * 1.7) * amp * 0.8;
    };

    const driftOut: [number, number] = [0, 0];

    /** Resting clearings first, then the wake. Weight 0 means "not present". */
    const packEaters = (t: number, live: boolean) => {
      for (let i = 0; i < HOLES; i++) {
        const hole = RESTING_HOLES[i];
        const wob = live ? Math.sin((t / (9 + i * 2.3)) * Math.PI * 2 + i) * 10 : 0;
        const wob2 = live ? Math.cos((t / (11 + i * 1.7)) * Math.PI * 2 + i) * 8 : 0;
        eatUni[i * 4] = (hole.x * w + wob) * dpr;
        eatUni[i * 4 + 1] = (h - (hole.y * h + wob2)) * dpr;
        eatUni[i * 4 + 2] = hole.r * h * dpr;
        eatUni[i * 4 + 3] = 1;
      }
      for (let s = 0; s < WAKE_LEN; s++) {
        const j = (HOLES + s) * 4;
        if (s >= wakeCount) {
          eatUni[j + 3] = 0;
          continue;
        }
        eatUni[j] = wakeX[s] * dpr;
        eatUni[j + 1] = (h - wakeY[s]) * dpr;
        eatUni[j + 2] = POINTER_R * h * dpr;
        // Most recent 1.0, oldest 0.15, linear between.
        eatUni[j + 3] = 1 - (s / (WAKE_LEN - 1)) * 0.85;
      }
    };

    const upload = () => {
      if (gl && uNodes && uEaters) {
        for (let i = 0; i < NODES; i++) {
          nodeUni[i * 3] = pos[i * 2] * dpr;
          // GL's y runs up the screen; the DOM's runs down.
          nodeUni[i * 3 + 1] = (h - pos[i * 2 + 1]) * dpr;
          nodeUni[i * 3 + 2] = rad[i] * dpr;
        }
        gl.uniform3fv(uNodes, nodeUni);
        gl.uniform4fv(uEaters, eatUni);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        return;
      }
      if (!ctx2d) return;
      // Fallback: flood the ground and punch the resting clearings. No field,
      // so no necking — but the fallback is static anyway, and it keeps the
      // hard edge and the composition.
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, w, h);
      ctx2d.fillStyle = ULTRA;
      ctx2d.fillRect(0, 0, w, h);
      ctx2d.globalCompositeOperation = "destination-out";
      for (const hole of RESTING_HOLES) {
        ctx2d.beginPath();
        ctx2d.arc(hole.x * w, hole.y * h, hole.r * h * 0.56, 0, Math.PI * 2);
        ctx2d.fill();
      }
      ctx2d.globalCompositeOperation = "source-over";
    };

    measure();
    seed(!reduced);
    packEaters(0, false);
    upload();

    if (reduced) {
      // The composed rest pose, held: ground plus its resting clearings.
      // Composition kept, motion dropped.
      const still = () => {
        measure();
        seed(false);
        packEaters(0, false);
        upload();
      };
      const roStatic = new ResizeObserver(still);
      roStatic.observe(wrap);
      return () => roStatic.disconnect();
    }

    let raf = 0;
    let running = false;
    let onScreen = false;
    let hidden = document.hidden;
    let pointerType = "mouse";

    const frame = (now: number) => {
      raf = 0;
      if (!born) born = now;
      const age = now - born;
      const t = now / 1000;

      // Entrance: the ground floods in from off-canvas.
      const enter =
        age < ENTER_DELAY ? 0 : easeOutQuint(Math.min(1, (age - ENTER_DELAY) / ENTER_MS));
      const offX = (1 - enter) * -w * 0.55;
      const offY = (1 - enter) * -h * 0.4;

      // Touch settles slower than a mouse — there is no live pointer left to
      // justify a quick snap back.
      const soft = touchRelease > 0 && now - touchRelease < 900;
      const k = soft ? 0.018 : STIFFNESS;
      const d = soft ? 0.86 : DAMPING;

      for (let i = 0; i < NODES; i++) {
        drift(i, t, driftOut);
        const hx = home[i * 2] + offX + (enter > 0.98 ? driftOut[0] : 0);
        const hy = home[i * 2 + 1] + offY + (enter > 0.98 ? driftOut[1] : 0);

        let tx = hx;
        let ty = hy;

        // The mass still shoulders away from the pointer. The clearing is cut
        // by the eaters, but without this the blue sits there being erased —
        // the displacement is what makes it read as material.
        for (let s = 0; s < wakeCount; s++) {
          const dx = pos[i * 2] - wakeX[s];
          const dy = pos[i * 2 + 1] - wakeY[s];
          const dist = Math.hypot(dx, dy) || 1;
          const fall = 1 - Math.min(1, dist / INFLUENCE_RADIUS);
          if (fall <= 0) continue;
          const weight = 1 - (s / (WAKE_LEN - 1)) * 0.85;
          const push = MAX_PUSH * fall * fall * weight;
          tx += (dx / dist) * push;
          ty += (dy / dist) * push;
        }

        // Spring, never a tween. Slightly underdamped, so the return overshoots
        // home and settles — that bounce is what reads as liquid, not rubber.
        vel[i * 2] += (tx - pos[i * 2]) * k;
        vel[i * 2 + 1] += (ty - pos[i * 2 + 1]) * k;
        vel[i * 2] *= d;
        vel[i * 2 + 1] *= d;
        pos[i * 2] += vel[i * 2];
        pos[i * 2 + 1] += vel[i * 2 + 1];
      }

      // The wake decays even while the pointer is still, so a held cursor does
      // not hold a hole open indefinitely — the mass closes back over it.
      if (wakeCount > 0 && now - wakeAt > 220) wakeCount--;

      packEaters(t, true);
      upload();
      if (running) raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      const should = onScreen && !hidden;
      if (should === running) return;
      running = should;
      if (should) raf = requestAnimationFrame(frame);
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const pushWake = (x: number, y: number) => {
      const now = performance.now();
      if (now - wakeAt < WAKE_MS && wakeCount > 0) {
        wakeX[0] = x;
        wakeY[0] = y;
        return;
      }
      wakeAt = now;
      for (let i = WAKE_LEN - 1; i > 0; i--) {
        wakeX[i] = wakeX[i - 1];
        wakeY[i] = wakeY[i - 1];
      }
      wakeX[0] = x;
      wakeY[0] = y;
      wakeCount = Math.min(WAKE_LEN, wakeCount + 1);
    };

    const onMove = (e: PointerEvent) => {
      pointerType = e.pointerType;
      const rect = wrap.getBoundingClientRect();
      pushWake(e.clientX - rect.left, e.clientY - rect.top);
    };
    const onLeave = () => {
      wakeCount = 0;
      if (pointerType === "touch") touchRelease = performance.now();
    };
    const onUp = () => {
      if (pointerType === "touch") {
        wakeCount = 0;
        touchRelease = performance.now();
      }
    };

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es.some((en) => en.isIntersecting);
        sync();
      },
      { rootMargin: "0px" },
    );
    io.observe(wrap);

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };

    const ro = new ResizeObserver(() => {
      measure();
      upload();
    });
    ro.observe(wrap);

    document.addEventListener("visibilitychange", onVis);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
    };
  }, [lines]);

  return (
    <div
      ref={wrapRef}
      className={cn("relative h-full w-full touch-none overflow-hidden", className)}
      style={{ background: PAPER, containerType: "inline-size" }}
    >
      {/* The type bed is the real content: DOM text, in reading order,
          selectable, in the accessibility tree. */}
      <div className="absolute inset-0 flex flex-col justify-center">
        {bed.map((l, i) => (
          <div
            key={i}
            // Every phrase is announced once, on its first appearance. The
            // repeats are texture — reading "CLEARING" six times aloud is not
            // the content, it is the composition.
            aria-hidden={i > 3 ? "true" : undefined}
            style={{
              color: VERMILION,
              fontFamily: BED_FONT,
              fontWeight: 900,
              fontStretch: "condensed",
              fontSize: `${STEPS[l.step]}cqw`,
              lineHeight: 0.84,
              letterSpacing: "-0.015em",
              marginLeft: `${l.shift}cqw`,
              whiteSpace: "nowrap",
            }}
          >
            {l.text}
          </div>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}
