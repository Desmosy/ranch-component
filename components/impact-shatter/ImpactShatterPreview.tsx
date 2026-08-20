"use client";

import { useEffect, useState } from "react";
import Lenis from "lenis";
import ImpactShatter from "./ImpactShatter";
import { ArrowLeft, Github, Home, RefreshCcw, Settings2 } from "lucide-react";
import { RANCH_GITHUB_URL } from "../../RanchNavigation";
import { cn } from "@/lib/utils";

const DEFAULTS = {
  headline: "Perfection is static, beauty lives in chaos",
  impactAt: 0.32,
  magnetism: 0.9,
  scrollLength: 240,
  headlineScale: 0.076,
  cardScale: 0.23,
  spread: 1,
  chaos: 1,
  seed: 7,
};

const PRESET_HEADLINES = [
  "Perfection is static, beauty lives in chaos",
  "Unchain your typography from the traditional grid",
  "Art is not what you see, but what you make others feel",
];

export default function ImpactShatterPreview() {
  const [headline, setHeadline] = useState(DEFAULTS.headline);
  const [impactAt, setImpactAt] = useState(DEFAULTS.impactAt);
  const [magnetism, setMagnetism] = useState(DEFAULTS.magnetism);
  const [scrollLength, setScrollLength] = useState(DEFAULTS.scrollLength);
  const [headlineScale, setHeadlineScale] = useState(DEFAULTS.headlineScale);
  const [cardScale, setCardScale] = useState(DEFAULTS.cardScale);
  const [spread, setSpread] = useState(DEFAULTS.spread);
  const [chaos, setChaos] = useState(DEFAULTS.chaos);
  const [seed, setSeed] = useState(DEFAULTS.seed);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    if (!gsap || !ScrollTrigger) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();

    return () => {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  const reset = () => {
    setHeadline(DEFAULTS.headline);
    setImpactAt(DEFAULTS.impactAt);
    setMagnetism(DEFAULTS.magnetism);
    setScrollLength(DEFAULTS.scrollLength);
    setHeadlineScale(DEFAULTS.headlineScale);
    setCardScale(DEFAULTS.cardScale);
    setSpread(DEFAULTS.spread);
    setChaos(DEFAULTS.chaos);
    setSeed(DEFAULTS.seed);
  };

  return (
    <div className="relative min-h-screen w-full bg-black font-sans">
      <ImpactShatter
        headline={headline}
        impactAt={impactAt}
        magnetism={magnetism}
        scrollLength={scrollLength}
        headlineScale={headlineScale}
        cardScale={cardScale}
        spread={spread}
        chaos={chaos}
        seed={seed}
      />

      <div className="flex h-[30vh] items-center justify-center bg-black">
      </div>

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
        data-lenis-prevent
        className={cn(
          "scrollbar-none fixed right-6 top-20 z-20 max-h-[calc(100vh-120px)] w-80 overflow-y-auto rounded-3xl border border-white/10 bg-black/80 text-white shadow-2xl backdrop-blur-xl transition-all duration-500 ease-in-out",
          isPanelOpen
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none translate-x-12 opacity-0"
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
              <span className="text-xs font-medium text-white/60">Headline Text</span>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/30"
              />
            </label>

            <div>
              <span className="block text-xs font-medium text-white/60 mb-1.5">Preset Sentences</span>
              <div className="space-y-1.5">
                {PRESET_HEADLINES.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setHeadline(h)}
                    className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-white/80 transition-colors border border-white/5 line-clamp-2"
                  >
                    "{h}"
                  </button>
                ))}
              </div>
            </div>

            <ControlSlider label="Impact Point" value={impactAt} min={0.1} max={0.6} step={0.01} onChange={setImpactAt} />
            <ControlSlider label="Magnetism" value={magnetism} min={0.2} max={2.5} step={0.05} onChange={setMagnetism} />
            <ControlSlider label="Spread" value={spread} min={0} max={2} step={0.05} onChange={setSpread} />
            <ControlSlider label="Chaos" value={chaos} min={0} max={2} step={0.05} onChange={setChaos} />
            <ControlSlider label="Runway" value={scrollLength} min={120} max={500} step={10} onChange={setScrollLength} />
            <ControlSlider label="Headline Size" value={headlineScale} min={0.04} max={0.11} step={0.002} onChange={setHeadlineScale} />
            <ControlSlider label="Card Size" value={cardScale} min={0.14} max={0.36} step={0.005} onChange={setCardScale} />
          </div>
        </div>
      </div>
    </div>
  );
}

const navPill =
  "inline-flex h-9 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 text-sm font-medium text-white/90 shadow-sm backdrop-blur-md transition-all hover:bg-white/20 hover:text-white";

const iconBtn =
  "rounded-full border border-white/25 bg-white/10 p-3 text-white/90 shadow-lg backdrop-blur-md transition-all hover:bg-white/20 hover:text-white";

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
        <span>{step < 1 ? value.toFixed(2) : value.toFixed(0)}</span>
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
