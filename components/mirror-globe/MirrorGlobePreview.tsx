"use client";

import { useState } from "react";
import MirrorGlobe, { GlobePalette, PALETTE_HEX, StampMode } from "./MirrorGlobe";
import { Settings2, RefreshCcw, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MirrorGlobePreview() {
  const [palette, setPalette] = useState<GlobePalette | "custom">("aurora");
  const [customColors, setCustomColors] = useState<string[]>([...PALETTE_HEX.aurora]);
  const [stampMode, setStampMode] = useState<StampMode>("hand");
  const [stampText, setStampText] = useState("Koshish");
  const [cursorResponse, setCursorResponse] = useState(1.0);
  const [flowSpeed, setFlowSpeed] = useState(0.6);
  const [embossDepth, setEmbossDepth] = useState(3);
  const [embossSoftness, setEmbossSoftness] = useState(10);
  const [lightAngle, setLightAngle] = useState(125);
  const [autoOrbitLight, setAutoOrbitLight] = useState(false);
  const [rimIntensity, setRimIntensity] = useState(0.6);
  const [grain, setGrain] = useState(0.05);
  const [handScale, setHandScale] = useState(1.0);
  const [handRotation, setHandRotation] = useState(0);
  const [globeSize, setGlobeSize] = useState(0.72);

  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const resetDefaults = () => {
    setPalette("aurora");
    setCustomColors([...PALETTE_HEX.aurora]);
    setStampMode("hand");
    setStampText("Koshish");
    setCursorResponse(1.0);
    setFlowSpeed(0.6);
    setEmbossDepth(3);
    setEmbossSoftness(10);
    setLightAngle(125);
    setAutoOrbitLight(false);
    setRimIntensity(0.6);
    setGrain(0.05);
    setHandScale(1.0);
    setHandRotation(0);
    setGlobeSize(0.72);
  };

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden font-sans">
      <MirrorGlobe
        palette={palette}
        customColors={customColors}
        stampMode={stampMode}
        stampText={stampText}
        cursorResponse={cursorResponse}
        flowSpeed={flowSpeed}
        embossDepth={embossDepth}
        embossSoftness={embossSoftness}
        lightAngle={lightAngle}
        autoOrbitLight={autoOrbitLight}
        rimIntensity={rimIntensity}
        grain={grain}
        handScale={handScale}
        handRotation={handRotation}
        globeSize={globeSize}
        className="absolute inset-0 w-full h-full"
      />

      {/* Navigation */}
      <a
        href="/vault"
        className="absolute top-6 left-6 z-30 p-2 text-white/50 hover:text-white bg-black/40 hover:bg-black/80 backdrop-blur-md rounded-full border border-white/10 transition-all flex items-center justify-center"
        title="Back to Vault"
      >
        <ArrowLeft className="w-5 h-5" />
      </a>

      {/* Control Panel Toggle */}
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="absolute top-6 right-6 z-30 p-3 bg-black/40 hover:bg-black/80 backdrop-blur-md rounded-full shadow-lg border border-white/10 text-white/80 hover:text-white transition-all"
        title="Toggle Controls"
      >
        <Settings2 className="w-5 h-5" />
      </button>

      {/* Glassmorphic Control Panel */}
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
            <button
              onClick={resetDefaults}
              className="text-white/40 hover:text-white transition-colors"
              title="Reset to Defaults"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Surface</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60">Gradient Palette</label>
                  <select
                    value={palette}
                    onChange={(e) => {
                      const next = e.target.value as GlobePalette | "custom";
                      setPalette(next);
                      if (next !== "custom") {
                        setCustomColors([...PALETTE_HEX[next]]);
                      }
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white/90 outline-none focus:border-white/30 capitalize"
                  >
                    <option value="aurora" className="bg-neutral-900">Aurora (Default)</option>
                    <option value="iridescent" className="bg-neutral-900">Iridescent</option>
                    <option value="chrome" className="bg-neutral-900">Chrome</option>
                    <option value="obsidian" className="bg-neutral-900">Obsidian</option>
                    <option value="custom" className="bg-neutral-900">Custom</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60">Colors</label>
                  <div className="grid grid-cols-4 gap-2">
                    {customColors.map((color, i) => (
                      <input
                        key={i}
                        type="color"
                        value={color}
                        onChange={(e) => {
                          const next = [...customColors];
                          next[i] = e.target.value;
                          setCustomColors(next);
                          setPalette("custom");
                        }}
                        className="w-full h-9 rounded-lg border border-white/10 bg-white/5 cursor-pointer p-1"
                        title={`Color ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
                <ControlSlider
                  label="Flow Speed"
                  value={flowSpeed}
                  min={0}
                  max={2}
                  step={0.05}
                  onChange={setFlowSpeed}
                />
                <ControlSlider
                  label="Globe Size"
                  value={globeSize}
                  min={0.3}
                  max={0.95}
                  step={0.01}
                  onChange={setGlobeSize}
                />
                <ControlSlider
                  label="Grain"
                  value={grain}
                  min={0}
                  max={0.15}
                  step={0.005}
                  onChange={setGrain}
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-sm font-semibold text-white mb-4">Stamp</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60">Trapped Inside</label>
                  <select
                    value={stampMode}
                    onChange={(e) => setStampMode(e.target.value as StampMode)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white/90 outline-none focus:border-white/30"
                  >
                    <option value="hand" className="bg-neutral-900">Handprint</option>
                    <option value="text" className="bg-neutral-900">Your Name (cursive)</option>
                  </select>
                </div>
                {stampMode === "text" && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-white/60">Name</label>
                    <input
                      type="text"
                      value={stampText}
                      maxLength={24}
                      onChange={(e) => setStampText(e.target.value)}
                      placeholder="hello"
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white/90 outline-none focus:border-white/30"
                    />
                  </div>
                )}
                <ControlSlider
                  label="Emboss Depth"
                  value={embossDepth}
                  min={0}
                  max={8}
                  step={0.1}
                  onChange={setEmbossDepth}
                />
                <ControlSlider
                  label="Emboss Softness"
                  value={embossSoftness}
                  min={4}
                  max={40}
                  step={1}
                  onChange={setEmbossSoftness}
                />
                <ControlSlider
                  label="Stamp Scale"
                  value={handScale}
                  min={0.5}
                  max={1.6}
                  step={0.05}
                  onChange={setHandScale}
                />
                <ControlSlider
                  label="Stamp Rotation (°)"
                  value={handRotation}
                  min={-90}
                  max={90}
                  step={1}
                  onChange={setHandRotation}
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-sm font-semibold text-white mb-4">Lighting</h3>
              <div className="space-y-4">
                <ControlSlider
                  label="Light Angle (°)"
                  value={lightAngle}
                  min={-180}
                  max={180}
                  step={1}
                  onChange={setLightAngle}
                />
                <label className="flex items-center justify-between text-xs font-medium text-white/60 cursor-pointer">
                  <span>Auto-Orbit Light</span>
                  <input
                    type="checkbox"
                    checked={autoOrbitLight}
                    onChange={(e) => setAutoOrbitLight(e.target.checked)}
                    className="accent-white w-4 h-4"
                  />
                </label>
                <ControlSlider
                  label="Rim Intensity"
                  value={rimIntensity}
                  min={0}
                  max={1.5}
                  step={0.05}
                  onChange={setRimIntensity}
                />
                <ControlSlider
                  label="Cursor Response"
                  value={cursorResponse}
                  min={0}
                  max={1.5}
                  step={0.05}
                  onChange={setCursorResponse}
                />
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
        <span>{value.toFixed(step < 1 ? 2 : 0)}</span>
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
