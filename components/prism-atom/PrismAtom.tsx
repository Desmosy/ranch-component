"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface PrismAtomProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of electron orbit rings (1–4) */
  rings?: number;
  /** Electron travel speed */
  orbitSpeed?: number;
  /** Slow rotation of the whole orbital system */
  precession?: number;
  /** Ellipse width — how flat each orbit reads (0.15 thin – 0.6 round) */
  ringWidth?: number;
  /** Chromatic aberration / prismatic fringing */
  aberration?: number;
  /** Overall glow energy */
  glow?: number;
  /** Nucleus intensity */
  nucleus?: number;
  /** Horizontal lens-flare streak */
  flare?: number;
  /** Global hue rotation (degrees) */
  hueShift?: number;
  /** Scale multiplier of orbital system (0.2 small - 1.0 full) */
  scale?: number;
}

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uRings;
uniform float uOrbitSpeed;
uniform float uPrecess;
uniform float uRingWidth;
uniform float uCA;
uniform float uGlow;
uniform float uNucleus;
uniform float uFlare;
uniform float uHue;
uniform float uScale;

#define PI 3.14159265359

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

float ellipseDist(vec2 p, float a, float b) {
  float k = length(p / vec2(a, b));
  return (k - 1.0) * min(a, b);
}

float ringGlow(float d) {
  float core = exp(-abs(d) * 65.0);
  float halo = exp(-abs(d) * 14.0) * 0.42;
  float wide = exp(-abs(d) * 4.5) * 0.16;
  return core + halo + wide;
}

