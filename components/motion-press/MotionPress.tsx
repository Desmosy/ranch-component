"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_PARAMS,
  MotionPressEngine,
  MotionPressParams,
  PressLens,
  PressSource,
} from "./motionEngine";
import { PALETTES, PressPalette } from "./palettes";

export type { PressLens, PressSource } from "./motionEngine";
export type { PressPalette } from "./palettes";

export type CameraState = "idle" | "requesting" | "live" | "denied";

export interface MotionPressProps {
  palette?: PressPalette;
  lens?: PressLens;
  source?: PressSource;
  threshold?: number;
  decay?: number;
  showBlobs?: boolean;
  showHud?: boolean;
  blobCount?: number;
  speed?: number;
  compact?: boolean;
  className?: string;
  onCameraStateChange?: (state: CameraState) => void;
}

export interface MotionPressHandle {
  capture: () => string;
}

export const MotionPress = forwardRef<MotionPressHandle, MotionPressProps>(
  (
    {
      palette = "riso",
      lens = "overprint",
      source = "scene",
      threshold = DEFAULT_PARAMS.threshold,
      decay = DEFAULT_PARAMS.decay,
      showBlobs = true,
      showHud = true,
      blobCount = DEFAULT_PARAMS.blobCount,
      speed = 1,
      compact = false,
      className,
      onCameraStateChange,
    },
    ref
  ) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const overlayRef = useRef<HTMLCanvasElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const engineRef = useRef<MotionPressEngine | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);

    const params: MotionPressParams = {
      palette,
      lens,
      source,
      threshold,
      decay,
      showBlobs,
      showHud,
      blobCount,
      speed,
      compact,
    };
    const paramsRef = useRef(params);
    paramsRef.current = params;

    useImperativeHandle(ref, () => ({
      capture: () => engineRef.current?.capture() ?? "",
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      if (!canvas || !overlay) return;

      let engine: MotionPressEngine;
      try {
        engine = new MotionPressEngine(canvas, overlay, paramsRef.current);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Motion Press failed to start.");
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
        engineRef.current = null;
      };
    }, []);

    useEffect(() => {
      engineRef.current?.setParams(params);
    }, [palette, lens, source, threshold, decay, showBlobs, showHud, blobCount, speed, compact]);

    const stopStream = useCallback(() => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      engineRef.current?.setVideo(null);
    }, []);

    useEffect(() => {
      let cancelled = false;

      if (source !== "webcam") {
        stopStream();
        onCameraStateChange?.("idle");
        return;
      }

      onCameraStateChange?.("requesting");
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: 640, height: 360 }, audio: false })
        .then((stream) => {
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          streamRef.current = stream;
          const video = videoRef.current;
          if (!video) return;
          video.srcObject = stream;
          void video.play();
          engineRef.current?.setVideo(video);
          onCameraStateChange?.("live");
        })
        .catch(() => {
          if (cancelled) return;
          onCameraStateChange?.("denied");
        });

      return () => {
        cancelled = true;
        stopStream();
      };
    }, [source]);

    useEffect(() => stopStream, [stopStream]);

    const paperCss = PALETTES[palette]?.css.paper ?? "#f2e9d5";

    if (error) {
      return (
        <div
          className={className}
          style={{ background: paperCss }}
        >
          <div className="flex h-full w-full items-center justify-center p-6 text-center font-mono text-[11px] uppercase tracking-widest text-neutral-600">
            {error}
          </div>
        </div>
      );
    }

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
      </div>
    );
  }
);

MotionPress.displayName = "MotionPress";

export default MotionPress;
