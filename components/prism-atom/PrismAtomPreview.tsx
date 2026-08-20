"use client";

import { useState } from "react";
import PrismAtom from "./PrismAtom";
import { Settings2, RefreshCcw, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULTS = {
  rings: 3,
  orbitSpeed: 0.9,
  precession: 0.06,
  ringWidth: 0.3,
  aberration: 0.012,
  glow: 1,
  nucleus: 1,
  flare: 0,
  hueShift: 0,
};

export default function PrismAtomPreview() {
  const [rings, setRings] = useState(DEFAULTS.rings);
  const [orbitSpeed, setOrbitSpeed] = useState(DEFAULTS.orbitSpeed);
  const [precession, setPrecession] = useState(DEFAULTS.precession);
  const [ringWidth, setRingWidth] = useState(DEFAULTS.ringWidth);
  const [aberration, setAberration] = useState(DEFAULTS.aberration);
  const [glow, setGlow] = useState(DEFAULTS.glow);
  const [nucleus, setNucleus] = useState(DEFAULTS.nucleus);
  const [flare, setFlare] = useState(DEFAULTS.flare);
  const [hueShift, setHueShift] = useState(DEFAULTS.hueShift);

  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const resetDefaults = () => {
    setRings(DEFAULTS.rings);
    setOrbitSpeed(DEFAULTS.orbitSpeed);
    setPrecession(DEFAULTS.precession);
    setRingWidth(DEFAULTS.ringWidth);
    setAberration(DEFAULTS.aberration);
    setGlow(DEFAULTS.glow);
    setNucleus(DEFAULTS.nucleus);
    setFlare(DEFAULTS.flare);
    setHueShift(DEFAULTS.hueShift);
  };

  const remix = () => {
    const r = (min: number, max: number) => min + Math.random() * (max - min);
    setRings(2 + Math.floor(Math.random() * 3));
    setOrbitSpeed(+r(0.4, 2.2).toFixed(2));
    setPrecession(+r(0, 0.3).toFixed(2));
    setRingWidth(+r(0.2, 0.5).toFixed(2));
    setAberration(+r(0.004, 0.03).toFixed(3));
    setGlow(+r(0.7, 1.6).toFixed(2));
    setNucleus(+r(0.5, 1.8).toFixed(2));
    setFlare(+r(0, 1.2).toFixed(2));
    setHueShift(Math.floor(Math.random() * 360));
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      <PrismAtom
        rings={rings}
        orbitSpeed={orbitSpeed}
        precession={precession}
        ringWidth={ringWidth}
        aberration={aberration}
        glow={glow}
        nucleus={nucleus}
        flare={flare}
        hueShift={hueShift}
        className="absolute inset-0 w-full h-full"
      />

      <button
        onClick={remix}
        className="absolute bottom-8 right-6 z-30 flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/15 backdrop-blur-md rounded-full shadow-lg border border-white/15 text-white/80 hover:text-white transition-all text-sm font-medium"
        title="Randomize the atom"
      >
        <Shuffle className="w-4 h-4" />
        Remix
      </button>

      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="absolute top-6 right-6 z-30 p-3 bg-black/40 hover:bg-black/80 backdrop-blur-md rounded-full shadow-lg border border-white/10 text-white/80 hover:text-white transition-all"
        title="Toggle Controls"
      >
        <Settings2 className="w-5 h-5" />
      </button>

      <div
        className={cn(
          "absolute top-20 right-6 z-20 w-80 max-h-[calc(100vh-120px)] overflow-y-auto rounded-3xl transition-all duration-500 ease-in-out scrollbar-none",
          "bg-black/60 backdrop-blur-xl shadow-2xl border border-white/10 text-white",
          isPanelOpen ? "translate-x-0 opacity-100 pointer-events-auto" : "translate-x-12 opacity-0 pointer-events-none"
        )}
      >
        <div className="p-6 space-y-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-lg font-medium text-white/90">Playground</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={remix}
                className="text-white/40 hover:text-white transition-colors"
                title="Remix"
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button
                onClick={resetDefaults}
                className="text-white/40 hover:text-white transition-colors"
                title="Reset to Defaults"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Orbits</h3>
              <div className="space-y-4">
                <ControlSlider label="Rings" value={rings} min={1} max={4} step={1} onChange={setRings} />
                <ControlSlider label="Orbit Speed" value={orbitSpeed} min={0} max={3} step={0.05} onChange={setOrbitSpeed} />
                <ControlSlider label="Precession" value={precession} min={0} max={0.5} step={0.01} onChange={setPrecession} />
                <ControlSlider label="Ring Roundness" value={ringWidth} min={0.15} max={0.6} step={0.01} onChange={setRingWidth} />
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-sm font-semibold text-white mb-4">Prism</h3>
              <div className="space-y-4">
                <ControlSlider label="Hue Shift (°)" value={hueShift} min={0} max={360} step={5} onChange={setHueShift} />
                <ControlSlider label="Aberration" value={aberration} min={0} max={0.05} step={0.001} onChange={setAberration} />
                <ControlSlider label="Glow" value={glow} min={0.2} max={2} step={0.05} onChange={setGlow} />
                <ControlSlider label="Nucleus" value={nucleus} min={0} max={2} step={0.05} onChange={setNucleus} />
                <ControlSlider label="Lens Flare" value={flare} min={0} max={1.5} step={0.05} onChange={setFlare} />
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
