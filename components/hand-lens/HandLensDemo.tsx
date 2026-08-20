"use client";

import React, { useEffect, useState } from "react";
import { Home, Github, Camera, Hand, Boxes, Repeat } from "lucide-react";
import HandLens, { LensStatus } from "./HandLens";
import { LENS_EFFECTS, LensEffect } from "./lensEngine";
import { INKS, INK_KEYS, SealInk } from "./inks";
import { RANCH_GITHUB_URL } from "../../RanchNavigation";

const pill = (active: boolean) =>
  `px-2 py-0.5 rounded-md text-xs font-sans transition-colors ${
    active
      ? "bg-neutral-900 text-white font-medium shadow-sm"
      : "bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700"
  }`;

export const HandLensDemo: React.FC = () => {
  const [ink, setInk] = useState<SealInk>("sumi");
  const [lensEffect, setLensEffect] = useState<LensEffect>("mosh");
  const [cycling, setCycling] = useState(false);
  const [active, setActive] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showWindows, setShowWindows] = useState(true);
  const [, setStatus] = useState<LensStatus>("idle");

  useEffect(() => {
    if (!cycling) return;
    const id = window.setInterval(() => {
      setLensEffect((current) => {
        const i = LENS_EFFECTS.findIndex((e) => e.key === current);
        return LENS_EFFECTS[(i + 1) % LENS_EFFECTS.length].key;
      });
    }, 2800);
    return () => window.clearInterval(id);
  }, [cycling]);

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
          <HandLens
            ink={ink}
            lensEffect={lensEffect}
            active={active}
            demo={!active}
            showSkeleton={showSkeleton}
            showWindows={showWindows}
            className="absolute inset-0 h-full w-full"
            onStatusChange={setStatus}
          />
        </div>

        <div className="flex-none flex flex-wrap items-center justify-between gap-3 px-2 pt-3 pb-1">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-sans">
            <span className="font-sans text-[13px] font-medium text-neutral-900 tracking-tight">
              Hand Lens
            </span>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden sm:block" />

            <div className="flex items-center gap-1 text-[12px] text-neutral-500 font-medium">
              <span className="text-neutral-400 hidden lg:inline mr-1">Lens:</span>
              {LENS_EFFECTS.map((effect) => (
                <button
                  key={effect.key}
                  onClick={() => {
                    setCycling(false);
                    setLensEffect(effect.key);
                  }}
                  className={pill(lensEffect === effect.key)}
                  title={`Render ${effect.label} inside the pinch lens`}
                >
                  {effect.label}
                </button>
              ))}
              <button
                onClick={() => setCycling((v) => !v)}
                className={`ml-1 inline-flex items-center gap-1 ${pill(cycling)}`}
                title="Cycle the lens effect automatically"
              >
                <Repeat className="h-3 w-3" />
                Cycle
              </button>
            </div>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden md:block" />

            <div className="flex items-center gap-1 text-[12px] text-neutral-500 font-medium">
              <span className="text-neutral-400 hidden lg:inline mr-1">Ink:</span>
              {INK_KEYS.map((key) => (
                <button key={key} onClick={() => setInk(key)} className={pill(ink === key)}>
                  {INKS[key].name}
                </button>
              ))}
            </div>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden sm:block" />

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActive((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-sans font-medium transition-colors border shadow-sm ${
                  active
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border-neutral-200/80"
                }`}
                title="Load the hand landmark model and start the camera"
              >
                <Camera className="h-3 w-3" />
                {active ? "Stop" : "Start"}
              </button>

              <button
                onClick={() => setShowWindows((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-sans font-medium transition-colors border shadow-sm ${
                  showWindows
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border-neutral-200/80"
                }`}
                title="Toggle the fingertip analysis windows"
              >
                <Boxes className="h-3 w-3" />
                Windows
              </button>

              <button
                onClick={() => setShowSkeleton((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-sans font-medium transition-colors border shadow-sm ${
                  showSkeleton
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border-neutral-200/80"
                }`}
                title="Toggle the hand skeleton"
              >
                <Hand className="h-3 w-3" />
                Landmarks
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HandLensDemo;
