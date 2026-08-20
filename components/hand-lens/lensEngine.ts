import { BONES, Hand, HandTracker } from "./handTracker";
import { GestureReading, LensState, readGestures } from "./gestures";
import { INKS, InkSpec, SealInk } from "./inks";

export type LensEffect = "bands" | "mosh" | "psych" | "slice" | "thermal";

export const LENS_EFFECTS: { key: LensEffect; label: string; fx: number }[] = [
  { key: "bands", label: "Bands", fx: 0 },
  { key: "mosh", label: "Datamosh", fx: 1 },
  { key: "psych", label: "Psychedelic", fx: 2 },
  { key: "slice", label: "Slice", fx: 3 },
  { key: "thermal", label: "Thermal", fx: 4 },
];

export interface HandLensParams {
  ink: SealInk;
  lensEffect: LensEffect;
  showSkeleton: boolean;
  showWindows: boolean;
  demo: boolean;
  compact: boolean;
}

export const DEFAULT_LENS_PARAMS: HandLensParams = {
  ink: "sumi",
  lensEffect: "mosh",
  showSkeleton: true,
  showWindows: true,
  demo: false,
  compact: false,
};

const MAX_WINDOWS = 12;
const FINGER_EFFECTS = [0, 1, 2, 3, 4];

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const SRC_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;

uniform sampler2D uVideo;
uniform vec2 uScale;
uniform float uHasVideo;
uniform float uTime;

vec3 standIn(vec2 uv) {
  float v = 0.5
    + 0.24 * sin(uv.x * 9.0 + uTime * 0.5)
    + 0.20 * sin(uv.y * 7.0 - uTime * 0.37 + sin(uv.x * 5.0 + uTime * 0.2) * 1.6)
    + 0.12 * sin((uv.x + uv.y) * 13.0 - uTime * 0.6);
  return vec3(clamp(v, 0.0, 1.0));
}

void main() {
  if (uHasVideo < 0.5) {
    frag = vec4(standIn(vUv), 1.0);
    return;
  }
  vec2 uv = (vUv - 0.5) * uScale + 0.5;
  uv.x = 1.0 - uv.x;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    frag = vec4(0.86, 0.86, 0.86, 1.0);
    return;
  }
  frag = vec4(texture(uVideo, uv).rgb, 1.0);
}`;

const MOSH_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;

uniform sampler2D uSrc;
uniform sampler2D uPrev;
uniform vec2 uFlow;
uniform float uMosh;
uniform float uHasPrev;
uniform vec2 uBlocks;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 cell = floor(vUv * uBlocks);
  float j = hash(cell);
  float k = hash(cell + 17.3);

  vec2 disp = uFlow * (0.006 + 0.020 * j) * uMosh;
  vec3 prev = texture(uPrev, clamp(vUv - disp, 0.0, 1.0)).rgb;
  vec3 cur = texture(uSrc, vUv).rgb;

  float keep = uHasPrev * uMosh * (0.80 + 0.18 * k);
  frag = vec4(mix(cur, prev, keep), 1.0);
}`;

const PRINT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;

uniform sampler2D uSrc;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uAccent;
uniform float uAdditive;
uniform float uDotPitch;
uniform float uGrain;
uniform sampler2D uMoshTex;
uniform vec4 uWindows[12];
uniform float uWindowFx[12];
uniform int uWindowCount;
uniform float uLensFx;
uniform vec4 uLenses[2];
uniform int uLensCount;
uniform float uWarp;

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

float dots(float v, vec2 px, float angle, float pitch) {
  vec2 q = rot(angle) * px / max(pitch, 1.0);
  float d = length(fract(q) - 0.5) * 2.0;
  float r = sqrt(clamp(v, 0.0, 1.0)) * 1.05;
  float aa = fwidth(d) * 1.2 + 0.002;
  return smoothstep(r + aa, r - aa, d);
}

vec3 layInkV(vec3 base, vec3 ink, vec3 amt) {
  vec3 a = clamp(amt, 0.0, 1.0);
  vec3 sub = base * (vec3(1.0) - a * (vec3(1.0) - ink));
  vec3 add = base + (ink - base) * a;
  return mix(sub, add, uAdditive);
}

