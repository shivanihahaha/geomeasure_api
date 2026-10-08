import React, { useState } from 'react';
import { MeasurementSummary } from '../types/geospatial';
import { Square, Activity, MapPin, Gauge } from 'lucide-react';

interface MetricCardsProps {
  summary: MeasurementSummary;
  processingTimeMs?: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ summary, processingTimeMs }) => {
  const [areaUnit, setAreaUnit] = useState<'m2' | 'ha' | 'km2' | 'acres'>('ha');
  const [lengthUnit, setLengthUnit] = useState<'m' | 'km' | 'ft' | 'miles'>('km');

  const getFormattedArea = () => {
    switch (areaUnit) {
      case 'm2':
        return `${summary.total_area_m2.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²`;
      case 'km2':
        return `${summary.total_area_km2.toLocaleString(undefined, { maximumFractionDigits: 4 })} km²`;
      case 'acres':
        return `${summary.total_area_acres.toLocaleString(undefined, { maximumFractionDigits: 2 })} ac`;
      case 'ha':
      default:
        return `${summary.total_area_ha.toLocaleString(undefined, { maximumFractionDigits: 3 })} ha`;
    }
  };

  const getFormattedLength = () => {
    switch (lengthUnit) {
      case 'm':
        return `${summary.total_length_m.toLocaleString(undefined, { maximumFractionDigits: 1 })} m`;
      case 'ft':
        return `${summary.total_length_ft.toLocaleString(undefined, { maximumFractionDigits: 1 })} ft`;
      case 'miles':
        return `${summary.total_length_miles.toLocaleString(undefined, { maximumFractionDigits: 3 })} mi`;
      case 'km':
      default:
        return `${summary.total_length_km.toLocaleString(undefined, { maximumFractionDigits: 3 })} km`;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Features */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Total Features</span>
          <Gauge className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
          {summary.total_features.toLocaleString()}
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
          <span>{summary.polygon_count} Polygons</span>
          <span aria-hidden="true">·</span>
          <span>{summary.linestring_count} Lines</span>
          <span aria-hidden="true">·</span>
          <span>{summary.point_count} Points</span>
        </div>
      </div>

      {/* 2. Total Area */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Total Area (Polygons)</span>
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-md border border-slate-800 text-[10px]">
            <button
              onClick={() => setAreaUnit('ha')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                areaUnit === 'ha' ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              ha
            </button>
            <button
              onClick={() => setAreaUnit('m2')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                areaUnit === 'm2' ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              m²
            </button>
            <button
              onClick={() => setAreaUnit('km2')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                areaUnit === 'km2' ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              km²
            </button>
            <button
              onClick={() => setAreaUnit('acres')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                areaUnit === 'acres' ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              ac
            </button>
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight text-emerald-400 font-mono tabular-nums">
          {getFormattedArea()}
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Calculated via projected CRS ({summary.measurement_crs})
        </div>
      </div>

      {/* 3. Total Length */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Total Length (Lines)</span>
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-md border border-slate-800 text-[10px]">
            <button
              onClick={() => setLengthUnit('km')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                lengthUnit === 'km' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              km
            </button>
            <button
              onClick={() => setLengthUnit('m')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                lengthUnit === 'm' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              m
            </button>
            <button
              onClick={() => setLengthUnit('miles')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                lengthUnit === 'miles' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              mi
            </button>
            <button
              onClick={() => setLengthUnit('ft')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                lengthUnit === 'ft' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              ft
            </button>
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight text-cyan-400 font-mono tabular-nums">
          {getFormattedLength()}
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Metric Euclidean sum across {summary.linestring_count} lines
        </div>
      </div>

      {/* 4. Processing Time & Sites */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Execution Latency</span>
          <Activity className="w-4 h-4 text-slate-400" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
          {processingTimeMs !== undefined ? `${processingTimeMs} ms` : 'Ready'}
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
          <span>{summary.point_count} coordinate control sites</span>
        </div>
      </div>
    </div>
  );
};
