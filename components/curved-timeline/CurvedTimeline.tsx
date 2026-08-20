import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

export interface TimelineStep {
  id: string | number;
  stepLabel?: string;
  title: string;
  description: string;
  date?: string;
  badge?: string;
}

export interface CurvedTimelineProps {
  items?: TimelineStep[];
  defaultActiveIndex?: number;
  curveOffset?: number;
  activeColor?: string;
  className?: string;
  onStepHover?: (index: number) => void;
}

const DEFAULT_STEPS: TimelineStep[] = [
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

export const CurvedTimeline: React.FC<CurvedTimelineProps> = ({
  items = DEFAULT_STEPS,
  defaultActiveIndex = 2,
  curveOffset = 36,
  activeColor = '#2563eb',
  className = '',
  onStepHover,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(defaultActiveIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [nodePositions, setNodePositions] = useState<number[]>([]);

  // Measure exact Y center positions of each timeline step
  useEffect(() => {
    const updatePositions = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const positions: number[] = [];

      itemRefs.current.forEach((el) => {
        if (el) {
          const rect = el.getBoundingClientRect();
          const yCenter = rect.top - containerRect.top + rect.height / 2;
          positions.push(yCenter);
        }
      });

      if (positions.length > 0) {
        setNodePositions(positions);
      }
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [items]);

  const xMain = 32;
  const xBump = xMain + curveOffset;
  const activeY = nodePositions[activeIndex] ?? (activeIndex + 0.5) * (380 / items.length);

  // Generate localized S-curve path around activeY
  const generatePath = () => {
    const totalHeight = containerRef.current?.getBoundingClientRect().height || 380;

    if (nodePositions.length === 0) {
      return `M ${xMain},0 L ${xMain},${totalHeight}`;
    }

    const y0 = activeY;
    const hCurve = 34;
    const hFlat = 10;

    const yStartCurve = y0 - hFlat - hCurve;
    const yStartFlat = y0 - hFlat;
    const yEndFlat = y0 + hFlat;
    const yEndCurve = y0 + hFlat + hCurve;

    const cp1y = yStartCurve + hCurve * 0.5;
    const cp2y = yStartFlat - hCurve * 0.5;

    const cp3y = yEndFlat + hCurve * 0.5;
    const cp4y = yEndCurve - hCurve * 0.5;

    return `
      M ${xMain},0
      L ${xMain},${Math.max(0, yStartCurve)}
      C ${xMain},${cp1y} ${xBump},${cp2y} ${xBump},${yStartFlat}
      L ${xBump},${yEndFlat}
      C ${xBump},${cp3y} ${xMain},${cp4y} ${xMain},${Math.min(totalHeight, yEndCurve)}
      L ${xMain},${totalHeight}
    `;
  };

  const pathD = generatePath();

  const handleMouseEnter = (index: number) => {
    setActiveIndex(index);
    if (onStepHover) onStepHover(index);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-lg mx-auto py-6 px-2 font-sans select-none ${className}`}
    >
      {/* SVG Layer: Timeline Track + Node Circles */}
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 overflow-visible"
        aria-hidden="true"
      >
        {/* Base vertical line */}
        <line
          x1={xMain}
          y1={0}
          x2={xMain}
          y2="100%"
          stroke="#e2e8f0"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Animated Curved Highlight Track */}
        <motion.path
          d={pathD}
          fill="none"
          stroke={activeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ d: pathD }}
          transition={{
            type: 'spring',
            stiffness: 220,
            damping: 22,
            mass: 0.8,
          }}
        />

        {/* Node Circles */}
        {nodePositions.map((y, idx) => {
          const isActive = activeIndex === idx;
          const cx = isActive ? xBump : xMain;

          return (
            <g key={idx}>
              {/* Outer Dashed Halo Ring */}
              <motion.circle
                cx={cx}
                cy={y}
                r={12}
                fill="white"
                stroke={isActive ? (activeColor === '#000000' || activeColor === '#171717' ? '#94a3b8' : '#93c5fd') : '#cbd5e1'}
                strokeWidth="1"
                strokeDasharray="3 3"
                animate={{ cx, cy: y }}
                transition={{
                  type: 'spring',
                  stiffness: 220,
                  damping: 22,
                }}
              />

              {/* Inner Circle Dot */}
              {isActive ? (
                <motion.circle
                  cx={cx}
                  cy={y}
                  r={7}
                  fill={activeColor}
                  animate={{ cx, cy: y }}
                  transition={{
                    type: 'spring',
                    stiffness: 260,
                    damping: 24,
                  }}
                />
              ) : (
                <motion.circle
                  cx={cx}
                  cy={y}
                  r={5}
                  fill="#cbd5e1"
                  animate={{ cx, cy: y }}
                  transition={{
                    type: 'spring',
                    stiffness: 220,
                    damping: 22,
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Steps List */}
      <div className="relative z-20 flex flex-col space-y-10">
        {items.map((step, idx) => {
          const isActive = activeIndex === idx;

          return (
            <div
              key={step.id}
              ref={(el) => (itemRefs.current[idx] = el)}
              onMouseEnter={() => handleMouseEnter(idx)}
              className="group relative flex items-start cursor-pointer"
            >
              {/* Left Column Spacer for SVG Node */}
              <div className="w-24 h-8 flex-shrink-0" />

              {/* Right Content Area */}
              <motion.div
                className="flex-1 pt-0.5"
                animate={{
                  x: isActive ? 6 : 0,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 280,
                  damping: 24,
                }}
              >
                {step.stepLabel && (
                  <div
                    className={`inline-block mb-1.5 px-2.5 py-0.5 rounded-full border border-dashed text-[11px] font-mono transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-50 border-blue-200 text-blue-600 font-semibold'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-400 group-hover:border-neutral-300 group-hover:text-neutral-600'
                    }`}
                  >
                    {step.stepLabel}
                  </div>
                )}

                <h3
                  className={`text-base font-semibold tracking-tight transition-colors duration-200 ${
                    isActive
                      ? 'text-neutral-900 font-bold'
                      : 'text-neutral-600 group-hover:text-neutral-900'
                  }`}
                >
                  {step.title}
                </h3>

                <p
                  className={`mt-0.5 text-xs sm:text-sm leading-relaxed max-w-md transition-colors duration-200 ${
                    isActive ? 'text-neutral-700' : 'text-neutral-400 group-hover:text-neutral-600'
                  }`}
                >
                  {step.description}
                </p>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CurvedTimeline;