vec3 layInk(vec3 base, vec3 ink, float amt) {
  return layInkV(base, ink, vec3(amt));
}

vec3 falseColor(float v) {
  v = clamp(v, 0.0, 1.0);
  vec3 c0 = vec3(0.80, 0.91, 0.64);
  vec3 c1 = vec3(0.36, 0.83, 0.52);
  vec3 c2 = vec3(0.09, 0.62, 0.82);
  vec3 c3 = vec3(0.13, 0.24, 0.63);
  vec3 c4 = vec3(0.88, 0.21, 0.56);
  if (v < 0.25) return mix(c0, c1, v / 0.25);
  if (v < 0.5) return mix(c1, c2, (v - 0.25) / 0.25);
  if (v < 0.75) return mix(c2, c3, (v - 0.5) / 0.25);
  return mix(c3, c4, (v - 0.75) / 0.25);
}

vec3 banded(vec2 uv) {
  float v = clamp(1.0 - luma(texture(uSrc, clamp(uv, 0.0, 1.0)).rgb), 0.0, 1.0);
  float steps = 6.0;
  vec3 c = falseColor(floor(v * steps) / steps);
  float lvl = v * steps;
  float f = fract(lvl);
  float contour = 1.0 - smoothstep(0.0, fwidth(lvl) * 1.5 + 0.001, min(f, 1.0 - f));
  return mix(c, vec3(0.04, 0.09, 0.28), contour * 0.7);
}

vec3 moshColor(vec2 uv) {
  vec2 blocks = vec2(90.0, 52.0);
  vec2 cell = floor(uv * blocks);
  float j = hash(cell);
  vec2 off = vec2(0.004 + 0.006 * j, 0.0);
  vec3 c = vec3(
    texture(uMoshTex, clamp(uv + off, 0.0, 1.0)).r,
    texture(uMoshTex, clamp(uv, 0.0, 1.0)).g,
    texture(uMoshTex, clamp(uv - off, 0.0, 1.0)).b
  );
  return floor(c * 7.0) / 7.0;
}

vec3 psychColor(vec2 uv) {
  vec2 rippled = uv + vec2(
    sin(uv.y * 26.0 + uTime * 1.6) * 0.006,
    cos(uv.x * 22.0 - uTime * 1.3) * 0.006
  );
  float l = luma(texture(uSrc, clamp(rippled, 0.0, 1.0)).rgb);
  float a = l * 18.0 + uTime * 1.7 + length(uv - 0.5) * 9.0;
  vec3 c = 0.5 + 0.5 * cos(vec3(a, a + 2.094, a + 4.188));
  return floor(c * 6.0) / 6.0;
}

vec3 sliceColor(vec2 uv) {
  vec2 grid = max(floor(uRes / 18.0), vec2(6.0));
  vec2 cell = floor(uv * grid);
  vec2 inCell = fract(uv * grid);

  float beat = floor(uTime * 4.0);

  float moves = step(0.45, hash(vec2(cell.x * 1.7, cell.y * 2.3 + beat)));
  float jump = floor((hash(vec2(cell.x + 3.1, cell.y + beat * 1.3)) * 2.0 - 1.0) * 7.0) * moves;
  float srcX = mod(cell.x + jump, grid.x);

  vec2 srcUv = (vec2(srcX, cell.y) + inCell) / grid;
  vec3 c = texture(uSrc, clamp(srcUv, 0.0, 1.0)).rgb;
  return floor(c * 5.0) / 5.0;
}

vec3 thermalColor(vec2 uv) {
  float v = clamp(1.0 - luma(texture(uSrc, clamp(uv, 0.0, 1.0)).rgb), 0.0, 1.0);
  v = floor(v * 7.0) / 7.0;
  vec3 c0 = vec3(0.02, 0.02, 0.10);
  vec3 c1 = vec3(0.18, 0.05, 0.55);
  vec3 c2 = vec3(0.85, 0.14, 0.20);
  vec3 c3 = vec3(0.99, 0.72, 0.10);
  vec3 c4 = vec3(1.0, 1.0, 0.92);
  if (v < 0.25) return mix(c0, c1, v / 0.25);
  if (v < 0.5) return mix(c1, c2, (v - 0.25) / 0.25);
  if (v < 0.75) return mix(c2, c3, (v - 0.5) / 0.25);
  return mix(c3, c4, (v - 0.75) / 0.25);
}

