export type SoundCue =
  | 'seed' | 'card' | 'wheel' | 'collapse' | 'expand' | 'split'
  | 'flipOn' | 'flipOff' | 'reveal' | 'chord' | 'fold' | 'contract' | 'absorb'
  | 'riffle';

export type SoundHandle = {
  play: (cue: SoundCue, i?: number) => void;
  unlock: () => void;
  setEnabled: (on: boolean) => void;
  close: () => void;
};

const PENT = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
const RISE = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
const FALL = [587.33, 523.25, 440.0, 392.0, 329.63, 293.66];
const TICK = [1046.5, 1174.7, 1318.5, 1567.98];

type Ctor = { new (): AudioContext };

export function createSound(volume = 0.5): SoundHandle {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let enabled = true;
  let gestureBound = false;

  function build(): AudioContext | null {
    if (ctx) return ctx;
    const AC: Ctor | undefined =
      (window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }).AudioContext ??
      (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = volume;

    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 1.9, 2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    const dry = ctx.createGain();
    dry.gain.value = 0.9;

    master.connect(dry).connect(ctx.destination);
    master.connect(wet).connect(verb).connect(ctx.destination);

    noise = noiseBuffer(ctx, 2.5);
    return ctx;
  }

  function impulse(c: AudioContext, seconds: number, decay: number) {
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function noiseBuffer(c: AudioContext, seconds: number) {
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function tone(freq: number, dur: number, gain: number, glide = 1, type: OscillatorType = 'sine') {
    const c = build();
    if (!c || !master) return;
    const t0 = c.currentTime + 0.006;

    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glide !== 1) o.frequency.exponentialRampToValueAtTime(freq * glide, t0 + dur * 0.85);

    const oct = c.createOscillator();
    oct.type = 'sine';
    oct.frequency.setValueAtTime(freq * 2, t0);
    const octG = c.createGain();
    octG.gain.value = 0.14;

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4600, t0);
    lp.frequency.exponentialRampToValueAtTime(1200, t0 + dur);

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.connect(g);
    oct.connect(octG).connect(g);
    g.connect(lp).connect(master);

    o.start(t0); oct.start(t0);
    o.stop(t0 + dur + 0.06); oct.stop(t0 + dur + 0.06);
  }

  function thump(freq: number, dur: number, gain: number) {
    const c = build();
    if (!c || !master) return;
    const t0 = c.currentTime + 0.006;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.7, t0);
    o.frequency.exponentialRampToValueAtTime(freq * 0.75, t0 + dur * 0.7);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function air(dur: number, from: number, to: number, gain: number) {
    const c = build();
    if (!c || !master || !noise) return;
    const t0 = c.currentTime + 0.006;
    const src = c.createBufferSource();
    src.buffer = noise;
    src.loop = true;

    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(from, t0);
    bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.42);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(bp).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  function play(cue: SoundCue, i = 0) {
    if (!enabled) return;
    const c = build();
    if (!c) return;
    if (c.state === 'suspended') { unlock(); return; }

    switch (cue) {
      case 'seed':     tone(392, 0.7, 0.13); thump(150, 0.4, 0.22); break;
      case 'card':     tone(PENT[i % PENT.length], 0.6, 0.085); break;
      case 'wheel':    air(1.7, 240, 1050, 0.045); break;
      case 'collapse': thump(110, 0.55, 0.26); tone(261.63, 0.7, 0.06); break;
      case 'expand':   air(0.55, 420, 1500, 0.05); tone(196, 0.6, 0.075, 1.5); break;
      case 'split':    tone(880, 0.2, 0.05, 1, 'triangle'); break;
      case 'flipOn':   tone(TICK[i % TICK.length], 0.13, 0.045, 1, 'triangle'); break;
      case 'flipOff':  tone(TICK[TICK.length - 1 - (i % TICK.length)], 0.11, 0.03, 1, 'triangle'); break;
      case 'reveal':   tone(RISE[i % RISE.length], 0.5, 0.105); break;
      case 'chord':    tone(261.63, 1.5, 0.06); tone(392, 1.5, 0.05); tone(523.25, 1.6, 0.04); break;
      case 'fold':     tone(FALL[i % FALL.length], 0.62, 0.062); break;
      case 'contract': air(0.5, 1300, 320, 0.04); tone(220, 0.6, 0.06, 0.62); break;
      case 'absorb':   thump(92, 0.9, 0.2); tone(130.81, 1.4, 0.05); break;
      case 'riffle':   tone(TICK[i % TICK.length] * 1.5, 0.085, 0.042, 1, 'triangle'); break;
    }
  }

  function unlock() {
    const c = build();
    if (!c) return;
    if (c.state !== 'suspended') return;
    if (gestureBound) return;
    gestureBound = true;
    const go = () => {
      c.resume();
      gestureBound = false;
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
    };
    window.addEventListener('pointerdown', go, { once: true });
    window.addEventListener('keydown', go, { once: true });
  }

  return {
    play,
    unlock,
    setEnabled(on: boolean) {
      enabled = on;
      if (on) unlock();
      if (master && ctx) master.gain.setTargetAtTime(on ? volume : 0, ctx.currentTime, 0.02);
    },
    close() {
      if (ctx) { ctx.close(); ctx = null; master = null; noise = null; }
    },
  };
}
