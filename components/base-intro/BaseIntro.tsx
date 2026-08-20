import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createBaseIntro, type BaseIntroHandle } from "./baseIntroEngine";
import { createVideoIntro } from "./baseIntroVideo";

export interface BaseIntroProps {
  text?: string;
  primary?: string;
  background?: string;
  palette?: string[];
  speed?: number;
  sound?: boolean;
  loop?: boolean;
  autoplay?: boolean;
  pauseOffscreen?: boolean;

  video?: string;
  poster?: string;
  onDone?: () => void;
  className?: string;
}

const BaseIntro = forwardRef<BaseIntroHandle | null, BaseIntroProps>(function BaseIntro(
  {
    text = "base",
    primary = "#0000FF",
    background = "#ffffff",
    palette,
    speed = 1,
    sound = false,
    loop = false,
    autoplay = true,
    pauseOffscreen = true,
    video,
    poster,
    onDone,
    className = "",
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const introRef = useRef<BaseIntroHandle | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useImperativeHandle(ref, () => {
    const handle: BaseIntroHandle = {
      play: () => { introRef.current?.play(); return handle; },
      resume: () => { introRef.current?.resume(); return handle; },
      pause: () => { introRef.current?.pause(); return handle; },
      seek: (ms: number) => { introRef.current?.seek(ms); return handle; },
      setSound: (on: boolean) => introRef.current?.setSound(on),
      get time() { return introRef.current?.time ?? 0; },
      get duration() { return introRef.current?.duration ?? 1; },
      get playing() { return introRef.current?.playing ?? false; },
      resize: () => introRef.current?.resize(),
      destroy: () => introRef.current?.destroy(),
    };
    return handle;
  }, []);

  const paletteKey = palette ? palette.join(",") : "";

  useEffect(() => {
    const shared = {
      speed,
      sound,
      loop,
      autoplay,
      onDone: () => doneRef.current?.(),
    };

    const el: HTMLElement | null = video ? videoRef.current : canvasRef.current;
    if (!el) return;

    const intro = video
      ? createVideoIntro(videoRef.current!, shared)
      : createBaseIntro(canvasRef.current!, {
          ...shared,
          text,
          primary,
          background,
          ...(palette ? { palette } : {}),
        });
    introRef.current = intro;

    let io: IntersectionObserver | null = null;
    if (pauseOffscreen && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (autoplay) intro.resume();
          } else {
            intro.pause();
          }
        },
        { threshold: 0.05 },
      );
      io.observe(el);
    }

    return () => {
      io?.disconnect();
      intro.destroy();
      introRef.current = null;
    };
  }, [video, text, primary, background, paletteKey, speed, loop, autoplay, pauseOffscreen]);

  useEffect(() => { introRef.current?.setSound(sound); }, [sound]);

  const fill = className || "absolute inset-0 h-full w-full";

  if (video) {
    return (
      <video
        ref={videoRef}
        src={video}
        poster={poster}
        playsInline
        aria-label={`${text} title sequence`}
        className={fill}
        style={{ objectFit: "contain", background }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label={`${text} title sequence`}
      role="img"
      className={fill}
    />
  );
});

export default BaseIntro;