vec3 effectColor(float fx, vec2 uv) {
  if (fx < 0.5) return banded(uv);
  if (fx < 1.5) return moshColor(uv);
  if (fx < 2.5) return psychColor(uv);
  if (fx < 3.5) return sliceColor(uv);
  return thermalColor(uv);
}

float plate(vec2 uv, vec2 px) {
  float l = luma(texture(uSrc, clamp(uv, 0.0, 1.0)).rgb);
  return dots(smoothstep(0.2, 0.9, 1.0 - l), px, 0.4363, uDotPitch);
}

void main() {
  vec2 px = gl_FragCoord.xy;

  vec2 suv = vUv;
  for (int i = 0; i < 2; i++) {
    if (i >= uLensCount) break;
    vec4 L = uLenses[i];
    vec2 rel = px - L.xy;
    float d = length(rel) / max(L.z, 1.0);
    float pull = exp(-d * d * 1.6) * L.w * uWarp;
    suv -= (rel / max(length(rel), 1.0)) * pull * 0.045;
  }

  vec3 col = layInk(uPaper, uInk, plate(suv, px) * 0.95);

  for (int i = 0; i < 12; i++) {
    if (i >= uWindowCount) break;
    vec4 b = uWindows[i];
    vec2 wd = abs(px - b.xy) - vec2(b.z);
    float sd = max(wd.x, wd.y);
    float inside = (1.0 - smoothstep(0.0, 1.5, sd)) * b.w;
    if (inside > 0.001) col = mix(col, effectColor(uWindowFx[i], suv), inside * 0.92);
  }

  for (int i = 0; i < 2; i++) {
    if (i >= uLensCount) break;
    vec4 L = uLenses[i];
    float d = length(px - L.xy);
    float inside = 1.0 - smoothstep(L.z - 1.5, L.z, d);
    if (inside > 0.001) {
      vec2 centreUv = L.xy / uRes;
      vec2 zoomed = centreUv + (suv - centreUv) * mix(1.0, 0.45, L.w);
      col = mix(col, effectColor(uLensFx, zoomed), inside * L.w * 0.95);
    }
    float rim = 1.0 - smoothstep(0.0, 1.5 + fwidth(d), abs(d - L.z));
    col = layInk(col, uAccent, rim * L.w);
  }

  float g = hash(floor(px) + floor(uTime * 24.0));
  col *= 1.0 - uGrain * g;

  frag = vec4(col, 1.0);
}`;

interface Target {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  width: number;
  height: number;
}

export class HandLensEngine {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private overlay: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private params: HandLensParams;

  private programs: Record<string, WebGLProgram> = {};
  private moshTargets: [Target, Target] | null = null;
  private moshIndex = 0;
  private hasMoshPrev = false;
  private uniformCache = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private quad: WebGLBuffer | null = null;
  private srcTarget: Target | null = null;
  private videoTex: WebGLTexture | null = null;
  private blankTex: WebGLTexture | null = null;
  private video: HTMLVideoElement | null = null;

  private tracker: HandTracker;
  private hands: Hand[] = [];
  private reading: GestureReading | null = null;
  readonly state = new LensState();

  private windowData = new Float32Array(MAX_WINDOWS * 4);
  private windowFx = new Float32Array(MAX_WINDOWS);
  private lensData = new Float32Array(2 * 4);

  private raf = 0;
  private running = false;
  private visible = true;
  private time = 0;
  private demoTime = 0;
  private lastTs = 0;
  private dpr = 1;
  private width = 1;
  private height = 1;

  private ro: ResizeObserver | null = null;
  private onVisibility = () => {
    this.visible = !document.hidden;
  };

  constructor(
    canvas: HTMLCanvasElement,
    overlay: HTMLCanvasElement,
    params: HandLensParams,
    tracker: HandTracker
  ) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.params = { ...params };
    this.tracker = tracker;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) throw new Error("WebGL2 is required for Hand Lens.");
    this.gl = gl;
    this.ctx = overlay.getContext("2d");

    this.programs.src = this.link(SRC_FRAG);
    this.programs.mosh = this.link(MOSH_FRAG);
    this.programs.print = this.link(PRINT_FRAG);
    this.buildQuad();
    this.blankTex = this.makeBlankTexture();
    this.resize();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private compile(src: string, type: number) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Could not create shader.");
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Hand Lens shader failed to compile: ${log}`);
    }
    return shader;
  }

  private link(fragSrc: string) {
    const gl = this.gl;
    const vs = this.compile(VERT, gl.VERTEX_SHADER);
    const fs = this.compile(fragSrc, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error("Could not create program.");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, "aPos");
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Hand Lens program failed to link: ${gl.getProgramInfoLog(program)}`);
    }
    return program;
  }

  private buildQuad() {
    const gl = this.gl;
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  private makeBlankTexture() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255])
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  private uniform(program: WebGLProgram, name: string) {
    let map = this.uniformCache.get(program);
    if (!map) {
      map = new Map();
      this.uniformCache.set(program, map);
    }
    if (!map.has(name)) map.set(name, this.gl.getUniformLocation(program, name));
    return map.get(name) ?? null;
  }

  private makeTarget(width: number, height: number): Target {
    const gl = this.gl;
    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) throw new Error("Could not allocate render target.");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex, width, height };
  }

  private resize() {
    const host = this.canvas.parentElement ?? this.canvas;
    const cssW = Math.max(1, host.clientWidth || 640);
    const cssH = Math.max(1, host.clientHeight || 360);
    const dpr = Math.min(window.devicePixelRatio || 1, this.params.compact ? 1.25 : 1.75);
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (w === this.width && h === this.height && dpr === this.dpr && this.srcTarget) return;

    this.dpr = dpr;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.overlay.width = w;
    this.overlay.height = h;
    this.overlay.style.width = `${cssW}px`;
    this.overlay.style.height = `${cssH}px`;

    if (this.srcTarget) {
      this.gl.deleteTexture(this.srcTarget.tex);
      this.gl.deleteFramebuffer(this.srcTarget.fbo);
    }
    const tw = Math.max(2, Math.round(w / 2));
    const th = Math.max(2, Math.round(h / 2));
    this.srcTarget = this.makeTarget(tw, th);

    if (this.moshTargets) {
      for (const target of this.moshTargets) {
        this.gl.deleteTexture(target.tex);
        this.gl.deleteFramebuffer(target.fbo);
      }
    }
    this.moshTargets = [this.makeTarget(tw, th), this.makeTarget(tw, th)];
    this.hasMoshPrev = false;
  }

  private renderMosh() {
    const gl = this.gl;
    if (!this.srcTarget || !this.moshTargets) return;
    const read = this.moshTargets[this.moshIndex];
    const write = this.moshTargets[1 - this.moshIndex];

    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, write.width, write.height);
    const program = this.programs.mosh;
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTarget.tex);
    gl.uniform1i(this.uniform(program, "uSrc"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, read.tex);
    gl.uniform1i(this.uniform(program, "uPrev"), 1);
    gl.uniform2f(this.uniform(program, "uFlow"), this.state.flow.x, -this.state.flow.y);
    gl.uniform1f(this.uniform(program, "uMosh"), this.state.mosh);
    gl.uniform1f(this.uniform(program, "uHasPrev"), this.hasMoshPrev ? 1 : 0);
    gl.uniform2f(this.uniform(program, "uBlocks"), 64, 36);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this.moshIndex = 1 - this.moshIndex;
    this.hasMoshPrev = true;
  }

  private renderSource() {
    const gl = this.gl;
    const target = this.srcTarget;
    if (!target) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.width, target.height);

    const program = this.programs.src;
    gl.useProgram(program);
    const live = !!this.video && this.video.readyState >= 2 && this.video.videoWidth > 0;

    gl.activeTexture(gl.TEXTURE0);
    if (live && this.video) {
      if (!this.videoTex) {
        this.videoTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.videoTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.videoTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

      const videoAspect = this.video.videoWidth / this.video.videoHeight;
      const targetAspect = target.width / target.height;
      const scale =
        videoAspect > targetAspect
          ? [targetAspect / videoAspect, 1]
          : [1, videoAspect / targetAspect];
      gl.uniform2f(this.uniform(program, "uScale"), scale[0], scale[1]);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, this.blankTex);
      gl.uniform2f(this.uniform(program, "uScale"), 1, 1);
    }
    gl.uniform1i(this.uniform(program, "uVideo"), 0);
    gl.uniform1f(this.uniform(program, "uHasVideo"), live ? 1 : 0);
    gl.uniform1f(this.uniform(program, "uTime"), this.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private renderPrint(spec: InkSpec) {
    const gl = this.gl;
    if (!this.srcTarget) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);

    const program = this.programs.print;
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTarget.tex);
    gl.uniform1i(this.uniform(program, "uSrc"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(
      gl.TEXTURE_2D,
      this.moshTargets ? this.moshTargets[this.moshIndex].tex : this.srcTarget.tex
    );
    gl.uniform1i(this.uniform(program, "uMoshTex"), 1);
    gl.uniform2f(this.uniform(program, "uRes"), this.width, this.height);
    gl.uniform1f(this.uniform(program, "uTime"), this.time);
    gl.uniform3fv(this.uniform(program, "uPaper"), spec.paper);
    gl.uniform3fv(this.uniform(program, "uInk"), spec.ink);
    gl.uniform3fv(this.uniform(program, "uAccent"), spec.accent);
    gl.uniform1f(this.uniform(program, "uAdditive"), spec.additive);
    gl.uniform1f(this.uniform(program, "uDotPitch"), this.state.pitch * this.dpr);
    gl.uniform1f(this.uniform(program, "uGrain"), 0.05);
    gl.uniform1f(this.uniform(program, "uWarp"), this.state.warp);

    let count = 0;
    if (this.params.showWindows && this.reading) {
      for (const g of this.reading.gestures) {
        for (let f = 0; f < g.fingertips.length; f++) {
          if (count >= MAX_WINDOWS) break;
          const tip = g.fingertips[f];
          this.windowData[count * 4] = tip.x * this.width;
          this.windowData[count * 4 + 1] = (1 - tip.y) * this.height;
          this.windowData[count * 4 + 2] = this.fingerBoxPx(g.span);
          this.windowData[count * 4 + 3] = 1;
          this.windowFx[count] = FINGER_EFFECTS[f % FINGER_EFFECTS.length];
          count++;
        }
      }
    }
    this.windowData.fill(0, count * 4);
    this.windowFx.fill(0, count);
    gl.uniform4fv(this.uniform(program, "uWindows"), this.windowData);
    gl.uniform1fv(this.uniform(program, "uWindowFx"), this.windowFx);
    gl.uniform1i(this.uniform(program, "uWindowCount"), count);
    gl.uniform1f(
      this.uniform(program, "uLensFx"),
      LENS_EFFECTS.find((e) => e.key === this.params.lensEffect)?.fx ?? 0
    );

    let lensCount = 0;
    for (const lens of this.state.lenses) {
      if (lensCount >= 2) break;
      this.lensData[lensCount * 4] = lens.x * this.width;
      this.lensData[lensCount * 4 + 1] = (1 - lens.y) * this.height;
      this.lensData[lensCount * 4 + 2] = lens.radius * Math.min(this.width, this.height);
      this.lensData[lensCount * 4 + 3] = lens.strength;
      lensCount++;
    }
    this.lensData.fill(0, lensCount * 4);
    gl.uniform4fv(this.uniform(program, "uLenses"), this.lensData);
    gl.uniform1i(this.uniform(program, "uLensCount"), lensCount);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private fingerBoxPx(span: number) {
    return Math.max(13 * this.dpr, span * Math.min(this.width, this.height) * 0.44);
  }

  private drawOverlay(spec: InkSpec) {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.width;
    const h = this.height;
    const s = this.dpr;
    ctx.clearRect(0, 0, w, h);
    const reading = this.reading;
    if (!reading) return;

    const mono = `${10 * s}px ui-monospace, SFMono-Regular, Menlo, monospace`;

    const tips: { x: number; y: number }[] = [];
    for (const g of reading.gestures) for (const t of g.fingertips) tips.push(t);
    if (tips.length > 1) {
      ctx.save();
      ctx.strokeStyle = spec.css.faint;
      ctx.lineWidth = 1 * s;
      ctx.setLineDash([4 * s, 4 * s]);
      ctx.beginPath();
      tips.forEach((t, i) => {
        const x = t.x * w;
        const y = t.y * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    for (const g of reading.gestures) {
      ctx.save();

      if (this.params.showSkeleton) {
        ctx.strokeStyle = spec.css.faint;
        ctx.lineWidth = 1.3 * s;
        ctx.beginPath();
        for (const [a, b] of BONES) {
          const pa = g.hand.points[a];
          const pb = g.hand.points[b];
          ctx.moveTo(pa.x * w, pa.y * h);
          ctx.lineTo(pb.x * w, pb.y * h);
        }
        ctx.stroke();
      }

      const l = g.bounds.minX * w;
      const r = g.bounds.maxX * w;
      const t = g.bounds.minY * h;
      const b = g.bounds.maxY * h;
      const corner = Math.min((r - l) * 0.22, 18 * s);
      ctx.strokeStyle = spec.css.ink;
      ctx.lineWidth = 1.3 * s;
      ctx.beginPath();
      ctx.moveTo(l, t + corner); ctx.lineTo(l, t); ctx.lineTo(l + corner, t);
      ctx.moveTo(r - corner, t); ctx.lineTo(r, t); ctx.lineTo(r, t + corner);
      ctx.moveTo(r, b - corner); ctx.lineTo(r, b); ctx.lineTo(r - corner, b);
      ctx.moveTo(l + corner, b); ctx.lineTo(l, b); ctx.lineTo(l, b - corner);
      ctx.stroke();

      ctx.font = mono;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = spec.css.faint;
      ctx.fillText(
        `${g.hand.handedness.toUpperCase()}  PINCH ${Math.round(g.pinch * 100)}`,
        l,
        t - 6 * s
      );

      if (this.params.showWindows) {
        const half = this.fingerBoxPx(g.span);
        ctx.strokeStyle = spec.css.accent;
        ctx.lineWidth = 1.2 * s;
        for (const tip of g.fingertips) {
          const x = tip.x * w;
          const y = tip.y * h;
          ctx.strokeRect(x - half, y - half, half * 2, half * 2);
          ctx.fillStyle = spec.css.faint;
          ctx.fillText(
            `x:${Math.round(tip.x * w / s)} y:${Math.round(tip.y * h / s)}`,
            x - half,
            y + half + 11 * s
          );
        }
      }
      ctx.restore();
    }

    if (reading.bothPinched) {
      const pinched = reading.gestures.filter((g) => g.pinch > 0.5);
      if (pinched.length === 2) {
        const [a, b] = pinched;
        const ax = a.point.x * w;
        const ay = a.point.y * h;
        const bx = b.point.x * w;
        const by = b.point.y * h;
        ctx.save();
        ctx.strokeStyle = spec.css.accent;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.font = mono;
        ctx.fillStyle = spec.css.accent;
        ctx.textAlign = "center";
        ctx.fillText(`SCREEN ${this.state.pitch.toFixed(1)}px`, (ax + bx) / 2, (ay + by) / 2 - 10 * s);
        ctx.restore();
      }
    }

    if (!this.params.compact) {
      ctx.save();
      ctx.font = mono;
      ctx.fillStyle = spec.css.faint;
      ctx.textAlign = "left";
      const pad = 16 * s;
      const pinches = reading.gestures.map((g) => Math.round(g.pinch * 100));
      ctx.fillText(
        `HANDS ${reading.gestures.length}/2 · PINCH ${pinches.join("/") || "--"}` +
          ` · SCREEN ${this.state.pitch.toFixed(1)}px · WARP ${this.state.warp.toFixed(2)}`,
        pad,
        h - pad
      );
      ctx.restore();
    }
  }

  private demoHands(t: number): Hand[] {
    const cycle = (t % 6) / 6;
    const pinch = Math.max(0, Math.sin(cycle * Math.PI * 2)) ** 0.7;
    const drift = Math.sin(t * 0.5) * 0.06;

    const build = (wx: number, wy: number, dir: number): Hand => {
      const L = 0.2;
      const points = [{ x: wx, y: wy, z: 0 }];
      for (let f = 0; f < 5; f++) {
        const fan = (f - 2) * 0.34;
        const a = dir * (1.0 + fan);
        for (let j = 0; j < 4; j++) {
          const k = [0.45, 0.62, 0.82, 1.0][j] * (f === 0 ? 0.8 : 1);
          points.push({ x: wx + Math.cos(a) * L * k, y: wy - Math.sin(a) * L * k, z: 0 });
        }
      }
      const close = (ai: number, bi: number, k: number) => {
        const a = points[ai];
        const b = points[bi];
        const mx = (a.x + b.x) * 0.5;
        const my = (a.y + b.y) * 0.5;
        points[ai] = { x: a.x + (mx - a.x) * k, y: a.y + (my - a.y) * k, z: 0 };
        points[bi] = { x: b.x + (mx - b.x) * k, y: b.y + (my - b.y) * k, z: 0 };
      };
      close(4, 8, pinch * 0.97);
      close(3, 7, pinch * 0.45);
      return { points, handedness: dir < 1.6 ? "Left" : "Right", score: 1 };
    };

    return [
      build(0.3 + drift, 0.78, 1.0),
      build(0.7 - drift, 0.78, 2.14),
    ];
  }

  private frame = (ts: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    if (!this.visible) {
      this.lastTs = ts;
      return;
    }

    const dt = Math.min(0.05, Math.max(0, this.lastTs ? (ts - this.lastTs) / 1000 : 1 / 60));
    this.lastTs = ts;
    this.time += dt;

    if (this.params.demo) {
      this.demoTime += dt;
      this.hands = this.demoHands(this.demoTime);
      this.reading = readGestures(this.hands);
    } else if (this.video && this.tracker.ready) {
      const hands = this.tracker.detect(this.video, ts);
      if (hands) {
        this.hands = hands;
        this.reading = readGestures(hands);
      }
    }

    this.state.update(this.reading, dt);

    const spec = INKS[this.params.ink] ?? INKS.sumi;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.renderSource();
    this.renderMosh();
    this.renderPrint(spec);
    this.drawOverlay(spec);
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTs = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  setParams(next: Partial<HandLensParams>) {
    const compactChanged = next.compact !== undefined && next.compact !== this.params.compact;
    this.params = { ...this.params, ...next };
    if (compactChanged) {
      this.width = 0;
      this.resize();
    }
  }

  setVideo(video: HTMLVideoElement | null) {
    this.video = video;
    if (!video) {
      this.hands = [];
      this.reading = null;
    }
  }

  dispose() {
    this.stop();
    this.ro?.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    const gl = this.gl;
    if (this.srcTarget) {
      gl.deleteTexture(this.srcTarget.tex);
      gl.deleteFramebuffer(this.srcTarget.fbo);
    }
    if (this.moshTargets) {
      for (const target of this.moshTargets) {
        gl.deleteTexture(target.tex);
        gl.deleteFramebuffer(target.fbo);
      }
    }
    if (this.videoTex) gl.deleteTexture(this.videoTex);
    if (this.blankTex) gl.deleteTexture(this.blankTex);
    if (this.quad) gl.deleteBuffer(this.quad);
    for (const program of Object.values(this.programs)) gl.deleteProgram(program);
  }
}
