"use client";

import { useEffect, useRef, useState } from "react";
import { Github, Home } from "lucide-react";
import Cipher from "./Cipher";
import { RANCH_GITHUB_URL } from "../../RanchNavigation";

/**
 * How much page the solve is spread over. At three letters this is ~84 moves,
 * so 1100vh gives each turn a little over a tenth of a screen — enough that a
 * normal scroll gesture advances two or three moves rather than a dozen.
 */
const SCROLL_VH = 1100;
const LETTERS = 3;

export default function CipherPreview() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [variant, setVariant] = useState<"plastic" | "line">("plastic");

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let raf = 0;
    const read = () => {
      raf = 0;
      const rect = track.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      if (span <= 0) return;
      setProgress(Math.max(0, Math.min(1, -rect.top / span)));
    };
    const onScroll = () => {
      // Coalesce to one read a frame — scroll fires faster than we render.
      if (!raf) raf = requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="bg-white font-sans text-neutral-900">
      <div ref={trackRef} className="relative" style={{ height: `${SCROLL_VH}vh` }}>
        <div className="sticky top-0 flex h-screen flex-col items-center justify-between p-3 sm:p-6">
          <div className="flex w-full max-w-[84vw] flex-none items-center justify-between px-1 py-1">
            <a
              href="/ranch"
              className="flex items-center gap-1.5 text-xs font-medium tracking-tight text-neutral-500 transition-colors hover:text-neutral-900"
            >
              <Home className="h-3.5 w-3.5" />
              Ranch
            </a>
            <a
              href={RANCH_GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium tracking-tight text-neutral-500 transition-colors hover:text-neutral-900"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>

          <div className="my-2 flex w-full min-h-0 max-w-[84vw] flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-3">
            <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-xl border border-neutral-200/60">
              <Cipher
                mode="scroll"
                progress={progress}
                letters={LETTERS}
                variant={variant}
                className="absolute inset-0"
              />
            </div>

            <div className="flex flex-none flex-wrap items-center justify-between gap-3 px-2 pb-1 pt-3">
              <div className="flex flex-wrap items-center gap-3 text-xs sm:gap-4">
                <span className="text-[13px] font-medium tracking-tight text-neutral-900">
                  Cipher
                </span>
                <div className="hidden h-3.5 w-[1px] bg-neutral-200 sm:block" />
                <span className="text-[12px] text-neutral-400">
                  Scroll to solve it · drag to turn it
                </span>

                <div className="hidden h-3.5 w-[1px] bg-neutral-200 sm:block" />

                <div className="flex items-center gap-1 text-[12px] font-medium text-neutral-500">
                  {(["plastic", "line"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVariant(v)}
                      className={`rounded-md px-2 py-0.5 text-xs capitalize transition-colors ${
                        variant === v
                          ? "bg-neutral-900 font-medium text-white shadow-sm"
                          : "bg-neutral-100/80 text-neutral-700 hover:bg-neutral-200/80"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Segmented, one per letter, so the bar answers "how much
                    further" and "how many left" at the same time — a single
                    continuous fill answers neither. */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: LETTERS }, (_, i) => {
                    const seg = Math.max(0, Math.min(1, progress * LETTERS - i));
                    return (
                      <div
                        key={i}
                        className="h-[3px] w-10 overflow-hidden rounded-full bg-neutral-200"
                      >
                        <div
                          className="h-full rounded-full bg-neutral-900"
                          style={{ width: `${(seg * 100).toFixed(1)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <span className="w-16 text-right text-[12px] tabular-nums text-neutral-400">
                  {Math.min(LETTERS, Math.floor(progress * LETTERS) + 1)} / {LETTERS}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
