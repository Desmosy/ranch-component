"use client";

import React, { useEffect, useState } from "react";
import { Home, Github, Shuffle, Camera, Aperture } from "lucide-react";
import MotionPress, { CameraState, PressLens, PressSource } from "./MotionPress";
import { PALETTES, PALETTE_KEYS, PressPalette } from "./palettes";
import { RANCH_GITHUB_URL } from "../../RanchNavigation";

const LENSES: { key: PressLens; label: string; note: string }[] = [
  { key: "overprint", label: "Overprint", note: "Motion ink screened over the key plate" },
  { key: "vector", label: "Vector", note: "Flow direction, one arrow per cell" },
  { key: "stencil", label: "Stencil", note: "Trail cut into contoured plates" },
];

const DECAYS: { key: string; value: number; label: string }[] = [
  { key: "short", value: 0.84, label: "Short" },
  { key: "mid", value: 0.93, label: "Mid" },
  { key: "long", value: 0.975, label: "Long" },
];

const THRESHOLDS: { value: number; label: string }[] = [
  { value: 0.03, label: "Hair" },
  { value: 0.055, label: "Std" },
  { value: 0.1, label: "Coarse" },
];

const pill = (active: boolean) =>
  `px-2 py-0.5 rounded-md text-xs font-sans transition-colors ${
    active
      ? "bg-neutral-900 text-white font-medium shadow-sm"
      : "bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700"
  }`;

export const MotionPressDemo: React.FC = () => {
  const [palette, setPalette] = useState<PressPalette>("riso");
  const [lens, setLens] = useState<PressLens>("overprint");
  const [source, setSource] = useState<PressSource>("scene");
  const [decay, setDecay] = useState<number>(0.93);
  const [threshold, setThreshold] = useState<number>(0.055);
  const [showBlobs, setShowBlobs] = useState<boolean>(true);
  const [, setCamera] = useState<CameraState>("idle");

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

  const handleRandomize = () => {
    setPalette(PALETTE_KEYS[Math.floor(Math.random() * PALETTE_KEYS.length)]);
    setLens(LENSES[Math.floor(Math.random() * LENSES.length)].key);
    setDecay(DECAYS[Math.floor(Math.random() * DECAYS.length)].value);
    setThreshold(THRESHOLDS[Math.floor(Math.random() * THRESHOLDS.length)].value);
  };

  return (
    <div className="h-screen w-screen max-h-screen max-w-screen overflow-hidden bg-white flex flex-col items-center justify-between p-3 sm:p-6 font-sans text-neutral-900 cursor-default">
      <style>{`
        html, body {
          overflow: hidden !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .force-default-cursor,
        .force-default-cursor body,
        .force-default-cursor canvas,
        .force-default-cursor div {
          cursor: default !important;
        }
        .force-default-cursor a,
        .force-default-cursor button,
        .force-default-cursor input {
          cursor: pointer !important;
        }
        .modern-cursor, #modern-cursor, [data-custom-cursor] {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `}</style>

      <div className="w-full max-w-[84vw] flex-none flex items-center justify-between py-1 px-1">
        <a
          href="/ranch"
          className="text-xs font-sans font-medium text-neutral-500 hover:text-neutral-900 transition-colors tracking-tight flex items-center gap-1.5"
        >
          <Home className="h-3.5 w-3.5" />
          Ranch
        </a>

        <a
          href={RANCH_GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-sans font-medium text-neutral-500 hover:text-neutral-900 transition-colors tracking-tight flex items-center gap-1.5"
        >
          <Github className="h-3.5 w-3.5" />
          GitHub
        </a>
      </div>

      <div className="w-full max-w-[84vw] flex-1 min-h-0 flex flex-col bg-white border border-neutral-200/80 rounded-2xl p-2.5 sm:p-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)] my-2 overflow-hidden">
        <div className="relative flex-1 w-full min-h-0 overflow-hidden rounded-xl border border-neutral-200/60">
          <MotionPress
            palette={palette}
            lens={lens}
            source={source}
            decay={decay}
            threshold={threshold}
            showBlobs={showBlobs}
            showHud
            blobCount={8}
            className="absolute inset-0 h-full w-full"
            onCameraStateChange={setCamera}
          />
        </div>

        <div className="flex-none flex flex-wrap items-center justify-between gap-3 px-2 pt-3 pb-1">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-sans">
            <span className="font-sans text-[13px] font-medium text-neutral-900 tracking-tight">
              Motion Press
            </span>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden sm:block" />

            <div className="flex items-center gap-1 text-[12px] text-neutral-500 font-medium">
              <span className="text-neutral-400 hidden lg:inline mr-1">Lens:</span>
              {LENSES.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setLens(item.key)}
                  className={pill(lens === item.key)}
                  title={item.note}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden md:block" />

            <div className="flex items-center gap-1 text-[12px] text-neutral-500 font-medium">
              <span className="text-neutral-400 hidden lg:inline mr-1">Ink:</span>
              {PALETTE_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setPalette(key)}
                  className={pill(palette === key)}
                  title={`${PALETTES[key].name} stock`}
                >
                  {PALETTES[key].name}
                </button>
              ))}
            </div>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden md:block" />

            <div className="flex items-center gap-1 text-[12px] text-neutral-500 font-medium">
              <span className="text-neutral-400 hidden lg:inline mr-1">Trail:</span>
              {DECAYS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setDecay(item.value)}
                  className={pill(decay === item.value)}
                  title={`Decay ${item.value}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden lg:block" />

            <div className="flex items-center gap-1 text-[12px] text-neutral-500 font-medium">
              <span className="text-neutral-400 hidden lg:inline mr-1">Threshold:</span>
              {THRESHOLDS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => setThreshold(item.value)}
                  className={pill(threshold === item.value)}
                  title={`Frame-difference cutoff ${item.value}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden sm:block" />

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSource(source === "scene" ? "webcam" : "scene")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-sans font-medium transition-colors border shadow-sm ${
                  source === "webcam"
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border-neutral-200/80"
                }`}
                title="Feed the tracker your webcam instead of the synthetic scene"
              >
                <Camera className="h-3 w-3" />
                Camera
              </button>

              <button
                onClick={() => setShowBlobs((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-sans font-medium transition-colors border shadow-sm ${
                  showBlobs
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border-neutral-200/80"
                }`}
                title="Toggle blob tracking telemetry"
              >
                <Aperture className="h-3 w-3" />
                Tracks
              </button>

              <button
                onClick={handleRandomize}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-sans font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-colors border border-neutral-200/80 shadow-sm"
                title="Randomize lens, ink and trail"
              >
                <Shuffle className="h-3 w-3 text-neutral-500" />
                Randomize
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MotionPressDemo;
