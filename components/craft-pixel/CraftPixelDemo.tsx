import React, { useRef, useState, useEffect } from 'react';
import CraftPixelCanvas, { CraftPixelCanvasHandle, PixelDesign } from './CraftPixelCanvas';
import { Home, Github, Shuffle, Zap, Trash2 } from 'lucide-react';
import { RANCH_GITHUB_URL } from '../../RanchNavigation';

export const CraftPixelDemo: React.FC = () => {
  const canvasRef = useRef<CraftPixelCanvasHandle>(null);

  const [design, setDesign] = useState<PixelDesign>('wiener');
  const [cellSize, setCellSize] = useState<'S' | 'M' | 'L'>('S');
  const [brushSize, setBrushSize] = useState<'S' | 'M' | 'L'>('M');

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

  const handleRandomize = () => {
    const designs: PixelDesign[] = ['wiener', 'pacman', 'heart', 'rings', 'marquee'];
    const keys: ('S' | 'M' | 'L')[] = ['S', 'M', 'L'];
    setDesign(designs[Math.floor(Math.random() * designs.length)]);
    setCellSize(keys[Math.floor(Math.random() * keys.length)]);
    setBrushSize(keys[Math.floor(Math.random() * keys.length)]);
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

      <div className="w-full max-w-[84vw] flex-1 min-h-0 flex flex-col bg-white border border-neutral-200/80 rounded-2xl p-2.5 sm:p-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)] my-2 overflow-hidden">
        <div className="relative flex-1 w-full min-h-0 overflow-hidden rounded-xl border border-neutral-200/60 bg-white">
          <CraftPixelCanvas ref={canvasRef} cellSize={cellSize} brushSize={brushSize} design={design} />
        </div>

        <div className="flex-none flex flex-wrap items-center justify-between gap-3 px-2 pt-3 pb-1">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-sans">
            <span className="font-sans text-[13px] font-medium text-neutral-900 tracking-tight">
              Craft Pixel Art
            </span>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden sm:block" />

            <div className="flex items-center gap-1 text-[12px] text-neutral-500 font-medium">
              <span className="text-neutral-400 hidden lg:inline mr-1">Design:</span>
              {(['wiener', 'pacman', 'heart', 'rings', 'marquee'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDesign(d)}
                  className={`px-2 py-0.5 rounded-md text-xs font-sans capitalize transition-colors ${
                    design === d
                      ? 'bg-neutral-900 text-white font-medium shadow-sm'
                      : 'bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden md:block" />

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

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden sm:block" />

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRandomize}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-sans font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-colors border border-neutral-200/80 shadow-sm"
                title="Randomize design & grid"
              >
                <Shuffle className="h-3 w-3 text-neutral-500" />
                Randomize
              </button>
              <button
                onClick={() => canvasRef.current?.triggerShockwave(undefined, undefined, 2.2)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-sans font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                title="Trigger radial shockwave"
              >
                <Zap className="h-3 w-3" />
                Blast
              </button>
              <button
                onClick={() => canvasRef.current?.clearGrid()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-sans font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 transition-colors border border-neutral-200/60"
                title="Clear heat grid"
              >
                <Trash2 className="h-3 w-3 text-neutral-400" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CraftPixelDemo;
