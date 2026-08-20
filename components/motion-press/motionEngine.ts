import { PALETTES, PaletteSpec, PressPalette } from "./palettes";

export type PressLens = "overprint" | "vector" | "stencil";
export type PressSource = "scene" | "webcam";

export interface MotionPressParams {
  palette: PressPalette;
  lens: PressLens;
  source: PressSource;
  threshold: number;
  decay: number;
  showBlobs: boolean;
  showHud: boolean;
  blobCount: number;
  speed: number;
  compact: boolean;
}

export const DEFAULT_PARAMS: MotionPressParams = {
  palette: "riso",
  lens: "overprint",
  source: "scene",
  threshold: 0.055,
  decay: 0.93,
  showBlobs: true,
  showHud: true,
  blobCount: 8,
  speed: 1,
  compact: false,
};

export interface Blob {
  id: number;
  x: number;
  y: number;
  size: number;
  confidence: number;
  vx: number;
  vy: number;
}

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const SCENE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;

uniform float uTime;
uniform float uAspect;
uniform vec4 uShapes[8];
uniform float uTypes[8];
uniform int uShapeCount;

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdTriangle(vec2 p, float r) {
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) * 0.5;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

float shapeDist(float type, vec2 p, float s) {
  if (type < 0.5) return length(p) - s;
  if (type < 1.5) return sdBox(p, vec2(s * 0.92));
  if (type < 2.5) return sdBox(p, vec2(s * 1.35, s * 0.62));
  return sdTriangle(p, s * 1.12);
}

void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);

  float body = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uShapeCount) break;
    vec4 sh = uShapes[i];
    vec2 q = rot(sh.w) * (p - sh.xy);
    body = max(body, 1.0 - smoothstep(0.0, 0.006, shapeDist(uTypes[i], q, sh.z)));
  }

  float wave = sin((p.x * 16.0 + p.y * 9.0) - uTime * 3.2);
  float rib = smoothstep(-0.12, 0.12, wave);

  float luma = 0.06 + body * (0.34 + 0.46 * rib);
  frag = vec4(vec3(luma), 1.0);
}`;

const CAM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;

uniform sampler2D uVideo;
uniform vec2 uScale;

void main() {
  vec2 uv = (vUv - 0.5) * uScale + 0.5;
  uv.x = 1.0 - uv.x;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    frag = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  frag = vec4(texture(uVideo, uv).rgb, 1.0);
}`;

const DETECT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;

uniform sampler2D uSrc;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uDecay;
uniform float uHasPrev;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  float cur = luma(texture(uSrc, vUv).rgb);
  vec4 prev = texture(uPrev, vUv);

  float diff = abs(cur - prev.r) * uHasPrev;
  float motion = smoothstep(uThreshold, uThreshold * 4.0, diff);

  float ml = abs(cur - texture(uPrev, vUv - vec2(uTexel.x, 0.0)).r);
  float mr = abs(cur - texture(uPrev, vUv + vec2(uTexel.x, 0.0)).r);
  float mu = abs(cur - texture(uPrev, vUv + vec2(0.0, uTexel.y)).r);
  float md = abs(cur - texture(uPrev, vUv - vec2(0.0, uTexel.y)).r);

  vec2 raw = vec2(mr - ml, mu - md);
  float len = length(raw);
  vec2 dir = (len > 0.0015 && motion > 0.0) ? raw / len : vec2(0.0);

  float decayed = max(prev.g * uDecay - 0.02, 0.0);
  float trail = max(decayed, motion);

  vec2 prevFlow = prev.ba * 2.0 - 1.0;
  vec2 flow = mix(prevFlow * uDecay, dir, clamp(motion, 0.0, 1.0));

  frag = vec4(cur, trail, flow * 0.5 + 0.5);
}`;

const REDUCE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;

uniform sampler2D uState;
uniform vec2 uSpread;

void main() {
  vec4 acc = vec4(0.0);
  float peak = 0.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 uv = vUv + vec2(float(x), float(y)) * uSpread * 0.25;
      vec4 s = texture(uState, uv);
      acc += s;
      peak = max(peak, s.g);
    }
  }
  vec4 mean = acc / 25.0;
  frag = vec4(mean.r, mix(mean.g, peak, 0.6), mean.b, mean.a);
}`;

