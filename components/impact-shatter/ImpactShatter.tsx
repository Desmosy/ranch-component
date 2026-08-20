"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ImpactCard from "./ImpactCard";
import { buildScatter, clamp, type LetterHome, type ScatterConfig } from "./scatter";
import { cn } from "@/lib/utils";

function getGsap() {
  if (typeof window === "undefined") return null;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) return null;
  gsap.registerPlugin(ScrollTrigger);
  return { gsap };
}

export interface ImpactShatterProps extends Partial<ScatterConfig> {
  headline?: string;
  impactAt?: number;
  magnetism?: number;
  scrollLength?: number;
  headlineScale?: number;
  cardScale?: number;
  autoPlay?: boolean;
  className?: string;
}

const DEFAULT_HEADLINE = "Perfection is static, beauty lives in chaos";

export default function ImpactShatter({
  headline = DEFAULT_HEADLINE,
  impactAt = 0.32,
  magnetism = 0.9,
  scrollLength = 240,
  headlineScale = 0.076,
  cardScale = 0.23,
  spread = 1,
  chaos = 1,
  seed = 7,
  autoPlay,
  className,
}: ImpactShatterProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const cardWrapRef = useRef<HTMLDivElement>(null);
  const cardInnerRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [hostH, setHostH] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);

  const words = useMemo(() => headline.split(/\s+/).filter(Boolean), [headline]);
  const letterCount = useMemo(() => words.reduce((n, w) => n + w.length, 0), [words]);

  const embedded = autoPlay ?? (hostH > 0 && hostH < window.innerHeight * 0.7);

  const fontSize = stage.w ? clamp(stage.w * headlineScale, 10, 108) : 0;
  const cardWidth = stage.w ? clamp(stage.w * cardScale, 96, 300) : 0;

  useEffect(() => {
    letterRefs.current.length = letterCount;
  }, [letterCount]);

  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    const readStage = () => {
      const el = stageRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      setStage((prev) =>
        Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1 ? prev : { w, h }
      );
    };

    const readHost = () => {
      const host = sectionRef.current?.parentElement;
      if (!host) return;
      const h = host.clientHeight;
      setHostH((prev) => (Math.abs(prev - h) < 1 ? prev : h));
    };

    const readAll = () => {
      readHost();
      readStage();
    };

    readAll();
    const ro = new ResizeObserver(readAll);
    const host = sectionRef.current?.parentElement;
    if (host) ro.observe(host);
    window.addEventListener("resize", readAll);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", readAll);
    };
  }, []);

  useLayoutEffect(() => {
    if (!stage.w || !stage.h || !fontsReady) return;

    const lib = getGsap();
    if (!lib) return;
    const { gsap } = lib;

    const stageEl = stageRef.current;
    const cardWrapEl = cardWrapRef.current;
    const cardInnerEl = cardInnerRef.current;
    const shakeEl = shakeRef.current;
    if (!stageEl || !cardWrapEl || !cardInnerEl || !shakeEl) return;

    const ctx = gsap.context(() => {
      const letters = letterRefs.current.filter(Boolean) as HTMLSpanElement[];
      if (!letters.length) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const cardH = cardInnerEl.offsetHeight || stage.h * 0.35;
      const hiddenY = stage.h / 2 + cardH / 2 + 32;

      const stageBox = stageEl.getBoundingClientRect();
      const homes: LetterHome[] = letters.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left - stageBox.left + r.width / 2,
          y: r.top - stageBox.top + r.height / 2,
          w: r.width,
          h: r.height,
        };
      });

      const targets = buildScatter(
        homes,
        { w: stage.w, h: stage.h },
        { w: cardWidth, h: cardH },
        { spread, chaos, seed }
      );

      const unit = embedded ? 3.4 : 1;
      const impact = clamp(impactAt, 0.05, 0.8) * unit;
      const flight = unit - impact;

      const tl = gsap.timeline(
        embedded
          ? { repeat: -1, yoyo: true, repeatDelay: 1.2 }
          : {
              scrollTrigger: {
                trigger: sectionRef.current,
                start: "top top",
                end: `+=${scrollLength}%`,
                pin: stageEl,
                pinSpacing: true,
                anticipatePin: 1,
                invalidateOnRefresh: true,
                scrub: reduce ? true : magnetism,
              },
            }
      );

      if (reduce) {
        tl.fromTo(cardWrapEl, { y: hiddenY }, { y: 0, ease: "power2.out", duration: impact }, 0);
        return;
      }

      tl.fromTo(cardWrapEl, { y: hiddenY }, { y: 0, ease: "power2.in", duration: impact }, 0);

      tl.to(
        letters,
        {
          x: (i: number) => targets[i].x,
          y: (i: number) => targets[i].y,
          ease: "expo.out",
          duration: flight,
          stagger: (i: number) => targets[i].ripple * 0.05 * unit,
        },
        impact
      );

      tl.to(
        letters,
        {
          rotation: (i: number) => targets[i].rot,
          scale: (i: number) => targets[i].scale,
          ease: "power2.out",
          duration: flight,
          stagger: (i: number) => targets[i].ripple * 0.05 * unit,
        },
        impact
      );

      tl.to(
        cardInnerEl,
        { scaleX: 1.04, scaleY: 0.94, duration: 0.03 * unit, ease: "power2.out" },
        impact
      ).to(
        cardInnerEl,
        { scaleX: 1, scaleY: 1, duration: 0.24 * unit, ease: "elastic.out(1, 0.45)" },
        impact + 0.03 * unit
      );

      tl.to(
        shakeEl,
        {
          keyframes: [
            { x: -4, y: 2.5, duration: 0.012 * unit },
            { x: 3, y: -2.5, duration: 0.014 * unit },
            { x: -1.5, y: 1, duration: 0.014 * unit },
            { x: 0, y: 0, duration: 0.022 * unit },
          ],
          ease: "none",
        },
        impact
      );
    }, sectionRef);

    return () => ctx.revert();
  }, [
    stage.w,
    stage.h,
    fontsReady,
    headline,
    fontSize,
    cardWidth,
    impactAt,
    magnetism,
    scrollLength,
    spread,
    chaos,
    seed,
    embedded,
  ]);

  let letterIndex = 0;

  return (
    <section
      ref={sectionRef}
      className={cn("relative w-full", embedded && "absolute inset-0", className)}
      aria-label={headline}
    >
      <div
        ref={stageRef}
        className={cn(
          "relative w-full overflow-hidden bg-black",
          embedded ? "h-full" : "h-[100svh]"
        )}
      >
        <div ref={shakeRef} className="absolute inset-0">
          <div className="absolute inset-0 grid place-items-center px-[7%]">
            <h2
              aria-hidden="true"
              className="text-center font-medium text-white"
              style={{
                fontSize: fontSize || undefined,
                lineHeight: 1.04,
                letterSpacing: "-0.04em",
              }}
            >
              {words.map((word, wi) => (
                <span key={`${word}-${wi}`} className="inline-block whitespace-nowrap">
                  {Array.from(word).map((ch, ci) => {
                    const idx = letterIndex++;
                    return (
                      <span
                        key={ci}
                        ref={(el) => {
                          letterRefs.current[idx] = el;
                        }}
                        className="inline-block"
                      >
                        {ch}
                      </span>
                    );
                  })}
                  {wi < words.length - 1 ? <span className="inline-block">&nbsp;</span> : null}
                </span>
              ))}
            </h2>
          </div>

          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div ref={cardWrapRef}>
              <div ref={cardInnerRef}>
                {cardWidth > 0 ? <ImpactCard width={cardWidth} /> : null}
              </div>
            </div>
          </div>
        </div>

        <span className="sr-only">{headline}</span>
      </div>
    </section>
  );
}
