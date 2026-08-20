"use client";

import { useState } from "react";
import HoloCard from "./HoloCard";
import espanaHoloCard from "../assets/espana_holo_card.webp";
import messiHoloCard from "../assets/messi_holo_card.webp";
import { Settings2, RefreshCcw, ArrowLeft, Sun, Moon, Home, Github } from "lucide-react";
import { RANCH_GITHUB_URL } from "../../RanchNavigation";
import { cn } from "@/lib/utils";

const DEFAULTS = {
  tilt: 16,
  holo: 1,
  glare: 1,
  sparkle: 1,
  radius: 18,
  pop: 1,
  idle: true,
};

const CARDS = [
  { name: "España", image: espanaHoloCard },
  { name: "Messi", image: messiHoloCard },
];

export default function HoloCardPreview() {
  const [tilt, setTilt] = useState(DEFAULTS.tilt);
  const [holo, setHolo] = useState(DEFAULTS.holo);
  const [glare, setGlare] = useState(DEFAULTS.glare);
  const [sparkle, setSparkle] = useState(DEFAULTS.sparkle);
  const [radius, setRadius] = useState(DEFAULTS.radius);
  const [pop, setPop] = useState(DEFAULTS.pop);
  const [idle, setIdle] = useState(DEFAULTS.idle);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [dark, setDark] = useState(true);
  const [active, setActive] = useState(0);

  const reset = () => {
    setTilt(DEFAULTS.tilt);
    setHolo(DEFAULTS.holo);
    setGlare(DEFAULTS.glare);
    setSparkle(DEFAULTS.sparkle);
    setRadius(DEFAULTS.radius);
    setPop(DEFAULTS.pop);
    setIdle(DEFAULTS.idle);
  };

  const cardProps = { tilt, holo, glare, sparkle, radius, pop, idle };
  const activeCard = CARDS[active];

  return (
    <div
      className={cn(
        "relative h-screen w-full overflow-hidden font-sans transition-colors duration-500",
        dark ? "bg-black" : "bg-white"
      )}
    >
      <style>{`@keyframes holoPopIn { 0% { opacity: 0; transform: scale(0.82) translateY(14px); } 60% { opacity: 1; } 100% { opacity: 1; transform: scale(1) translateY(0); } }`}</style>

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-8 p-6">
        {/* featured card — one at a time */}
        <div
          key={active}
          style={{ animation: "holoPopIn 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
        >
          <HoloCard image={activeCard.image} {...cardProps} className="h-[min(58vh,430px)]" />
        </div>

        <div className="flex items-center gap-4">
          {CARDS.map((card, i) => {
            const isActive = i === active;
            return (
              <button
                key={card.name}
                onClick={() => setActive(i)}
                title={card.name}
                className={cn(
                  "group relative overflow-hidden rounded-lg transition-all duration-300 focus:outline-none",
                  isActive ? "scale-105" : "opacity-60 hover:opacity-100"
                )}
                style={{ width: 52, aspectRatio: "2 / 3" }}
              >
                <img
                  src={card.image}
                  alt={card.name}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
                <span
                  className={cn(
                    "pointer-events-none absolute inset-0 rounded-lg ring-2 transition-all",
                    isActive
                      ? dark
                        ? "ring-white/80"
                        : "ring-black/70"
                      : "ring-transparent"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <nav className="absolute left-6 top-6 z-30 flex items-center gap-2" aria-label="Ranch navigation">
        <a href="/ranch" className={navPill(dark)} title="Back to Ranch">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </a>
        <a href="/" className={navPill(dark)} title="Home">
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Home</span>
        </a>
        <a href={RANCH_GITHUB_URL} target="_blank" rel="noreferrer" className={navPill(dark)} title="Ranch on GitHub">
          <Github className="h-4 w-4" />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </nav>

      <div className="absolute right-6 top-6 z-30 flex items-center gap-3">
        <button
          onClick={() => setDark(!dark)}
          className={cn(
            "rounded-full border p-3 shadow-lg backdrop-blur-md transition-all",
            dark
              ? "border-white/25 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white"
              : "border-black/15 bg-black/5 text-black/80 hover:bg-black/10 hover:text-black"
          )}
          title={dark ? "Switch to light background" : "Switch to dark background"}
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className={cn(
            "rounded-full border p-3 shadow-lg backdrop-blur-md transition-all",
            dark
              ? "border-white/25 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white"
              : "border-black/15 bg-black/5 text-black/80 hover:bg-black/10 hover:text-black"
          )}
          title="Toggle Controls"
        >
          <Settings2 className="h-5 w-5" />
        </button>
      </div>

      <div
        className={cn(
          "absolute right-6 top-20 z-20 max-h-[calc(100vh-120px)] w-80 overflow-y-auto rounded-3xl border shadow-2xl backdrop-blur-xl transition-all duration-500 ease-in-out scrollbar-none",
          dark
            ? "border-white/10 bg-black/60 text-white"
            : "border-black/10 bg-white/70 text-neutral-900",
          isPanelOpen
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-12 opacity-0 pointer-events-none"
        )}
      >
        <div className="space-y-8 p-6">
          <div
            className={cn(
              "flex items-center justify-between border-b pb-4",
              dark ? "border-white/10" : "border-black/10"
            )}
          >
            <h2 className={cn("text-lg font-medium", dark ? "text-white/90" : "text-black/90")}>
              Playground
            </h2>
            <button
              onClick={reset}
              className={cn(
                "transition-colors",
                dark ? "text-white/40 hover:text-white" : "text-black/40 hover:text-black"
              )}
              title="Reset to Defaults"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <ControlSlider dark={dark} label="Tilt" value={tilt} min={0} max={28} step={1} onChange={setTilt} />
            <ControlSlider dark={dark} label="Holo Sheen" value={holo} min={0} max={1.5} step={0.05} onChange={setHolo} />
            <ControlSlider dark={dark} label="Glare" value={glare} min={0} max={1.5} step={0.05} onChange={setGlare} />
            <ControlSlider dark={dark} label="Sparkle" value={sparkle} min={0} max={1.5} step={0.05} onChange={setSparkle} />
            <ControlSlider dark={dark} label="Pop" value={pop} min={0} max={2} step={0.05} onChange={setPop} />
            <ControlSlider dark={dark} label="Corner Radius" value={radius} min={0} max={40} step={1} onChange={setRadius} />

            <label
              className={cn(
                "flex items-center justify-between pt-2 text-xs font-medium",
                dark ? "text-white/60" : "text-black/60"
              )}
            >
              <span>Idle Shimmer</span>
              <input
                type="checkbox"
                checked={idle}
                onChange={(e) => setIdle(e.target.checked)}
                className={cn("h-4 w-4 cursor-pointer", dark ? "accent-white" : "accent-black")}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function navPill(dark: boolean) {
  return cn(
    "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium shadow-sm backdrop-blur-md transition-all",
    dark
      ? "border-white/25 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white"
      : "border-black/15 bg-black/5 text-black/80 hover:bg-black/10 hover:text-black"
  );
}

function ControlSlider({
  dark,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  dark: boolean;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex justify-between text-xs font-medium",
          dark ? "text-white/60" : "text-black/60"
        )}
      >
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
        className={cn(
          "h-1 w-full cursor-pointer appearance-none rounded-full",
          dark ? "bg-white/20 accent-white" : "bg-black/15 accent-black"
        )}
      />
    </div>
  );
}