const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;

uniform sampler2D uSrc;
uniform sampler2D uState;
uniform vec2 uRes;
uniform vec2 uStateTexel;
uniform float uTime;
uniform float uLens;
uniform float uAdditive;
uniform float uDotPitch;
uniform float uCellPx;
uniform float uGrain;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uAccent;
uniform vec4 uBlobs[12];
uniform int uBlobCount;
uniform float uChroma;

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float dots(float v, vec2 px, float angle, float pitch) {
  vec2 q = rot(angle) * px / max(pitch, 1.0);
  float d = length(fract(q) - 0.5) * 2.0;
  float r = sqrt(clamp(v, 0.0, 1.0)) * 1.05;
  float aa = fwidth(d) * 1.2 + 0.002;
  return smoothstep(r + aa, r - aa, d);
}

vec3 layInk(vec3 base, vec3 ink, float amount) {
  float a = clamp(amount, 0.0, 1.0);
  return mix(base * mix(vec3(1.0), ink, a), mix(base, ink, a), uAdditive);
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}

float sdArrow(vec2 p) {
  float shaft = sdBox(p - vec2(-0.16, 0.0), vec2(0.34, 0.055));
  float head = sdTriangle(p, vec2(0.52, 0.0), vec2(0.16, 0.20), vec2(0.16, -0.20));
  return min(shaft, head);
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

float trailAt(vec2 uv) {
  float t = texture(uState, uv).g * 0.36;
  t += texture(uState, uv + vec2(uStateTexel.x, 0.0)).g * 0.16;
  t += texture(uState, uv - vec2(uStateTexel.x, 0.0)).g * 0.16;
  t += texture(uState, uv + vec2(0.0, uStateTexel.y)).g * 0.16;
  t += texture(uState, uv - vec2(0.0, uStateTexel.y)).g * 0.16;
  return t;
}

void main() {
  vec2 uv = vUv;
  vec3 src = texture(uSrc, uv).rgb;
  float sl = dot(src, vec3(0.299, 0.587, 0.114));
  float trail = trailAt(uv);

  vec3 col = uPaper;

  if (uLens < 0.5) {
    float motion = smoothstep(0.04, 0.55, trail);
    float key = smoothstep(0.05, 0.95, sl) * (1.0 - 0.78 * motion);
    float keyDots = dots(key, gl_FragCoord.xy, 0.4363, uDotPitch);
    float motionDots = dots(motion, gl_FragCoord.xy + vec2(1.5, -1.0), 1.2217, uDotPitch * 1.45);
    col = layInk(col, uInk, keyDots * 0.95);
    col = layInk(col, uAccent, motionDots);
  } else if (uLens < 1.5) {
    float keyDots = dots(smoothstep(0.05, 0.95, sl), gl_FragCoord.xy, 0.4363, uDotPitch * 1.4);
    col = layInk(col, uInk, keyDots * 0.30);

    vec2 cells = max(floor(uRes / max(uCellPx, 8.0)), vec2(3.0));
    vec2 cellId = floor(uv * cells);
    vec2 snapped = (cellId + 0.5) / cells;
    vec2 cellUv = (uv * cells - cellId) * 2.0 - 1.0;

    vec4 st = texture(uState, snapped);
    float activity = smoothstep(0.05, 0.34, st.g);
    vec2 flow = st.ba * 2.0 - 1.0;
    float mag = length(flow);

    if (activity > 0.002 && mag > 0.02) {
      vec2 dir = flow / mag;
      vec2 nrm = vec2(-dir.y, dir.x);
      vec2 ap = vec2(dot(cellUv, dir), dot(cellUv, nrm));
      float scale = mix(0.5, 1.15, smoothstep(0.08, 0.65, mag) * activity);
      float d = sdArrow(ap / max(scale, 0.05)) * scale;
      float a = 1.0 - smoothstep(0.0, fwidth(d) * 2.0 + 0.001, d);
      col = layInk(col, uAccent, a * activity);
    }
  } else {
    float band = step(0.28, sl) * 0.55 + step(0.60, sl) * 0.45;
    col = layInk(col, uInk, band * 0.9);

    float bands = step(0.14, trail) * 0.34 + step(0.42, trail) * 0.30 + step(0.70, trail) * 0.36;
    col = layInk(col, uAccent, bands);

    float lvl = trail * 5.0;
    float f = fract(lvl);
    float contour = (1.0 - smoothstep(0.0, fwidth(lvl) * 1.6 + 0.001, min(f, 1.0 - f)))
      * step(0.06, trail);
    col = layInk(col, uInk, contour * 0.55);
  }

  if (uChroma > 0.0) {
    float window = 0.0;
    for (int i = 0; i < 12; i++) {
      if (i >= uBlobCount) break;
      vec4 b = uBlobs[i];
      vec2 d = abs(gl_FragCoord.xy - b.xy) - vec2(b.z);
      float sd = max(d.x, d.y);
      window = max(window, (1.0 - smoothstep(0.0, 1.5, sd)) * smoothstep(0.12, 0.35, b.w));
    }

    if (window > 0.001) {
      float v = clamp(sl * 0.55 + trail * 0.8, 0.0, 1.0);
      float steps = 6.0;
      vec3 banded = falseColor(floor(v * steps) / steps);

      float lvl = v * steps;
      float f = fract(lvl);
      float contour = 1.0 - smoothstep(0.0, fwidth(lvl) * 1.5 + 0.001, min(f, 1.0 - f));
      banded = mix(banded, vec3(0.04, 0.09, 0.28), contour * 0.7);

      col = mix(col, banded, window * uChroma * 0.92);
    }
  }

  float g = hash(floor(gl_FragCoord.xy) + floor(uTime * 24.0));
  col *= 1.0 - uGrain * g;

  frag = vec4(col, 1.0);
}`;

interface Target {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  width: number;
  height: number;
}

interface Slot {
  id: number;
  x: number;
  y: number;
  size: number;
  confidence: number;
  vx: number;
  vy: number;
}

const BLOB_GRID_W = 64;
const MAX_SHAPES = 8;
const MAX_BLOB_WINDOWS = 12;
const SAMPLES = 7;

export class MotionPressEngine {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private overlay: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private params: MotionPressParams;

  private programs: Record<string, WebGLProgram> = {};
  private uniformCache = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private quad: WebGLBuffer | null = null;

  private srcTarget: Target | null = null;
  private state: [Target, Target] | null = null;
  private blobTarget: Target | null = null;
  private videoTex: WebGLTexture | null = null;
  private video: HTMLVideoElement | null = null;

  private stateIndex = 0;
  private hasPrev = false;
  private raf = 0;
  private running = false;
  private visible = true;
  private time = 0;
  private lastTs = 0;
  private frameCount = 0;
  private dpr = 1;

  private width = 1;
  private height = 1;
  private detectW = 1;
  private detectH = 1;
  private blobW = BLOB_GRID_W;
  private blobH = 36;
  private blobPixels = new Uint8Array(4);

  private shapes: {
    x: number; y: number; vx: number; vy: number;
    r: number; rot: number; spin: number; type: number;
  }[] = [];
  private shapeData = new Float32Array(MAX_SHAPES * 4);
  private typeData = new Float32Array(MAX_SHAPES);
  private blobData = new Float32Array(MAX_BLOB_WINDOWS * 4);
  private pointer = { x: 0.5, y: 0.5, active: false, ex: 0.5, ey: 0.5 };

  private slots: Slot[] = [];
  private nextBlobId = 1;

  private ro: ResizeObserver | null = null;
  private onPointerMove = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pointer.x = (e.clientX - rect.left) / rect.width;
    this.pointer.y = 1 - (e.clientY - rect.top) / rect.height;
    this.pointer.active = true;
  };
  private onPointerLeave = () => {
    this.pointer.active = false;
  };
  private onVisibility = () => {
    this.visible = !document.hidden;
  };

  constructor(
    canvas: HTMLCanvasElement,
    overlay: HTMLCanvasElement,
    params: MotionPressParams
  ) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.params = { ...params };

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    if (!gl) throw new Error("WebGL2 is required for Motion Press.");
    this.gl = gl;
    this.ctx = overlay.getContext("2d");

    this.buildPrograms();
    this.buildQuad();
    this.seedScene();
    this.resetSlots(this.params.blobCount);
    this.resize();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
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
      throw new Error(`Motion Press shader failed to compile: ${log}`);
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
      const log = gl.getProgramInfoLog(program);
      throw new Error(`Motion Press program failed to link: ${log}`);
    }
    return program;
  }

  private buildPrograms() {
    this.programs.scene = this.link(SCENE_FRAG);
    this.programs.cam = this.link(CAM_FRAG);
    this.programs.detect = this.link(DETECT_FRAG);
    this.programs.reduce = this.link(REDUCE_FRAG);
    this.programs.composite = this.link(COMPOSITE_FRAG);
  }

  private buildQuad() {
    const gl = this.gl;
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
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

  private makeTarget(width: number, height: number, filter: number): Target {
    const gl = this.gl;
    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) throw new Error("Could not allocate render target.");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex, width, height };
  }

  private disposeTarget(target: Target | null) {
    if (!target) return;
    this.gl.deleteTexture(target.tex);
    this.gl.deleteFramebuffer(target.fbo);
  }

  private bindTarget(target: Target | null) {
    const gl = this.gl;
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.width, target.height);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private draw() {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  }

  private resize() {
    const host = this.canvas.parentElement ?? this.canvas;
    const cssW = Math.max(1, host.clientWidth || this.canvas.clientWidth || 640);
    const cssH = Math.max(1, host.clientHeight || this.canvas.clientHeight || 360);
    const dpr = Math.min(window.devicePixelRatio || 1, this.params.compact ? 1.25 : 1.75);

    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (w === this.width && h === this.height && this.dpr === dpr && this.srcTarget) return;

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

    const aspect = w / h;
    const detectW = this.params.compact ? 144 : 224;
    this.detectW = detectW;
    this.detectH = Math.max(8, Math.round(detectW / aspect));
    this.blobW = BLOB_GRID_W;
    this.blobH = Math.max(8, Math.round(BLOB_GRID_W / aspect));
    this.blobPixels = new Uint8Array(this.blobW * this.blobH * 4);

    this.disposeTarget(this.srcTarget);
    this.srcTarget = this.makeTarget(
      Math.max(2, Math.round(w / 2)),
      Math.max(2, Math.round(h / 2)),
      this.gl.LINEAR
    );

    if (this.state) {
      this.disposeTarget(this.state[0]);
      this.disposeTarget(this.state[1]);
    }
    this.state = [
      this.makeTarget(this.detectW, this.detectH, this.gl.LINEAR),
      this.makeTarget(this.detectW, this.detectH, this.gl.LINEAR),
    ];
    this.clearState();

    this.disposeTarget(this.blobTarget);
    this.blobTarget = this.makeTarget(this.blobW, this.blobH, this.gl.LINEAR);

    this.hasPrev = false;
  }

  private clearState() {
    if (!this.state) return;
    const gl = this.gl;
    gl.clearColor(0, 0, 0.5, 0.5);
    for (const target of this.state) {
      this.bindTarget(target);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    this.bindTarget(null);
  }

  private seedScene() {
    const types = [1, 2, 3, 0, 1];
    this.shapes = [];
    for (let i = 0; i < types.length; i++) {
      const a = (i / types.length) * Math.PI * 2;
      this.shapes.push({
        x: 0.5 + Math.cos(a) * 0.3,
        y: 0.5 + Math.sin(a) * 0.26,
        vx: Math.cos(a * 2.3) * 0.2,
        vy: Math.sin(a * 1.7) * 0.2,
        r: 0.085 + (i % 3) * 0.012,
        rot: a,
        spin: (i % 2 === 0 ? 1 : -1) * (0.35 + (i % 3) * 0.2),
        type: types[i],
      });
    }
  }

  private updateScene(dt: number) {
    const aspect = this.width / this.height;
    const speed = this.params.speed;

    for (const shape of this.shapes) {
      shape.x += shape.vx * dt * speed;
      shape.y += shape.vy * dt * speed;
      shape.rot += shape.spin * dt * speed;
      const pad = shape.r * 1.2;
      if (shape.x < pad) { shape.x = pad; shape.vx = Math.abs(shape.vx); }
      if (shape.x > aspect - pad) { shape.x = aspect - pad; shape.vx = -Math.abs(shape.vx); }
      if (shape.y < pad) { shape.y = pad; shape.vy = Math.abs(shape.vy); }
      if (shape.y > 1 - pad) { shape.y = 1 - pad; shape.vy = -Math.abs(shape.vy); }
    }

    const ease = 1 - Math.pow(0.001, dt);
    this.pointer.ex += (this.pointer.x - this.pointer.ex) * ease;
    this.pointer.ey += (this.pointer.y - this.pointer.ey) * ease;

    const count = Math.min(MAX_SHAPES, this.shapes.length + (this.pointer.active ? 1 : 0));
    for (let i = 0; i < this.shapes.length; i++) {
      const shape = this.shapes[i];
      this.shapeData[i * 4] = shape.x;
      this.shapeData[i * 4 + 1] = shape.y;
      this.shapeData[i * 4 + 2] = shape.r;
      this.shapeData[i * 4 + 3] = shape.rot;
      this.typeData[i] = shape.type;
    }
    if (this.pointer.active && this.shapes.length < MAX_SHAPES) {
      const i = this.shapes.length;
      this.shapeData[i * 4] = this.pointer.ex * aspect;
      this.shapeData[i * 4 + 1] = this.pointer.ey;
      this.shapeData[i * 4 + 2] = 0.085;
      this.shapeData[i * 4 + 3] = this.time * 0.8;
      this.typeData[i] = 0;
    }
    return count;
  }

  private renderSource(shapeCount: number) {
    const gl = this.gl;
    const src = this.srcTarget;
    if (!src) return;
    this.bindTarget(src);

    const useCam =
      this.params.source === "webcam" &&
      this.video &&
      this.video.readyState >= 2 &&
      this.video.videoWidth > 0;

    if (useCam && this.video) {
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

      const program = this.programs.cam;
      gl.useProgram(program);
      const videoAspect = this.video.videoWidth / this.video.videoHeight;
      const targetAspect = src.width / src.height;
      const scale =
        videoAspect > targetAspect
          ? [targetAspect / videoAspect, 1]
          : [1, videoAspect / targetAspect];
      gl.uniform2f(this.uniform(program, "uScale"), scale[0], scale[1]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.videoTex);
      gl.uniform1i(this.uniform(program, "uVideo"), 0);
      this.draw();
      return;
    }

    const program = this.programs.scene;
    gl.useProgram(program);
    gl.uniform1f(this.uniform(program, "uTime"), this.time);
    gl.uniform1f(this.uniform(program, "uAspect"), src.width / src.height);
    gl.uniform1i(this.uniform(program, "uShapeCount"), shapeCount);
    gl.uniform4fv(this.uniform(program, "uShapes"), this.shapeData);
    gl.uniform1fv(this.uniform(program, "uTypes"), this.typeData);
    this.draw();
  }

  private renderDetect() {
    const gl = this.gl;
    if (!this.state || !this.srcTarget) return;
    const read = this.state[this.stateIndex];
    const write = this.state[1 - this.stateIndex];

    this.bindTarget(write);
    const program = this.programs.detect;
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTarget.tex);
    gl.uniform1i(this.uniform(program, "uSrc"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, read.tex);
    gl.uniform1i(this.uniform(program, "uPrev"), 1);
    gl.uniform2f(this.uniform(program, "uTexel"), 1 / this.detectW, 1 / this.detectH);
    gl.uniform1f(this.uniform(program, "uThreshold"), Math.max(0.005, this.params.threshold));
    gl.uniform1f(this.uniform(program, "uDecay"), this.params.decay);
    gl.uniform1f(this.uniform(program, "uHasPrev"), this.hasPrev ? 1 : 0);
    this.draw();

    this.stateIndex = 1 - this.stateIndex;
    this.hasPrev = true;
  }

  private renderReduceAndRead() {
    const gl = this.gl;
    if (!this.state || !this.blobTarget) return;
    const state = this.state[this.stateIndex];

    this.bindTarget(this.blobTarget);
    const program = this.programs.reduce;
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.tex);
    gl.uniform1i(this.uniform(program, "uState"), 0);
    gl.uniform2f(this.uniform(program, "uSpread"), 1 / this.blobW, 1 / this.blobH);
    this.draw();

    gl.readPixels(0, 0, this.blobW, this.blobH, gl.RGBA, gl.UNSIGNED_BYTE, this.blobPixels);
  }

  private renderComposite(palette: PaletteSpec) {
    const gl = this.gl;
    if (!this.state || !this.srcTarget) return;
    const state = this.state[this.stateIndex];

    this.bindTarget(null);
    const program = this.programs.composite;
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTarget.tex);
    gl.uniform1i(this.uniform(program, "uSrc"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.tex);
    gl.uniform1i(this.uniform(program, "uState"), 1);
    gl.uniform2f(this.uniform(program, "uRes"), this.width, this.height);
    gl.uniform2f(this.uniform(program, "uStateTexel"), 1 / this.detectW, 1 / this.detectH);
    gl.uniform1f(this.uniform(program, "uTime"), this.time);
    gl.uniform1f(
      this.uniform(program, "uLens"),
      this.params.lens === "overprint" ? 0 : this.params.lens === "vector" ? 1 : 2
    );
    gl.uniform1f(this.uniform(program, "uAdditive"), palette.additive);
    gl.uniform1f(this.uniform(program, "uDotPitch"), (this.params.compact ? 4.2 : 5.6) * this.dpr);
    gl.uniform1f(this.uniform(program, "uCellPx"), (this.params.compact ? 22 : 34) * this.dpr);
    gl.uniform1f(this.uniform(program, "uGrain"), this.params.compact ? 0.04 : 0.06);
    gl.uniform3fv(this.uniform(program, "uPaper"), palette.paper);
    gl.uniform3fv(this.uniform(program, "uInk"), palette.ink);
    gl.uniform3fv(this.uniform(program, "uAccent"), palette.accent);

    let windows = 0;
    if (this.params.showBlobs) {
      for (const slot of this.slots) {
        if (windows >= MAX_BLOB_WINDOWS) break;
        if (slot.id === 0 || slot.confidence <= 0.12) continue;
        this.blobData[windows * 4] = slot.x * this.width;
        this.blobData[windows * 4 + 1] = slot.y * this.height;
        this.blobData[windows * 4 + 2] = this.blobHalfPx(slot.size);
        this.blobData[windows * 4 + 3] = slot.confidence;
        windows++;
      }
    }
    this.blobData.fill(0, windows * 4);
    gl.uniform4fv(this.uniform(program, "uBlobs"), this.blobData);
    gl.uniform1i(this.uniform(program, "uBlobCount"), windows);
    gl.uniform1f(this.uniform(program, "uChroma"), this.params.showBlobs ? 1 : 0);
    this.draw();
  }

  private blobHalfPx(size: number) {
    return Math.max(13 * this.dpr, size * Math.min(this.width, this.height) * 0.9);
  }

  private resetSlots(count: number) {
    this.slots = [];
    for (let i = 0; i < count; i++) {
      this.slots.push({
        id: 0,
        x: (i * 0.61803398875 + 0.13) % 1,
        y: (i * 0.38196601125 + 0.31) % 1,
        size: 0.06,
        confidence: 0,
        vx: 0,
        vy: 0,
      });
    }
  }

  private motionAt(u: number, v: number) {
    const x = Math.min(this.blobW - 1, Math.max(0, Math.round(u * this.blobW - 0.5)));
    const y = Math.min(this.blobH - 1, Math.max(0, Math.round(v * this.blobH - 0.5)));
    return this.blobPixels[(y * this.blobW + x) * 4 + 1] / 255;
  }

  private trackBlobs(dt: number) {
    const slots = this.slots;
    const step = 1 / (SAMPLES - 1);

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const wasActive = slot.confidence > 0.03;
      const seedX = (i * 0.61803398875 + 0.13) % 1;
      const seedY = (i * 0.38196601125 + 0.31) % 1;
      const probeX = wasActive ? slot.x : seedX;
      const probeY = wasActive ? slot.y : seedY;
      const radius = wasActive ? 0.3 : 0.5;

      let weightSum = 0;
      let cx = 0;
      let cy = 0;
      let m2x = 0;
      let m2y = 0;

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const ox = sx * step - 0.5;
          const oy = sy * step - 0.5;
          const u = Math.min(1, Math.max(0, probeX + ox * radius));
          const v = Math.min(1, Math.max(0, probeY + oy * radius));

          const motion = this.motionAt(u, v);
          if (motion <= 0.02) continue;

          const falloff = Math.max(0, 1 - Math.hypot(ox, oy) * 1.25);
          if (falloff <= 0) continue;

          let exclusion = 1;
          for (let j = 0; j < i; j++) {
            const other = slots[j];
            if (other.confidence <= 0.05) continue;
            const d = Math.hypot(u - other.x, v - other.y);
            const t = Math.min(1, Math.max(0, (d - 0.09) / 0.15));
            exclusion *= t * t * (3 - 2 * t);
          }

          const weight = motion * falloff * exclusion;
          weightSum += weight;
          cx += u * weight;
          cy += v * weight;
          m2x += u * u * weight;
          m2y += v * v * weight;
        }
      }

      const target = Math.min(1, weightSum / 2.2);
      const ease = 1 - Math.pow(0.02, dt);

      if (weightSum > 0.06) {
        const centerX = cx / weightSum;
        const centerY = cy / weightSum;
        const varX = Math.max(0, m2x / weightSum - centerX * centerX);
        const varY = Math.max(0, m2y / weightSum - centerY * centerY);
        const size = Math.min(0.18, Math.max(0.035, Math.sqrt(Math.max(varX, varY)) * 1.7));

        const nx = slot.x + (centerX - slot.x) * ease;
        const ny = slot.y + (centerY - slot.y) * ease;
        slot.vx = (nx - slot.x) / Math.max(dt, 1e-3);
        slot.vy = (ny - slot.y) / Math.max(dt, 1e-3);
        slot.x = nx;
        slot.y = ny;
        slot.size += (size - slot.size) * ease;
        slot.confidence += (target - slot.confidence) * ease;
        if (slot.confidence > 0.1 && slot.id === 0) slot.id = this.nextBlobId++;
      } else {
        slot.confidence *= Math.pow(0.12, dt);
        slot.vx *= 0.9;
        slot.vy *= 0.9;
        if (slot.confidence < 0.02) slot.id = 0;
      }
    }
  }

  private drawOverlay(palette: PaletteSpec) {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);

    const s = this.dpr;
    const compact = this.params.compact;
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";

    const active = this.slots.filter((slot) => slot.confidence > 0.12 && slot.id > 0);

    if (this.params.showBlobs) {
      if (active.length > 1) {
        ctx.save();
        ctx.strokeStyle = palette.css.faint;
        ctx.lineWidth = 1 * s;
        ctx.setLineDash([4 * s, 4 * s]);
        ctx.beginPath();
        active.forEach((slot, i) => {
          const px = slot.x * w;
          const py = (1 - slot.y) * h;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.restore();
      }

      for (const slot of active) {
        const px = slot.x * w;
        const py = (1 - slot.y) * h;
        const half = this.blobHalfPx(slot.size);
        const alpha = Math.min(1, slot.confidence * 1.6);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = palette.css.accent;
        ctx.lineWidth = 1.4 * s;

        const corner = Math.min(half * 0.45, 14 * s);
        const l = px - half;
        const r = px + half;
        const t = py - half;
        const b = py + half;
        ctx.beginPath();
        ctx.moveTo(l, t + corner); ctx.lineTo(l, t); ctx.lineTo(l + corner, t);
        ctx.moveTo(r - corner, t); ctx.lineTo(r, t); ctx.lineTo(r, t + corner);
        ctx.moveTo(r, b - corner); ctx.lineTo(r, b); ctx.lineTo(r - corner, b);
        ctx.moveTo(l + corner, b); ctx.lineTo(l, b); ctx.lineTo(l, b - corner);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(px - 5 * s, py); ctx.lineTo(px + 5 * s, py);
        ctx.moveTo(px, py - 5 * s); ctx.lineTo(px, py + 5 * s);
        ctx.stroke();

        if (!compact) {
          ctx.fillStyle = palette.css.ink;
          ctx.font = `${10 * s}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textBaseline = "alphabetic";
          const tag = `T${String(slot.id % 100).padStart(2, "0")}`;
          ctx.fillText(tag, l, t - 6 * s);
          ctx.fillStyle = palette.css.faint;
          ctx.fillText(
            `${slot.x.toFixed(2)} ${slot.y.toFixed(2)}  m${Math.round(slot.confidence * 99)
              .toString()
              .padStart(2, "0")}`,
            l, b + 12 * s
          );

          const vlen = Math.hypot(slot.vx, slot.vy);
          if (vlen > 0.03) {
            const k = Math.min(0.12, vlen * 0.35) * Math.min(w, h);
            ctx.strokeStyle = palette.css.ink;
            ctx.lineWidth = 1 * s;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + (slot.vx / vlen) * k, py - (slot.vy / vlen) * k);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    if (this.params.showHud && !compact) {
      const pad = 16 * s;
      ctx.save();
      ctx.font = `${10 * s}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = palette.css.faint;
      ctx.fillText(
        `TRACKS ${String(active.length).padStart(2, "0")}/${String(this.slots.length).padStart(2, "0")}`,
        pad,
        h - pad
      );

      ctx.strokeStyle = palette.css.faint;
      ctx.lineWidth = 1 * s;
      const marks: [number, number][] = [
        [pad, pad],
        [w - pad, pad],
        [pad, h - pad - 20 * s],
        [w - pad, h - pad - 20 * s],
      ];
      const arm = 6 * s;
      for (const [mx, my] of marks) {
        ctx.beginPath();
        ctx.moveTo(mx - arm, my); ctx.lineTo(mx + arm, my);
        ctx.moveTo(mx, my - arm); ctx.lineTo(mx, my + arm);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(mx, my, arm * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
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
    this.time += dt * this.params.speed;
    this.frameCount++;

    const palette = PALETTES[this.params.palette] ?? PALETTES.riso;

    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const shapeCount = this.updateScene(dt);
    this.renderSource(shapeCount);
    this.renderDetect();
    if (this.params.showBlobs) {
      this.renderReduceAndRead();
      this.trackBlobs(dt);
    }
    this.renderComposite(palette);
    this.drawOverlay(palette);
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

  setParams(next: Partial<MotionPressParams>) {
    const countChanged =
      next.blobCount !== undefined && next.blobCount !== this.params.blobCount;
    const compactChanged =
      next.compact !== undefined && next.compact !== this.params.compact;
    this.params = { ...this.params, ...next };
    if (countChanged) this.resetSlots(this.params.blobCount);
    if (compactChanged) {
      this.width = 0;
      this.resize();
    }
    if (next.source !== undefined) this.hasPrev = false;
  }

  setVideo(video: HTMLVideoElement | null) {
    this.video = video;
    this.hasPrev = false;
  }

  getBlobs(): Blob[] {
    return this.slots
      .filter((slot) => slot.confidence > 0.12 && slot.id > 0)
      .map((slot) => ({ ...slot }));
  }

  capture(): string {
    const out = document.createElement("canvas");
    out.width = this.width;
    out.height = this.height;
    const ctx = out.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(this.canvas, 0, 0);
    ctx.drawImage(this.overlay, 0, 0);
    return out.toDataURL("image/png");
  }

  dispose() {
    this.stop();
    this.ro?.disconnect();
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    document.removeEventListener("visibilitychange", this.onVisibility);

    const gl = this.gl;
    this.disposeTarget(this.srcTarget);
    this.disposeTarget(this.blobTarget);
    if (this.state) {
      this.disposeTarget(this.state[0]);
      this.disposeTarget(this.state[1]);
    }
    if (this.videoTex) gl.deleteTexture(this.videoTex);
    if (this.quad) gl.deleteBuffer(this.quad);
    for (const program of Object.values(this.programs)) gl.deleteProgram(program);
  }
}
