import React from 'react';
import { Compass, Info, ArrowRight } from 'lucide-react';

interface CrsCardProps {
  sourceCrs: string;
  measurementCrs: string;
  measurementUnits: string;
  crsStrategy?: string;
}

export const CrsCard: React.FC<CrsCardProps> = ({
  sourceCrs,
  measurementCrs,
  measurementUnits,
  crsStrategy,
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Geodetic &amp; Projected Transformation Pipeline</h3>
        </div>
        <span className="text-xs text-slate-400">Strict Metric Compliance</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Source CRS */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400 mb-1">Source CRS</div>
          <div className="font-mono text-sm font-semibold text-slate-200 truncate" title={sourceCrs}>
            {sourceCrs}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Geographic Degrees (Angular)</div>
        </div>

        {/* Projection Arrow */}
        <div className="flex flex-col items-center justify-center py-2 text-center">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-1">
            <span>Dynamic Reprojection</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
          <div className="text-[11px] text-slate-400 max-w-xs truncate" title={crsStrategy}>
            {crsStrategy || 'Auto-selected optimal UTM projection'}
          </div>
        </div>

        {/* Measurement CRS */}
        <div className="bg-slate-950/80 border border-emerald-900/40 rounded-lg p-3 bg-gradient-to-br from-emerald-950/20 to-slate-950/60">
          <div className="text-[11px] font-medium text-emerald-400 mb-1">Measurement CRS (Projected)</div>
          <div className="font-mono text-sm font-semibold text-white truncate" title={measurementCrs}>
            {measurementCrs}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Standard Unit: <span className="text-emerald-300 font-mono">{measurementUnits}</span> (Metric SI)
          </div>
        </div>
      </div>

      {/* Geodesy Rigor Note */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-start gap-2.5 text-xs text-slate-400">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="text-slate-300 font-medium">Why Projection Is Mandatory:</span> Calculating area or distance directly on spherical latitude/longitude degrees (e.g. EPSG:4326) yields distorted, meaningless square degrees (deg²). GeoMeasure isolates the dataset's centroid, computes the true local UTM zone, reprojects through PyProj, and executes Euclidean metric geometry on Cartesian coordinates.
        </p>
      </div>
    </div>
  );
};
