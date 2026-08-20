import React, { useRef } from 'react';
import PixelFireCanvas, { PixelFireCanvasHandle, FirePalette, CellSizeKey } from './PixelFireCanvas';
import { Flame, Shuffle, Zap, Trash2 } from 'lucide-react';

export interface PixelFireFooterProps {
  palette?: FirePalette;
  cellSize?: CellSizeKey;
  className?: string;
}

export const PixelFireFooter: React.FC<PixelFireFooterProps> = ({
  palette = 'inferno',
  cellSize = 'S',
  className = '',
}) => {
  const canvasRef = useRef<PixelFireCanvasHandle>(null);

  return (
    <footer className={`relative w-full h-[320px] bg-white border-t border-neutral-200/80 overflow-hidden font-sans ${className}`}>
      <PixelFireCanvas
        ref={canvasRef}
        palette={palette}
        cellSize={cellSize}
        className="w-full h-full"
      />

      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-neutral-200 shadow-sm backdrop-blur-md text-xs font-sans font-medium text-neutral-800">
          <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span>Interactive Craft Pixel Fire</span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => canvasRef.current?.triggerShockwave()}
            className="px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-sans font-medium shadow-sm transition-colors flex items-center gap-1"
          >
            <Zap className="w-3 h-3" />
            Blast
          </button>
          <button
            onClick={() => canvasRef.current?.randomize()}
            className="px-3 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-sans font-medium border border-neutral-200/80 shadow-sm transition-colors flex items-center gap-1"
          >
            <Shuffle className="w-3 h-3 text-neutral-500" />
            Randomize
          </button>
          <button
            onClick={() => canvasRef.current?.clearGrid()}
            className="px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-sans font-medium border border-neutral-200/60 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3 text-neutral-400" />
            Clear
          </button>
        </div>
      </div>
    </footer>
  );
};

export default PixelFireFooter;
