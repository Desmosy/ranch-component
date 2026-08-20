"use client";

import { useState } from "react";
import TempleChime from "./TempleChime";
import { Settings2, RefreshCcw, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import RanchNavigation from "../../RanchNavigation";

const DEFAULTS = {
  scale: 0.75,
  lengthScale: 0.85,
  raggedness: 0.3,
  mouseRadius: 110,
  luminous: true,
  coverage: 0.64,
  colorMode: 'multi' as const,
};

export default function TempleChimePreview() {
  const [scale, setScale] = useState(DEFAULTS.scale);
  const [lengthScale, setLengthScale] = useState(DEFAULTS.lengthScale);
  const [raggedness, setRaggedness] = useState(DEFAULTS.raggedness);
  const [mouseRadius, setMouseRadius] = useState(DEFAULTS.mouseRadius);
  const [luminous, setLuminous] = useState(DEFAULTS.luminous);
  const [coverage, setCoverage] = useState(DEFAULTS.coverage);
  const [colorMode, setColorMode] = useState<'multi' | 'white'>(DEFAULTS.colorMode);
  const [muted, setMuted] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const resetDefaults = () => {
    setScale(DEFAULTS.scale);
    setLengthScale(DEFAULTS.lengthScale);
    setRaggedness(DEFAULTS.raggedness);
    setMouseRadius(DEFAULTS.mouseRadius);
    setLuminous(DEFAULTS.luminous);
    setCoverage(DEFAULTS.coverage);
    setColorMode(DEFAULTS.colorMode);
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black font-sans">
      <div className="absolute inset-x-0 top-0 flex h-[90%] items-start justify-center sm:h-[88%]">
        <TempleChime
          key={`${scale}-${lengthScale}-${raggedness}-${mouseRadius}-${luminous}-${coverage}-${colorMode}`}
          className="h-full w-full"
          scale={scale}
          lengthScale={lengthScale}
          raggedness={raggedness}
          mouseRadius={mouseRadius}
          luminous={luminous}
          coverage={coverage}
          colorMode={colorMode}
          muted={muted}
        />
      </div>

      <div className="absolute left-4 top-4 z-30 sm:left-6 sm:top-6">
        <RanchNavigation compact />
      </div>

      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute bottom-8 right-6 z-30 flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white/80 shadow-lg backdrop-blur-md transition-all hover:bg-white/15 hover:text-white"
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        {muted ? "Muted" : "Sound on"}
      </button>

      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="absolute right-6 top-6 z-30 rounded-full border border-white/10 bg-black/40 p-3 text-white/80 shadow-lg backdrop-blur-md transition-all hover:bg-black/80 hover:text-white"
        title="Toggle Controls"
      >
        <Settings2 className="h-5 w-5" />
      </button>

      <div
        className={cn(
          "absolute right-6 top-20 z-20 max-h-[calc(100vh-120px)] w-80 overflow-y-auto rounded-3xl transition-all duration-500 ease-in-out scrollbar-none",
          "border border-white/10 bg-black/60 text-white shadow-2xl backdrop-blur-xl",
          isPanelOpen ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none translate-x-12 opacity-0",
        )}
      >
        <div className="space-y-8 p-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-lg font-medium text-white/90">Playground</h2>
            <button onClick={resetDefaults} className="text-white/40 transition-colors hover:text-white" title="Reset to Defaults">
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="mb-4 text-sm font-semibold text-white">Curtain</h3>
              <div className="space-y-4">
                <ControlSlider label="Glyph Size" value={scale} min={0.5} max={1.4} step={0.05} onChange={setScale} />
                <ControlSlider label="Strand Length" value={lengthScale} min={0.2} max={2.5} step={0.05} onChange={setLengthScale} />
                <ControlSlider label="Coverage" value={coverage} min={0.4} max={1.5} step={0.02} onChange={setCoverage} />
                <ControlSlider label="Raggedness" value={raggedness} min={0} max={0.8} step={0.02} onChange={setRaggedness} />
                <ControlSlider label="Mouse Reach" value={mouseRadius} min={50} max={180} step={5} onChange={setMouseRadius} />
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="mb-4 text-sm font-semibold text-white">Look</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-medium text-white/60">
                  <span>Color Mode</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setColorMode('multi')}
                      className={`rounded-md px-3 py-1.5 transition ${
                        colorMode === 'multi'
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      Multi
                    </button>
                    <button
                      type="button"
                      onClick={() => setColorMode('white')}
                      className={`rounded-md px-3 py-1.5 transition ${
                        colorMode === 'white'
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      White
                    </button>
                  </div>
                </div>
                <label className="flex items-center justify-between text-xs font-medium text-white/60">
                  <span>Luminous Glow</span>
                  <input
                    type="checkbox"
                    checked={luminous}
                    onChange={(e) => setLuminous(e.target.checked)}
                    className="h-4 w-4 accent-white"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
        <span>{value.toFixed(step < 1 ? (step < 0.01 ? 3 : 2) : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
      />
    </div>
  );
}
