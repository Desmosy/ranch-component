/**
 * A MATHEMATICAL PARASITE
 *
 * The host is a clean parametric curve, in polar form
 *
 *     r(t) = amp · sin(a·t + φ)      θ(t) = b·t
 *
 * so x = r cos θ, y = r sin θ. Every later generation is produced by the same
 * operator applied to the one before it:
 *
 *     C_{k+1}(t) = C_k(t) + λ·C_k'(t) + μ_k·(A(t) − C_k(t))
 *
 * The derivative term is the parasite. It is a linear operator, and on a
 * harmonic of order m it has gain |1 + iλ·sin(2πm/N)| — so it treats every
 * harmonic differently, rotating and growing each by its own amount, and after
 * enough generations the family has pulled apart into nested, progressively
 * distorted curves. That is not a metaphor for instability; it is the
 * instability, and it is why the late generations oscillate and loop.
 *
 * λ is expressed in SAMPLE units — the finite difference is deliberately not
 * divided by Δt. Dividing by it is the same operator with λ rescaled by 1/Δt,
 * but it puts the worst-amplified mode (m = N/4) at gain N/2π ≈ 114 per
 * generation. Over 24 generations that multiplies the arithmetic noise floor by
 * ~10⁴⁹, so the plot stops being the curve within about eight generations and
 * becomes amplified rounding error — which draws as a straight bundle of hair
 * shot clean across the plate.
 *
 * In sample units the worst mode sits at |1 + iλ| instead. The budget is then
 * explicit: with λ ≤ 2.6 that mode gains ~10¹⁰ across the family, and against
 * a float64 noise floor of 1e-16 it never surfaces, while the harmonics the
 * host actually contains (m ≈ b ± a) gain a visible ~2× and rotate a radian
 * or so apart. Growth where the drawing is, silence where the noise is.
 *
 * The attractor term is the opposing force. A(t) is smooth, so it feeds energy
 * back into the LOW harmonics — exactly the ones the derivative is starving.
 * Everything interesting in this piece happens in the competition between the
 * two, which is also why neither is allowed to win outright.
 */

export const N = 720;
export const MAX_GENS = 14;

const TAU = Math.PI * 2;
const DT = TAU / N;

export interface Params {
  /** Petal count of the host curve. */
  a: number;
  /** Angular frequency — the cursor's horizontal axis. */
  b: number;
  /** Amplitude — the cursor's vertical axis. */
  amp: number;
  /** λ, the parasite's strength — the cursor's distance from centre. */
  lam: number;
  /** Phase, always creeping. */
  phi: number;
}

export const REST: Params = { a: 3, b: 3, amp: 0.9, lam: 0.25, phi: 0 };

/**
 * The host. One perfect object, before anything happens to it.
 *
 * b is snapped to a whole number, and that is load-bearing rather than a
 * simplification. The sample array is treated as periodic everywhere — the
 * derivative wraps index N−1 to 0, and the path closes back to its first
 * point. At fractional b the curve does not actually close over [0, 2π], so
 * that wrap spans a real gap: it draws as a long straight chord across the
 * plate, and worse, it feeds one enormous false derivative into the seam which
 * every later generation then inherits and amplifies. Whole b makes the curve
 * genuinely periodic, the seam vanishes, and the straight streaks go with it.
 *
 * The cursor therefore steps through whole regimes on its horizontal axis
 * rather than sliding through them, which is the honest behaviour anyway —
 * these are distinct closed figures, not points on a continuum.
 */
export function host(out: Float64Array, p: Params, scale: number) {
  const b = Math.max(1, Math.round(p.b));
  for (let i = 0; i < N; i++) {
    const t = i * DT;
    const r = p.amp * Math.sin(p.a * t + p.phi);
    const th = b * t;
    out[i * 2] = r * Math.cos(th) * scale;
    out[i * 2 + 1] = r * Math.sin(th) * scale;
  }
}

/**
 * One generation of following. The derivative is a central difference on the
 * periodic sample array — the curve differentiating itself, with no analytic
 * shortcut, which is what lets the operator be applied to its own output.
 */
export function follow(
  src: Float64Array,
  dst: Float64Array,
  lam: number,
  mu: number,
  attractorR: number,
) {
  for (let i = 0; i < N; i++) {
    const p = ((i - 1 + N) % N) * 2;
    const n = ((i + 1) % N) * 2;
    const c = i * 2;

    const dx = (src[n] - src[p]) / 2;
    const dy = (src[n + 1] - src[p + 1]) / 2;

    let x = src[c] + lam * dx;
    let y = src[c + 1] + lam * dy;

    if (mu > 0) {
      // A(t): the circle the whole family is quietly being pulled onto.
      const t = i * DT;
      x += mu * (Math.cos(t) * attractorR - x);
      y += mu * (Math.sin(t) * attractorR - y);
    }

    dst[c] = x;
    dst[c + 1] = y;
  }
}

/** Root-mean-square radius about the centroid — the plate's sense of scale. */
export function extent(buf: Float64Array): { cx: number; cy: number; r: number } {
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < N; i++) {
    cx += buf[i * 2];
    cy += buf[i * 2 + 1];
  }
  cx /= N;
  cy /= N;
  let s = 0;
  for (let i = 0; i < N; i++) {
    const dx = buf[i * 2] - cx;
    const dy = buf[i * 2 + 1] - cy;
    s += dx * dx + dy * dy;
  }
  return { cx, cy, r: Math.sqrt(s / N) };
}

/**
 * The operator's gain is greater than one, so left alone the family would be
 * off the plate within a dozen generations. Rescaling each generation about
 * its centroid keeps the SHAPE the parasite produced while discarding only the
 * magnitude — the drawing autoscales, the way a plotter would.
 */
export function renormalize(buf: Float64Array, target: number) {
  const { cx, cy, r } = extent(buf);
  if (r < 1e-6) return;
  const k = target / r;
  for (let i = 0; i < N; i++) {
    buf[i * 2] = cx + (buf[i * 2] - cx) * k;
    buf[i * 2 + 1] = cy + (buf[i * 2 + 1] - cy) * k;
  }
}

/** Total arc length. The honest measure of how wild a generation has become. */
export function arcLength(buf: Float64Array): number {
  let s = 0;
  for (let i = 0; i < N; i++) {
    const j = ((i + 1) % N) * 2;
    const c = i * 2;
    s += Math.hypot(buf[j] - buf[c], buf[j + 1] - buf[c + 1]);
  }
  return s;
}

/**
 * What the machine admits to be doing. Driven by the measured length ratio
 * between the last generation and the host, not by a timer — the plate is
 * reporting its own state.
 */
export function notation(ratio: number): string {
  if (ratio < 1.12) return "dC/dt";
  if (ratio < 1.35) return "d²C/dt²";
  if (ratio < 1.75) return "∇C";
  if (ratio < 2.4) return "λmax";
  return "CHAOS";
}
