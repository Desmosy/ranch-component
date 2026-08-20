"use client";

import React, { useRef, useState, useEffect } from "react";
import ChromaticFlow, { ChromaticFlowHandle, PaletteKey } from "./ChromaticFlow";
import { Home, Github, Shuffle } from "lucide-react";
import { RANCH_GITHUB_URL } from "../../RanchNavigation";

export const ChromaticFlowPreview: React.FC = () => {
  const canvasRef = useRef<ChromaticFlowHandle>(null);

  const [palette, setPalette] = useState<PaletteKey>("nebula");
  const [density, setDensity] = useState<"S" | "M" | "L">("M");

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
    const palettes: PaletteKey[] = ["nebula", "solar", "aurora", "iridescent", "monochrome"];
    const densities: ("S" | "M" | "L")[] = ["S", "M", "L"];
    setPalette(palettes[Math.floor(Math.random() * palettes.length)]);
    setDensity(densities[Math.floor(Math.random() * densities.length)]);
    canvasRef.current?.randomize();
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

      {/* Top Bar Header */}
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

      {/* Main Center Card */}
      <div className="w-full max-w-[84vw] flex-1 min-h-0 flex flex-col bg-white border border-neutral-200/80 rounded-2xl p-2.5 sm:p-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)] my-2 overflow-hidden">
        <div className="relative flex-1 w-full min-h-0 overflow-hidden rounded-xl border border-neutral-200/60 bg-[#05060a]">
          <ChromaticFlow
            ref={canvasRef}
            palette={palette}
            density={density}
          />
        </div>

        {/* Bottom Control Bar */}
        <div className="flex-none flex flex-wrap items-center justify-between gap-3 px-2 pt-3 pb-1">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-sans">
            <span className="font-sans text-[13px] font-medium text-neutral-900 tracking-tight">
              Kinetic Chromatica
            </span>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden sm:block" />

            {/* Palette Switcher */}
            <div className="flex items-center gap-1 text-[12px] text-neutral-500 font-medium">
              <span className="text-neutral-400 hidden lg:inline mr-1">Palette:</span>
              {(["nebula", "solar", "aurora", "iridescent", "monochrome"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPalette(p)}
                  className={`px-2 py-0.5 rounded-md text-xs font-sans capitalize transition-colors ${
                    palette === p
                      ? "bg-neutral-900 text-white font-medium shadow-sm"
                      : "bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden md:block" />

            {/* Density Selector */}
            <div className="flex items-center gap-1 text-[12px] text-neutral-500 font-medium">
              <span className="text-neutral-400 hidden lg:inline mr-1">Density:</span>
              {(["S", "M", "L"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setDensity(k)}
                  className={`px-2 py-0.5 rounded-md text-xs font-sans transition-colors ${
                    density === k
                      ? "bg-neutral-900 text-white font-medium shadow-sm"
                      : "bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden sm:block" />

            {/* Randomize Action Button */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRandomize}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-sans font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-colors border border-neutral-200/80 shadow-sm"
                title="Randomize palette & density"
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

export default ChromaticFlowPreview;
