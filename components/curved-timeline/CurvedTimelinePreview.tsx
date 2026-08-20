import React, { useState, useEffect } from 'react';
import CurvedTimeline, { TimelineStep } from './CurvedTimeline';
import { Home, Github } from 'lucide-react';
import { RANCH_GITHUB_URL } from '../../RanchNavigation';

const SAMPLE_STEPS: TimelineStep[] = [
  {
    id: 1,
    title: 'Project Kickoff',
    description: 'Define goals and gather requirements.',
  },
  {
    id: 2,
    title: 'Planning',
    description: 'Create the roadmap and strategy.',
  },
  {
    id: 3,
    title: 'Design & Build',
    description: 'Design, develop, and iterate.',
  },
  {
    id: 4,
    title: 'Launch',
    description: 'Test, deploy, and provide support.',
  },
];

const COLOR_OPTIONS = [
  { label: 'Blue', value: '#2563eb' },
  { label: 'Black', value: '#171717' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Rose', value: '#f43f5e' },
];

export const CurvedTimelinePreview: React.FC = () => {
  const [activeColor, setActiveColor] = useState<string>('#2563eb');
  const [curveOffset, setCurveOffset] = useState<number>(36);

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

      {/* Main Container */}
      <div className="w-full max-w-[84vw] flex-1 min-h-0 flex flex-col bg-white border border-neutral-200/80 rounded-2xl p-2.5 sm:p-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)] my-2 overflow-hidden">
        <div className="relative flex-1 w-full min-h-0 overflow-y-auto rounded-xl border border-neutral-200/60 bg-white flex items-center justify-center p-4">
          <CurvedTimeline
            items={SAMPLE_STEPS}
            defaultActiveIndex={2}
            activeColor={activeColor}
            curveOffset={curveOffset}
          />
        </div>

        {/* Toolbar Controls */}
        <div className="flex-none flex flex-wrap items-center justify-between gap-3 px-2 pt-3 pb-1">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-sans">
            <span className="font-sans text-[13px] font-medium text-neutral-900 tracking-tight">
              Curved Hover Timeline
            </span>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden sm:block" />

            {/* Color buttons */}
            <div className="flex items-center gap-1 text-[12px] text-neutral-500 font-medium">
              <span className="text-neutral-400 hidden lg:inline mr-1">Color:</span>
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setActiveColor(c.value)}
                  className={`px-2 py-0.5 rounded-md text-xs font-sans capitalize transition-colors ${
                    activeColor === c.value
                      ? 'bg-neutral-900 text-white font-medium shadow-sm'
                      : 'bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="h-3.5 w-[1px] bg-neutral-200 hidden md:block" />

            {/* Curve Offset Slider */}
            <div className="flex items-center gap-2 text-[12px] text-neutral-500 font-medium">
              <span className="text-neutral-400 hidden lg:inline mr-1">Offset:</span>
              <input
                type="range"
                min="20"
                max="52"
                step="2"
                value={curveOffset}
                onChange={(e) => setCurveOffset(Number(e.target.value))}
                className="w-20 sm:w-28 h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-900"
              />
              <span className="text-neutral-700 font-mono text-xs">{curveOffset}px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurvedTimelinePreview;
