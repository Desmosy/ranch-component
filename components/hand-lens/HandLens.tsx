"use client";

import { useEffect, useRef, useState } from "react";
import { HandTracker } from "./handTracker";
import { HandLensEngine, HandLensParams, LensEffect } from "./lensEngine";
import { INKS, SealInk } from "./inks";

export type LensStatus = "idle" | "loading" | "requesting" | "live" | "denied" | "error";

export interface HandLensProps {
  ink?: SealInk;
  lensEffect?: LensEffect;
  showSkeleton?: boolean;
  showWindows?: boolean;
  active?: boolean;
  demo?: boolean;
  compact?: boolean;
  className?: string;
  onStatusChange?: (status: LensStatus) => void;
}

export function HandLens({
  ink = "sumi",
  lensEffect = "mosh",
  showSkeleton = true,
  showWindows = true,
  active = false,
  demo = false,
  compact = false,
  className,
  onStatusChange,
}: HandLensProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<HandLensEngine | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const params: HandLensParams = { ink, lensEffect, showSkeleton, showWindows, demo, compact };
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const tracker = new HandTracker();
    trackerRef.current = tracker;

    let engine: HandLensEngine;
    try {
      engine = new HandLensEngine(canvas, overlay, paramsRef.current, tracker);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hand Lens failed to start.");
      return;
    }
    engineRef.current = engine;
    engine.start();

    const host = hostRef.current;
    let io: IntersectionObserver | null = null;
    if (host && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) engine.start();
            else engine.stop();
          }
        },
        { threshold: 0.01 }
      );
      io.observe(host);
    }

    return () => {
      io?.disconnect();
      engine.dispose();
      tracker.dispose();
      engineRef.current = null;
      trackerRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setParams(params);
  }, [ink, lensEffect, showSkeleton, showWindows, demo, compact]);

  useEffect(() => {
    let cancelled = false;

    if (!active) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      engineRef.current?.setVideo(null);
      onStatusChange?.("idle");
      return;
    }

    (async () => {
      const tracker = trackerRef.current;
      if (!tracker) return;

      onStatusChange?.("loading");
      await tracker.load();
      if (cancelled) return;
      if (tracker.error) {
        onStatusChange?.("error");
        setError(tracker.error);
        return;
      }

      onStatusChange?.("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 960, height: 540 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        engineRef.current?.setVideo(video);
        onStatusChange?.("live");
      } catch {
        if (!cancelled) onStatusChange?.("denied");
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      engineRef.current?.setVideo(null);
    };
  }, [active]);

  const paperCss = INKS[ink]?.css.paper ?? "#efe7d6";

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ position: "relative", overflow: "hidden", background: paperCss }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%" }}
      />
      <canvas
        ref={overlayRef}
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
      <video ref={videoRef} playsInline muted style={{ display: "none" }} />
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center font-mono text-[11px] uppercase tracking-widest text-neutral-500">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export default HandLens;
