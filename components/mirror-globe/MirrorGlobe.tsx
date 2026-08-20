"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type GlobePalette = "aurora" | "iridescent" | "chrome" | "obsidian";
export type StampMode = "hand" | "text";

export interface MirrorGlobeProps extends React.HTMLAttributes<HTMLDivElement> {
  palette?: GlobePalette | "custom";
  /** Four hex colors used when palette === "custom" */
  customColors?: string[];
  /** What is trapped inside the mirror */
  stampMode?: StampMode;
  /** Cursive text engraved when stampMode === "text" */
  stampText?: string;
  /** Image whose alpha channel is used as the handprint silhouette */
  handSrc?: string;
  /** Speed of the flowing gradient (0 = frozen) */
  flowSpeed?: number;
  /** Strength of the emboss relief */
  embossDepth?: number;
  /** Blur radius (px) of the heightfield — higher = softer stamp */
  embossSoftness?: number;
  /** Light direction in degrees */
  lightAngle?: number;
  /** Slowly orbit the light around the globe */
  autoOrbitLight?: boolean;
  /** How strongly the globe reacts to the cursor (0 = inert) */
  cursorResponse?: number;
  /** Fresnel rim glow intensity */
  rimIntensity?: number;
  /** Film grain amount */
  grain?: number;
  /** Scale of the stamp relative to the globe */
  handScale?: number;
  /** Rotation of the stamp in degrees */
  handRotation?: number;
  /** Globe radius as a fraction of the container's smaller half-dimension */
  globeSize?: number;
}

// Order: base (darkest, dominant) → mid → accent → highlight (rarest)
export const PALETTE_HEX: Record<GlobePalette, string[]> = {
  aurora: ["#081436", "#1E4DFF", "#00C8F5", "#8CFFD9"],
  iridescent: ["#170B2E", "#8A2BE2", "#FF3D8A", "#FFB86B"],
  chrome: ["#0A0E16", "#3A4A66", "#A9BDD6", "#F4F9FF"],
  obsidian: ["#060310", "#1E1145", "#5B2BD9", "#C084FF"],
};

function hexToRgb(hex: string): number[] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [1, 1, 1];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
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
uniform float uTimeAbs;
uniform sampler2D uHand;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
uniform vec3 uColD;
uniform float uDepth;
uniform float uLightAngle;
uniform float uRim;
uniform float uGrain;
uniform float uHandScale;
uniform float uHandRot;
uniform float uRadius;
uniform vec2 uMouse;
uniform float uHover;

// Simplex noise (Ashima Arts / Stefan Gustavson, MIT)
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Flowing mesh-gradient color field: low-frequency, domain-warped noise
// so colors sweep in silky bands instead of busy patches.
vec3 gradientField(vec2 q, float t) {
  vec2 w = vec2(
    snoise(q * 0.9 + vec2(0.0, t * 0.25)),
    snoise(q * 0.9 + vec2(5.2, -t * 0.2))
  );
  vec2 qq = q + w * 0.55;
  float n1 = snoise(qq * 0.8 + vec2(0.0, t * 0.3));
  float n2 = snoise(qq * 1.1 + vec2(3.7, t * 0.22));
  float n3 = snoise(qq * 0.6 - vec2(t * 0.18, 1.3));
  vec3 col = mix(uColA, uColB, smoothstep(-1.0, 1.0, n1));
  col = mix(col, uColC, smoothstep(-0.35, 1.1, n2) * 0.8);
  col = mix(col, uColD, smoothstep(0.25, 1.2, n3) * 0.55);
  return col;
}

float handHeight(vec2 p) {
  float c = cos(uHandRot);
  float s = sin(uHandRot);
  vec2 q = mat2(c, -s, s, c) * (p / uHandScale);
  vec2 uv = q * 0.5 + 0.5;
  return texture2D(uHand, uv).r;
}

