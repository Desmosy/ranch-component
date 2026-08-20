import React, { useRef, useState, useEffect } from 'react';
import PixelFireCanvas, { PixelFireCanvasHandle, FirePalette, CellSizeKey, BrushSizeKey } from './PixelFireCanvas';
import { Home, Github, Shuffle, Flame } from 'lucide-react';
import { RANCH_GITHUB_URL } from '../../RanchNavigation';

const PALETTES: FirePalette[] = ['inferno', 'craft', 'cyberpunk', 'toxic', 'plasma', 'monochrome'];

export const PixelFireDemo: React.FC = () => {
  const canvasRef = useRef<PixelFireCanvasHandle>(null);

  const [palette, setPalette] = useState<FirePalette>('inferno');
  const [cellSize, setCellSize] = useState<CellSizeKey>('S');
  const [brushSize, setBrushSize] = useState<BrushSizeKey>('M');

  useEffect(() => {
    const originalBodyCursor = document.body.style.cursor;
    const originalDocCursor = document.documentElement.style.cursor;

    document.body.style.cursor = 'default';
    document.documentElement.style.cursor = 'default';
    document.body.classList.add('force-default-cursor');

    return () => {
      document.body.style.cursor = originalBodyCursor;
      document.documentElement.style.cursor = originalDocCursor;
      document.body.classList.remove('force-default-cursor');
    };
  }, []);

  const handleShufflePalette = () => {
    const nextPalettes = PALETTES.filter((p) => p !== palette);
    const randomNext = nextPalettes[Math.floor(Math.random() * nextPalettes.length)];
    setPalette(randomNext);
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

      {/* Top Navigation */}
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

      {/* Main Canvas Container */}
      <div className="w-full max-w-[84vw] flex-1 min-h-0 flex flex-col bg-white border border-neutral-200/80 rounded-2xl p-2.5 sm:p-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)] my-2 overflow-hidden">
        <div className="relative flex-1 w-full min-h-0 overflow-hidden rounded-xl border border-neutral-200/60 bg-white">
          <PixelFireCanvas
            ref={canvasRef}
            cellSize={cellSize}
            brushSize={brushSize}
            palette={palette}
          />
        </div>

        {/* Minimal Toolbar Controls */}
        <div className="flex-none flex flex-wrap items-center justify-between gap-3 px-2 pt-3 pb-1">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-sans">
            <span className="font-sans text-[13px] font-medium text-neutral-900 tracking-tight flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
              Craft Pixel Fire
            </span>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden sm:block" />

            {/* Grid Size */}
            <div className="flex items-center gap-1 text-[12px] text-neutral-500 font-medium">
              <span className="text-neutral-400 hidden lg:inline mr-1">Grid:</span>
              {(['S', 'M', 'L'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setCellSize(k)}
                  className={`px-2 py-0.5 rounded-md text-xs font-sans transition-colors ${
                    cellSize === k
                      ? 'bg-neutral-900 text-white font-medium shadow-sm'
                      : 'bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden md:block" />

            {/* Brush Size */}
            <div className="flex items-center gap-1 text-[12px] text-neutral-500 font-medium">
              <span className="text-neutral-400 hidden lg:inline mr-1">Brush:</span>
              {(['S', 'M', 'L'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBrushSize(b)}
                  className={`px-2 py-0.5 rounded-md text-xs font-sans transition-colors ${
                    brushSize === b
                      ? 'bg-neutral-900 text-white font-medium shadow-sm'
                      : 'bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden sm:block" />

            {/* Shuffle Button Only */}
            <button
              onClick={handleShufflePalette}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-sans font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-colors border border-neutral-200/80 shadow-sm"
              title="Shuffle palette & trigger flame wave"
            >
              <Shuffle className="h-3.5 w-3.5 text-neutral-500" />
              Shuffle Palette
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PixelFireDemo;
