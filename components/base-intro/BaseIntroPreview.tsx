"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Github,
  Home,
  Pause,
  Play,
  RefreshCcw,
  RotateCcw,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";
import BaseIntro from "./BaseIntro";
import type { BaseIntroHandle } from "./baseIntroEngine";
import { RANCH_GITHUB_URL } from "../../RanchNavigation";
import { cn } from "@/lib/utils";

const DEFAULTS = {
  text: "base",
  primary: "#0000FF",
  background: "#ffffff",
  speed: 1,
  loop: false,
};

const PRESET_WORDS = ["base", "ranch", "koshish", "play"];

const BRANDS: { label: string; primary: string; background: string }[] = [
  { label: "Base", primary: "#0000FF", background: "#ffffff" },
  { label: "Ink", primary: "#111111", background: "#f4f2ed" },
  { label: "Signal", primary: "#E8543F", background: "#fffdf6" },
  { label: "Night", primary: "#F5D96B", background: "#0b0b0f" },
];

export default function BaseIntroPreview() {
  const [text, setText] = useState(DEFAULTS.text);
  const [primary, setPrimary] = useState(DEFAULTS.primary);
  const [background, setBackground] = useState(DEFAULTS.background);
  const [speed, setSpeed] = useState(DEFAULTS.speed);
  const [loop, setLoop] = useState(DEFAULTS.loop);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [soundOn, setSoundOn] = useState(true);

  const introRef = useRef<BaseIntroHandle | null>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const scrubbingRef = useRef(false);
  const playingRef = useRef(true);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const intro = introRef.current;
      if (intro) {
        if (!scrubbingRef.current && scrubRef.current) {
          scrubRef.current.value = String((intro.time / intro.duration) * 1000);
        }
        if (timeRef.current) {
          timeRef.current.textContent = `${(intro.time / 1000).toFixed(2)}s`;
        }
        if (intro.playing !== playingRef.current) {
          playingRef.current = intro.playing;
          setIsPlaying(intro.playing);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const replay = () => {
    introRef.current?.play();
    playingRef.current = true;
    setIsPlaying(true);
  };

  const toggle = () => {
    const intro = introRef.current;
    if (!intro) return;
    if (intro.playing) {
      intro.pause();
      playingRef.current = false;
      setIsPlaying(false);
      return;
    }
    if (intro.time >= intro.duration - 1) intro.play();
    else intro.resume();
    playingRef.current = true;
    setIsPlaying(true);
  };

  const reset = () => {
    setText(DEFAULTS.text);
    setPrimary(DEFAULTS.primary);
    setBackground(DEFAULTS.background);
    setSpeed(DEFAULTS.speed);
    setLoop(DEFAULTS.loop);
  };

  useEffect(() => {
    const originalBodyCursor = document.body.style.cursor;
    const originalDocCursor = document.documentElement.style.cursor;

    document.body.style.cursor = "default";
    document.documentElement.style.cursor = "default";
    document.body.classList.add("force-default-cursor");

    return () => {
      document.body.style.cursor = originalBodyCursor;
      document.documentElement.style.cursor = originalDocCursor;
      document.body.classList.remove("force-default-cursor");
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "r") replay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans" style={{ background }}>
      <style>{`
        .force-default-cursor,
        .force-default-cursor body,
        .force-default-cursor canvas,
        .force-default-cursor div,
        .force-default-cursor span {
          cursor: default !important;
        }
        .force-default-cursor a,
        .force-default-cursor button,
        .force-default-cursor input,
        .force-default-cursor label {
          cursor: pointer !important;
        }
        .force-default-cursor input[type="range"] {
          cursor: pointer !important;
        }
        .force-default-cursor input[type="text"] {
          cursor: text !important;
        }
        .modern-cursor, #modern-cursor, [data-custom-cursor] {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `}</style>
      <BaseIntro
        key={`${text}-${primary}-${background}-${speed}-${loop}`}
        ref={introRef}
        text={text}
        primary={primary}
        background={background}
        speed={speed}
        sound={soundOn}
        loop={loop}
        pauseOffscreen={false}
        onDone={() => setIsPlaying(false)}
        className="absolute inset-0 h-full w-full"
      />

      <nav className="fixed left-6 top-6 z-30 flex items-center gap-2" aria-label="Ranch navigation">
        <a href="/ranch" className={navPill} title="Back to Ranch">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </a>
        <a href="/" className={navPill} title="Home">
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Home</span>
        </a>
        <a
          href={RANCH_GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className={navPill}
          title="Ranch on GitHub"
        >
          <Github className="h-4 w-4" />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </nav>

      <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-black/80 px-4 py-2 text-white shadow-2xl backdrop-blur-xl">
        <button onClick={replay} className={pillBtn} title="Replay (r)">
          <RotateCcw className="h-3.5 w-3.5" />
          Replay
        </button>
        <button onClick={toggle} className={iconGhost} title="Play / pause (space)">
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setSoundOn((on) => !on)}
          className={iconGhost}
          title={soundOn ? "Mute" : "Unmute"}
        >
          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <input
          ref={scrubRef}
          type="range"
          min={0}
          max={1000}
          defaultValue={0}
          onPointerDown={() => { scrubbingRef.current = true; }}
          onPointerUp={() => { scrubbingRef.current = false; }}
          onChange={(e) => {
            const intro = introRef.current;
            if (!intro) return;
            intro.seek((intro.duration * parseFloat(e.target.value)) / 1000);
            playingRef.current = false;
            setIsPlaying(false);
          }}
          className="h-1 w-48 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
        />
        <span ref={timeRef} className="w-14 text-right text-xs tabular-nums text-white/60">
          0.00s
        </span>
      </div>

      <div className="fixed right-6 top-6 z-30">
        <button
          onClick={() => setIsPanelOpen((open) => !open)}
          className={iconBtn}
          title="Toggle settings panel"
        >
          <Settings2 className="h-5 w-5" />
        </button>
      </div>

      <div
        className={cn(
          "scrollbar-none fixed right-6 top-20 z-20 max-h-[calc(100vh-160px)] w-80 overflow-y-auto rounded-3xl border border-white/10 bg-black/80 text-white shadow-2xl backdrop-blur-xl transition-all duration-500 ease-in-out",
          isPanelOpen
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none translate-x-12 opacity-0",
        )}
      >
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-lg font-medium text-white/90">Playground</h2>
            <button
              onClick={reset}
              className="text-white/40 transition-colors hover:text-white"
              title="Reset to Defaults"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-medium text-white/60">Word</span>
              <input
                value={text}
                maxLength={10}
                onChange={(e) => setText(e.target.value || " ")}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/30"
              />
              <span className="block text-[11px] text-white/35">
                Four letters map 1:1 onto the four blocks.
              </span>
            </label>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-white/60">Presets</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_WORDS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setText(w)}
                    className={cn(
                      "rounded-lg border border-white/5 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/80 transition-colors hover:bg-white/10",
                      text === w && "border-white/30 bg-white/15 text-white",
                    )}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-white/60">Brand</span>
              <div className="grid grid-cols-2 gap-1.5">
                {BRANDS.map((b) => (
                  <button
                    key={b.label}
                    onClick={() => {
                      setPrimary(b.primary);
                      setBackground(b.background);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-2.5 py-2 text-[11px] text-white/80 transition-colors hover:bg-white/10",
                      primary === b.primary && background === b.background &&
                        "border-white/30 bg-white/15 text-white",
                    )}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded border border-white/20"
                      style={{ background: b.background }}
                    >
                      <span
                        className="block h-full w-full scale-50 rounded-[2px]"
                        style={{ background: b.primary }}
                      />
                    </span>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <ControlSlider label="Speed" value={speed} min={0.35} max={2} step={0.05} onChange={setSpeed} />

            <label className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2">
              <span className="text-xs font-medium text-white/60">Loop</span>
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
                className="h-4 w-4 accent-white"
              />
            </label>

          </div>
        </div>
      </div>
    </div>
  );
}

const navPill =
  "inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-black/80 px-3 text-sm font-medium text-white/90 shadow-sm backdrop-blur-md transition-all hover:bg-black hover:text-white";

const iconBtn =
  "rounded-full border border-white/15 bg-black/80 p-3 text-white/90 shadow-lg backdrop-blur-md transition-all hover:bg-black hover:text-white";

const pillBtn =
  "inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/20";

const iconGhost =
  "rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white";

function ControlSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-medium text-white/60">
        <span>{label}</span>
        <span>{value.toFixed(2)}×</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
      />
    </div>
  );
}
