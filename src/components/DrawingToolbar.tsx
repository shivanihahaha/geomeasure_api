import React from 'react';
import { Ruler, Pentagon, ShieldAlert, Trash2, Check, X } from 'lucide-react';

export type DrawingToolType = 'line' | 'polygon' | 'buffer' | null;

interface DrawingToolbarProps {
  activeTool: DrawingToolType;
  onSelectTool: (tool: DrawingToolType) => void;
  activeMeasurement: {
    pointsCount: number;
    valueFormatted: string;
    secondaryFormatted?: string;
  } | null;
  bufferDistanceM: number;
  onChangeBufferDistance: (dist: number) => void;
  onFinishDrawing: () => void;
  onCancelDrawing: () => void;
  onClearAllDrawn: () => void;
  hasDrawnItems: boolean;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  activeTool,
  onSelectTool,
  activeMeasurement,
  bufferDistanceM,
  onChangeBufferDistance,
  onFinishDrawing,
  onCancelDrawing,
  onClearAllDrawn,
  hasDrawnItems,
}) => {
  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-lg p-1.5 shadow-xl flex flex-wrap items-center gap-1.5 text-xs">
      {/* 1. Distance Ruler */}
      <button
        onClick={() => onSelectTool(activeTool === 'line' ? null : 'line')}
        className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
          activeTool === 'line'
            ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40 shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
        }`}
        title="Measure Distance / Draw Polyline"
      >
        <Ruler className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline">Ruler</span>
      </button>

      {/* 2. Area Polygon */}
      <button
        onClick={() => onSelectTool(activeTool === 'polygon' ? null : 'polygon')}
        className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
          activeTool === 'polygon'
            ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
        }`}
        title="Measure Area / Draw Custom Polygon"
      >
        <Pentagon className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden sm:inline">Area Draw</span>
      </button>

      {/* 3. Parcel Buffer Tool */}
      <button
        onClick={() => onSelectTool(activeTool === 'buffer' ? null : 'buffer')}
        className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
          activeTool === 'buffer'
            ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40 shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
        }`}
        title="Generate Parcel Buffer Zone"
      >
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden sm:inline">Buffer Zone</span>
      </button>

      {/* Buffer Distance Input if tool is buffer */}
      {activeTool === 'buffer' && (
        <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800">
          <span className="text-[11px] text-slate-400">Radius:</span>
          <input
            type="number"
            min={5}
            max={1000}
            step={10}
            value={bufferDistanceM}
            onChange={(e) => onChangeBufferDistance(Math.max(5, parseInt(e.target.value, 10) || 50))}
            className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-xs text-amber-300 focus:outline-none"
          />
          <span className="text-[11px] text-slate-400">m</span>
        </div>
      )}

      {/* Live Measurement feedback when actively drawing */}
      {activeTool && activeMeasurement && activeMeasurement.pointsCount > 0 && (
        <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800 font-mono text-xs">
          <span className="text-slate-400 text-[11px]">{activeMeasurement.pointsCount} pts</span>
          <span className="text-emerald-400 font-bold">{activeMeasurement.valueFormatted}</span>
          {activeMeasurement.secondaryFormatted && (
            <span className="text-slate-400 text-[11px]">({activeMeasurement.secondaryFormatted})</span>
          )}

          {activeMeasurement.pointsCount >= (activeTool === 'line' ? 2 : 3) && (
            <button
              onClick={onFinishDrawing}
              className="p-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors ml-1"
              title="Finish Drawing"
            >
              <Check className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={onCancelDrawing}
            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Cancel"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Clear drawn button */}
      {hasDrawnItems && (
        <button
          onClick={onClearAllDrawn}
          className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
          title="Clear Drawn Layers"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
