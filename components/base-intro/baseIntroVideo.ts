import type { BaseIntroHandle, BaseIntroOptions } from './baseIntroEngine';

export function createVideoIntro(
  el: HTMLVideoElement,
  options: Partial<BaseIntroOptions> = {},
): BaseIntroHandle {
  const {
    speed = 1,
    loop = false,
    autoplay = true,
    sound = false,
    onDone = null,
  } = options;

  let disposed = false;
  let gestureBound = false;

  el.loop = loop;
  el.playbackRate = speed;
  el.playsInline = true;
  el.preload = 'auto';
  el.muted = !sound;

  const ended = () => { if (!loop) onDone?.(); };
  el.addEventListener('ended', ended);

  function start() {
    const attempt = el.play();
    if (!attempt) return;
    attempt.catch(() => {
      if (disposed || el.muted) return;
      el.muted = true;
      el.play().catch(() => {});
      armGesture();
    });
  }

  function armGesture() {
    if (gestureBound || disposed) return;
    gestureBound = true;
    const go = () => {
      gestureBound = false;
      if (disposed) return;
      el.muted = false;
      el.play().catch(() => {});
    };
    window.addEventListener('pointerdown', go, { once: true });
    window.addEventListener('keydown', go, { once: true });
  }

  const handle: BaseIntroHandle = {
    play() { el.currentTime = 0; start(); return handle; },
    resume() { start(); return handle; },
    pause() { el.pause(); return handle; },
    seek(ms: number) {
      el.pause();
      const d = el.duration;
      el.currentTime = Number.isFinite(d) ? Math.min(Math.max(ms, 0) / 1000, d) : 0;
      return handle;
    },
    setSound(on: boolean) {
      el.muted = !on;
      if (on && el.paused) start();
      else if (on) armGesture();
    },
    get time() { return el.currentTime * 1000; },
    get duration() { return Number.isFinite(el.duration) ? el.duration * 1000 : 0; },
    get playing() { return !el.paused && !el.ended; },
    resize() {},
    destroy() {
      disposed = true;
      el.removeEventListener('ended', ended);
      el.pause();
      el.removeAttribute('src');
      el.load();
    },
  };

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    const settle = () => {
      if (Number.isFinite(el.duration)) el.currentTime = el.duration * 0.6;
      onDone?.();
    };
    if (el.readyState >= 1) settle();
    else el.addEventListener('loadedmetadata', settle, { once: true });
  } else if (autoplay) {
    start();
  }

  return handle;
}

export default createVideoIntro;