void main() {
  float minDim = 0.5 * min(uRes.x, uRes.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / minDim;
  float t = uTime;
  float hue0 = uHue / 360.0;

  vec3 col = vec3(0.0);

  float sc = max(0.05, uScale);
  float a = 0.82 * sc;
  float b = uRingWidth * sc;
  float nRings = clamp(uRings, 1.0, 4.0);
  float pre = t * uPrecess;

  for (int i = 0; i < 4; i++) {
    if (float(i) >= nRings) break;
    float fi = float(i);
    float ang = fi * PI / nRings + pre;
    vec2 q = rot(ang) * p;

    float phi = atan(q.y / max(b, 0.001), q.x / max(a, 0.001));
    float ringHue = hue0 + fi / max(nRings, 1.0) + 0.09 * sin(phi + t * 0.4) + t * 0.03;

    float dR = ellipseDist(q, a * (1.0 - uCA), b * (1.0 - uCA * 1.6));
    float dG = ellipseDist(q, a, b);
    float dB = ellipseDist(q, a * (1.0 + uCA), b * (1.0 + uCA * 1.6));

    float depth = 0.72 + 0.28 * sin(phi + fi * 1.7);

    vec3 cR = hsv2rgb(vec3(ringHue - 0.06, 0.95, 1.0));
    vec3 cG = hsv2rgb(vec3(ringHue, 0.85, 1.0));
    vec3 cB = hsv2rgb(vec3(ringHue + 0.06, 0.95, 1.0));
    col.r += ringGlow(dR / sc) * cR.r * uGlow * depth;
    col.g += ringGlow(dG / sc) * cG.g * uGlow * depth;
    col.b += ringGlow(dB / sc) * cB.b * uGlow * depth;

    float th = t * uOrbitSpeed * (0.7 + fi * 0.23) + fi * 2.4;
    vec2 e = vec2(a * cos(th), b * sin(th));
    float de = length(q - e);
    col += (vec3(1.0) * 0.7 + cG * 0.5) * exp(-de * de * (2200.0 / (sc * sc))) * 2.2 * uGlow;
    float trail = mod(th - phi, 2.0 * PI);
    col += cG * exp(-trail * 2.2) * exp(-abs(dG / sc) * 70.0) * 1.1 * uGlow;
  }

  {
    float rr = dot(p, p) / (sc * sc);
    for (int j = 0; j < 4; j++) {
      float fj = float(j);
      vec2 off = 0.055 * sc * vec2(cos(t * 0.8 + fj * 2.4), sin(t * 1.1 + fj * 1.8));
      float d2 = dot(p - off, p - off) / (sc * sc);
      vec3 blobCol = hsv2rgb(vec3(fj * 0.21 + hue0 + t * 0.02, 0.85, 1.0));
      col += blobCol * 0.0016 / (d2 + 0.0006) * uNucleus;
    }
    float pulse = 0.85 + 0.15 * sin(t * 1.4);
    col += vec3(1.0, 0.98, 0.92) * 0.006 / (rr + 0.0014) * uNucleus * pulse;
    vec2 ps = rot(PI * 0.25) * p;
    float spike = exp(-abs(p.x / sc) * 26.0 - abs(p.y / sc) * 200.0)
                + exp(-abs(p.y / sc) * 26.0 - abs(p.x / sc) * 200.0)
                + 0.6 * exp(-abs(ps.x / sc) * 34.0 - abs(ps.y / sc) * 240.0)
                + 0.6 * exp(-abs(ps.y / sc) * 34.0 - abs(ps.x / sc) * 240.0);
    col += vec3(1.0, 0.95, 0.85) * spike * 0.55 * uNucleus * pulse;
  }

  {
    float streak = exp(-abs(p.y / sc) * 90.0) * exp(-abs(p.x / sc) * 1.1);
    vec3 streakCol = mix(vec3(1.0, 0.45, 0.25), vec3(1.0, 0.9, 0.7), exp(-abs(p.x / sc) * 3.0));
    col += streakCol * streak * uFlare;
    col += vec3(0.6, 0.8, 1.0) * exp(-abs(p.x / sc) * 110.0) * exp(-abs(p.y / sc) * 4.5) * uFlare * 0.3;
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export default function PrismAtom({
  rings = 3,
  orbitSpeed = 0.9,
  precession = 0.06,
  ringWidth = 0.3,
  aberration = 0.012,
  glow = 1,
  nucleus = 1,
  flare = 0.55,
  hueShift = 0,
  scale = 1.0,
  className,
  ...props
}: PrismAtomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const live = useRef({
    rings,
    orbitSpeed,
    precession,
    ringWidth,
    aberration,
    glow,
    nucleus,
    flare,
    hueShift,
    scale,
  });

  useEffect(() => {
    live.current = {
      rings,
      orbitSpeed,
      precession,
      ringWidth,
      aberration,
      glow,
      nucleus,
      flare,
      hueShift,
      scale,
    };
  }, [rings, orbitSpeed, precession, ringWidth, aberration, glow, nucleus, flare, hueShift, scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) return;

    const compileShader = (src: string, type: number) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(VERT, gl.VERTEX_SHADER);
    const fs = compileShader(FRAG, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(program, "uRes"),
      time: gl.getUniformLocation(program, "uTime"),
      rings: gl.getUniformLocation(program, "uRings"),
      orbitSpeed: gl.getUniformLocation(program, "uOrbitSpeed"),
      precess: gl.getUniformLocation(program, "uPrecess"),
      ringWidth: gl.getUniformLocation(program, "uRingWidth"),
      ca: gl.getUniformLocation(program, "uCA"),
      glow: gl.getUniformLocation(program, "uGlow"),
      nucleus: gl.getUniformLocation(program, "uNucleus"),
      flare: gl.getUniformLocation(program, "uFlare"),
      hue: gl.getUniformLocation(program, "uHue"),
      scale: gl.getUniformLocation(program, "uScale"),
    };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf = 0;
    let last = performance.now();
    let t = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      t += dt;
      const s = live.current;

      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, t);
      gl.uniform1f(u.rings, s.rings);
      gl.uniform1f(u.orbitSpeed, s.orbitSpeed);
      gl.uniform1f(u.precess, s.precession);
      gl.uniform1f(u.ringWidth, s.ringWidth);
      gl.uniform1f(u.ca, s.aberration);
      gl.uniform1f(u.glow, s.glow);
      gl.uniform1f(u.nucleus, s.nucleus);
      gl.uniform1f(u.flare, s.flare);
      gl.uniform1f(u.hue, s.hueShift);
      gl.uniform1f(u.scale, s.scale);

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)} {...props}>
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