void main() {
  float minDim = 0.5 * min(uRes.x, uRes.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / minDim;
  float t = uTime;

  float r = length(p) / uRadius;
  float aa = 2.5 / (minDim * uRadius);
  float mask = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);

  // Soft halo bleeding past the rim
  float halo = exp(-max(r - 1.0, 0.0) * 6.0) * 0.22 * step(1.0, r);

  // Sphere geometry
  vec2 sp = p / uRadius;
  float rr = clamp(length(sp), 0.0, 1.0);
  float nz = sqrt(max(1.0 - rr * rr, 0.0));
  vec3 N = normalize(vec3(sp, max(nz, 0.03)));

  // Cursor proximity (uMouse is in globe space)
  float md = length(sp - uMouse);
  float prox = exp(-md * md * 6.0) * uHover;

  // Gradient warped by sphere curvature, gently lensed toward the cursor
  vec2 g = sp * (1.0 + 0.4 * (1.0 - nz));
  g += (uMouse - sp) * prox * 0.18;
  vec3 base = gradientField(g, t);

  // Heightfield -> emboss normal perturbation (stamped INTO the surface).
  // The stamp presses deeper near the cursor, reaching toward the touch.
  float depth = uDepth * (1.0 + prox * 1.4) * 3.0;
  float e = 3.0 / 512.0;
  float h = handHeight(sp);
  float hx = handHeight(sp + vec2(e, 0.0)) - handHeight(sp - vec2(e, 0.0));
  float hy = handHeight(sp + vec2(0.0, e)) - handHeight(sp - vec2(0.0, e));
  vec3 Nh = normalize(N + vec3(hx, hy, 0.0) * depth);

  // Ripple rings spreading from the touch point, like disturbed mercury
  float ripple = sin(md * 42.0 - uTimeAbs * 5.0) * exp(-md * 5.5) * uHover;
  vec2 rdir = md > 0.001 ? (sp - uMouse) / md : vec2(0.0);
  Nh = normalize(Nh + vec3(rdir * ripple * 0.1, 0.0));

  // Lighting: the key light bends toward the cursor like a handheld torch
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 Lbase = normalize(vec3(cos(uLightAngle), sin(uLightAngle), 0.75));
  vec3 Lmouse = normalize(vec3(uMouse - sp, 0.55));
  vec3 L = normalize(mix(Lbase, Lmouse, clamp(uHover, 0.0, 1.0) * 0.6));
  float diff = max(dot(Nh, L), 0.0);
  vec3 R = reflect(-L, Nh);
  float spec = pow(max(dot(R, V), 0.0), 48.0);

  // Fake environment reflection sampled through the perturbed normal
  vec3 refl = gradientField(Nh.xy * 1.8 - vec2(t * 0.1, 0.0), t * 0.7 + 4.0);

  vec3 col = base;
  // The stamp sits a shade darker, like a shadow sealed under glass
  col = mix(col, col * 0.5, smoothstep(0.15, 0.7, h) * 0.6);
  col *= 0.55 + 0.6 * diff;
  col += refl * 0.16 * (0.35 + 0.65 * pow(1.0 - nz, 1.5));
  col += spec * 0.75;

  // A faint warm breath where the cursor touches the glass
  col += mix(uColC, vec3(1.0), 0.4) * prox * 0.12;

  // Fresnel rim
  float fres = pow(1.0 - nz, 3.0);
  col += fres * uRim * mix(uColC, vec3(1.0), 0.5);

  // Depth vignette toward the edge of the sphere
  col *= 0.82 + 0.18 * nz;

  float gn = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (gn - 0.5) * uGrain;

  vec3 haloCol = mix(uColB, uColC, 0.5);
  vec3 outCol = col * mask + haloCol * halo;
  float alpha = clamp(mask + halo, 0.0, 1.0);
  gl_FragColor = vec4(outCol, alpha);
}
`;

/** Draws a capsule (stadium) extending upward from (x, y), rotated by angleDeg (clockwise). */
function capsule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  w: number,
  angleDeg: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  const hw = w / 2;
  ctx.beginPath();
  ctx.moveTo(-hw, 0);
  ctx.lineTo(-hw, -len);
  ctx.arc(0, -len, hw, Math.PI, 0);
  ctx.lineTo(hw, 0);
  ctx.arc(0, 0, hw, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Blurs a sharp silhouette canvas into a smooth black/white heightfield. */
function blurToHeightfield(sharp: HTMLCanvasElement, blurPx: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = sharp.width;
  out.height = sharp.height;
  const octx = out.getContext("2d")!;
  octx.fillStyle = "#000";
  octx.fillRect(0, 0, out.width, out.height);
  octx.filter = `blur(${blurPx}px)`;
  octx.drawImage(sharp, 0, 0);
  octx.filter = "none";
  return out;
}

/** Fallback: procedural open-palm silhouette. */
function buildProceduralHand(blurPx: number): HTMLCanvasElement {
  const size = 512;
  const sharp = document.createElement("canvas");
  sharp.width = size;
  sharp.height = size;
  const ctx = sharp.getContext("2d")!;
  ctx.fillStyle = "#fff";

  // Palm
  ctx.beginPath();
  ctx.ellipse(256, 302, 80, 92, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fingers (index → pinky)
  capsule(ctx, 200, 248, 148, 40, -7);
  capsule(ctx, 243, 238, 172, 42, -1.5);
  capsule(ctx, 285, 243, 155, 40, 4);
  capsule(ctx, 322, 260, 115, 34, 10);

  // Thumb
  capsule(ctx, 185, 338, 132, 46, -58);

  return blurToHeightfield(sharp, blurPx);
}

/**
 * Builds the heightfield from an image's alpha channel (e.g. a handprint SVG).
 * The alpha gradient carries the natural "pressure" of the print into the emboss.
 * Returns raw pixels (never a canvas): reading them out via getImageData is the
 * reliable way to detect a canvas tainted by SVG drawing — some engines throw
 * on tainted sources, and an exception inside the render loop would kill it.
 */
function buildImageHand(img: HTMLImageElement, blurPx: number): ImageData | null {
  const size = 512;
  const margin = 64 + blurPx;
  const sharp = document.createElement("canvas");
  sharp.width = size;
  sharp.height = size;
  const ctx = sharp.getContext("2d")!;

  const avail = size - margin * 2;
  const scale = Math.min(avail / img.naturalWidth, avail / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  // Keep only the alpha channel as white intensity
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";

  const blurred = blurToHeightfield(sharp, blurPx);
  try {
    return blurred.getContext("2d")!.getImageData(0, 0, size, size);
  } catch {
    return null;
  }
}

const SCRIPT_FONTS =
  '"Snell Roundhand", "Savoye LET", "Apple Chancery", "Segoe Script", "Brush Script MT", cursive';

/** Renders cursive text — the macOS "hello" engraving — into a heightfield. */
function buildTextStamp(text: string, blurPx: number): HTMLCanvasElement {
  const size = 512;
  const sharp = document.createElement("canvas");
  sharp.width = size;
  sharp.height = size;
  const ctx = sharp.getContext("2d")!;

  const label = text.trim() || "hello";
  const maxW = size - 2 * (48 + blurPx);
  let fontSize = 170;
  ctx.font = `${fontSize}px ${SCRIPT_FONTS}`;
  const measured = ctx.measureText(label).width;
  if (measured > maxW) {
    fontSize = Math.max(28, (fontSize * maxW) / measured);
  }
  ctx.font = `${fontSize}px ${SCRIPT_FONTS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(2, fontSize * 0.035);
  ctx.lineJoin = "round";
  ctx.fillText(label, size / 2, size / 2);
  ctx.strokeText(label, size / 2, size / 2);

  return blurToHeightfield(sharp, blurPx);
}

const handImageCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadHandImage(src: string): Promise<HTMLImageElement | null> {
  let promise = handImageCache.get(src);
  if (!promise) {
    promise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    handImageCache.set(src, promise);
  }
  return promise;
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("MirrorGlobe shader error:", gl.getShaderInfoLog(shader));
  }
  return shader;
}

export default function MirrorGlobe({
  className,
  palette = "aurora",
  customColors,
  stampMode = "hand",
  stampText = "hello",
  handSrc = "/bluey.svg",
  flowSpeed = 0.6,
  embossDepth = 3,
  embossSoftness = 10,
  lightAngle = 125,
  autoOrbitLight = false,
  cursorResponse = 1.0,
  rimIntensity = 0.6,
  grain = 0.05,
  handScale = 1.0,
  handRotation = 0,
  globeSize = 0.72,
  ...props
}: MirrorGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Heightfield staged by effects; uploaded immediately when GL is live and
  // also picked up by the render loop as a fallback (robust across React
  // StrictMode double-mounts and throttled rAF)
  const pendingHeightfieldRef = useRef<HTMLCanvasElement | ImageData | null>(null);
  const uploadNowRef = useRef<(() => void) | null>(null);

  // Live prop values readable from the render loop without re-creating GL
  const live = useRef({
    palette,
    customColors,
    flowSpeed,
    embossDepth,
    lightAngle,
    autoOrbitLight,
    cursorResponse,
    rimIntensity,
    grain,
    handScale,
    handRotation,
    globeSize,
  });
  live.current = {
    palette,
    customColors,
    flowSpeed,
    embossDepth,
    lightAngle,
    autoOrbitLight,
    cursorResponse,
    rimIntensity,
    grain,
    handScale,
    handRotation,
    globeSize,
  };

  // Build/rebuild the stamp heightfield; the loop picks it up on the next frame
  useEffect(() => {
    let cancelled = false;
    const stage = (heightfield: HTMLCanvasElement | ImageData) => {
      pendingHeightfieldRef.current = heightfield;
      uploadNowRef.current?.();
    };
    if (stampMode === "text") {
      // Rasterize immediately, then again once script fonts are ready
      const build = () => {
        if (!cancelled) stage(buildTextStamp(stampText, embossSoftness));
      };
      build();
      document.fonts?.ready?.then(build);
    } else {
      stage(buildProceduralHand(embossSoftness));
      loadHandImage(handSrc).then((img) => {
        if (cancelled || !img) return;
        const heightfield = buildImageHand(img, embossSoftness);
        if (heightfield) stage(heightfield);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [embossSoftness, handSrc, stampMode, stampText]);

  // One-time WebGL setup + render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
    });
    if (!gl) return;

    const program = gl.createProgram()!;
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
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

    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Placeholder until the first heightfield is staged
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    );

    const u = {
      res: gl.getUniformLocation(program, "uRes"),
      time: gl.getUniformLocation(program, "uTime"),
      timeAbs: gl.getUniformLocation(program, "uTimeAbs"),
      hand: gl.getUniformLocation(program, "uHand"),
      colA: gl.getUniformLocation(program, "uColA"),
      colB: gl.getUniformLocation(program, "uColB"),
      colC: gl.getUniformLocation(program, "uColC"),
      colD: gl.getUniformLocation(program, "uColD"),
      depth: gl.getUniformLocation(program, "uDepth"),
      lightAngle: gl.getUniformLocation(program, "uLightAngle"),
      rim: gl.getUniformLocation(program, "uRim"),
      grain: gl.getUniformLocation(program, "uGrain"),
      handScale: gl.getUniformLocation(program, "uHandScale"),
      handRot: gl.getUniformLocation(program, "uHandRot"),
      radius: gl.getUniformLocation(program, "uRadius"),
      mouse: gl.getUniformLocation(program, "uMouse"),
      hover: gl.getUniformLocation(program, "uHover"),
    };
    gl.uniform1i(u.hand, 0);

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

    const uploadPending = () => {
      const pending = pendingHeightfieldRef.current;
      if (!pending) return;
      pendingHeightfieldRef.current = null;
      try {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pending);
      } catch (err) {
        // Never let a texture upload take down the render loop
        console.warn("MirrorGlobe: heightfield upload failed", err);
      }
    };
    uploadNowRef.current = uploadPending;
    uploadPending();

    // Cursor tracking in globe space
    const mouseTarget = { x: 0, y: 0 };
    const mouse = { x: 0, y: 0 };
    let hoverTarget = 0;
    let hover = 0;

    const toGlobeSpace = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const minDim = 0.5 * Math.min(rect.width, rect.height);
      const x = (clientX - rect.left - rect.width / 2) / minDim;
      const y = -(clientY - rect.top - rect.height / 2) / minDim;
      const size = live.current.globeSize;
      return { x: x / size, y: y / size };
    };

    const onPointerMove = (ev: PointerEvent) => {
      const g = toGlobeSpace(ev.clientX, ev.clientY);
      mouseTarget.x = g.x;
      mouseTarget.y = g.y;
      // Only "touching the mirror" counts — fade out beyond the rim
      const d = Math.hypot(g.x, g.y);
      hoverTarget = Math.max(0, 1 - Math.max(0, d - 1) * 2.5);
    };
    const onPointerLeave = () => {
      hoverTarget = 0;
    };
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);

    let raf = 0;
    let flowT = 0;
    let absT = 0;
    let orbitT = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const s = live.current;
      flowT += dt * s.flowSpeed;
      absT += dt;
      if (s.autoOrbitLight) orbitT += dt * 0.35;

      // Ease the cursor state — the mirror answers slightly behind the hand
      const ease = 1 - Math.exp(-dt * 7);
      mouse.x += (mouseTarget.x - mouse.x) * ease;
      mouse.y += (mouseTarget.y - mouse.y) * ease;
      hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 4));

      // Pick up a freshly staged heightfield, if any
      uploadPending();

      const hexes =
        s.palette === "custom" && s.customColors && s.customColors.length >= 4
          ? s.customColors
          : PALETTE_HEX[s.palette === "custom" ? "aurora" : s.palette];
      const [a, b, c, d] = hexes.map(hexToRgb);

      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, flowT);
      gl.uniform1f(u.timeAbs, absT);
      gl.uniform3f(u.colA, a[0], a[1], a[2]);
      gl.uniform3f(u.colB, b[0], b[1], b[2]);
      gl.uniform3f(u.colC, c[0], c[1], c[2]);
      gl.uniform3f(u.colD, d[0], d[1], d[2]);
      gl.uniform1f(u.depth, s.embossDepth);
      gl.uniform1f(u.lightAngle, (s.lightAngle * Math.PI) / 180 + orbitT);
      gl.uniform1f(u.rim, s.rimIntensity);
      gl.uniform1f(u.grain, s.grain);
      gl.uniform1f(u.handScale, s.handScale);
      gl.uniform1f(u.handRot, (s.handRotation * Math.PI) / 180);
      gl.uniform1f(u.radius, s.globeSize);
      gl.uniform2f(u.mouse, mouse.x, mouse.y);
      gl.uniform1f(u.hover, hover * s.cursorResponse);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      uploadNowRef.current = null;
      ro.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)} {...props}>
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
