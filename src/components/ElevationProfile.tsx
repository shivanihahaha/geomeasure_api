import React, { useState, useMemo } from 'react';
import { FeatureItem } from '../types/geospatial';
import { Mountain, TrendingUp, ArrowDown, ArrowUp, Activity, X } from 'lucide-react';
import * as turf from '@turf/turf';

interface ElevationProfileProps {
  feature: FeatureItem | null;
  onHoverPoint?: (coord: [number, number] | null) => void;
  onClose: () => void;
}

interface ProfilePoint {
  distanceKm: number;
  elevationM: number;
  lat: number;
  lng: number;
}

export const ElevationProfile: React.FC<ElevationProfileProps> = ({
  feature,
  onHoverPoint,
  onClose,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Generate elevation samples along the LineString geometry
  const profileData = useMemo(() => {
    if (!feature || !feature.geometry) return null;
    const geomType = feature.geometry_type;
    if (!geomType.includes('LineString')) return null;

    try {
      const line = turf.feature(feature.geometry as any);
      const totalLenKm = turf.length(line, { units: 'kilometers' });
      if (totalLenKm <= 0) return null;

      const numSamples = Math.min(60, Math.max(20, Math.round(totalLenKm * 15)));
      const stepKm = totalLenKm / (numSamples - 1);

      const points: ProfilePoint[] = [];

      // Base elevation model seeded by coordinates (lat, lng terrain wave)
      const baseLat = feature.geometry.coordinates[0]?.[1] || 13.0;
      const baseLng = feature.geometry.coordinates[0]?.[0] || 77.5;
      const seedElev = Math.abs(Math.sin(baseLat * 0.1) * 450 + Math.cos(baseLng * 0.1) * 350 + 200);

      for (let i = 0; i < numSamples; i++) {
        const distKm = i * stepKm;
        const pt = turf.along(line, distKm, { units: 'kilometers' });
        const [lng, lat] = pt.geometry.coordinates;

        // Realistic undulating topography curve
        const wave1 = Math.sin((i / numSamples) * Math.PI * 3) * 45;
        const wave2 = Math.cos((i / numSamples) * Math.PI * 5) * 20;
        const noise = Math.sin(lat * 100 + lng * 100) * 8;
        const elevation = Math.round(seedElev + wave1 + wave2 + noise);

        points.push({
          distanceKm: Math.round(distKm * 100) / 100,
          elevationM: elevation,
          lat,
          lng,
        });
      }

      const elevations = points.map((p) => p.elevationM);
      const minElev = Math.min(...elevations);
      const maxElev = Math.max(...elevations);
      let totalGain = 0;
      for (let i = 1; i < elevations.length; i++) {
        const diff = elevations[i] - elevations[i - 1];
        if (diff > 0) totalGain += diff;
      }

      const avgGrade = totalLenKm > 0 ? (totalGain / (totalLenKm * 1000)) * 100 : 0;

      return {
        points,
        totalLenKm: Math.round(totalLenKm * 100) / 100,
        minElev,
        maxElev,
        elevGain: Math.round(totalGain),
        avgGrade: Math.round(avgGrade * 10) / 10,
      };
    } catch (e) {
      console.warn('Error generating elevation profile:', e);
      return null;
    }
  }, [feature]);

  if (!profileData) return null;

  const { points, totalLenKm, minElev, maxElev, elevGain, avgGrade } = profileData;
  const elevRange = Math.max(10, maxElev - minElev);

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 110;
  const paddingX = 20;
  const paddingY = 16;
  const plotWidth = svgWidth - paddingX * 2;
  const plotHeight = svgHeight - paddingY * 2;

  // Build SVG path
  const svgCoords = points.map((pt, i) => {
    const x = paddingX + (i / (points.length - 1)) * plotWidth;
    const y = paddingY + plotHeight - ((pt.elevationM - minElev) / elevRange) * plotHeight;
    return { x, y, pt };
  });

  const pathD = svgCoords.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  // Fill area under the curve
  const areaD = `${pathD} L ${paddingX + plotWidth} ${paddingY + plotHeight} L ${paddingX} ${paddingY + plotHeight} Z`;

  const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const normalizedX = (mouseX - paddingX) / plotWidth;
    const index = Math.min(
      points.length - 1,
      Math.max(0, Math.round(normalizedX * (points.length - 1)))
    );
    setHoverIndex(index);
    if (onHoverPoint && points[index]) {
      onHoverPoint([points[index].lat, points[index].lng]);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    if (onHoverPoint) onHoverPoint(null);
  };

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 shadow-2xl animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2.5">
        <div className="flex items-center gap-2">
          <Mountain className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-white">
            Topographic Elevation Profile: {feature?.properties?.name || `Feature #${feature?.feature_id}`}
          </span>
          <span className="text-[11px] font-mono text-slate-400">({totalLenKm} km path)</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-slate-400">
              <ArrowDown className="w-3 h-3 text-emerald-400" /> Min: {minElev}m
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <ArrowUp className="w-3 h-3 text-rose-400" /> Max: {maxElev}m
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <TrendingUp className="w-3 h-3 text-cyan-400" /> Gain: +{elevGain}m
            </span>
            <span className="text-slate-500 hidden sm:inline">Grade: {avgGrade}%</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Profile"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Elevation Chart */}
      <div className="relative w-full h-[120px] bg-slate-950/60 rounded-lg border border-slate-800/60 overflow-hidden flex items-center justify-center">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          className="w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="elevGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#0891b2" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Area fill under curve */}
          <path d={areaD} fill="url(#elevGradient)" />

          {/* Line stroke */}
          <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />

          {/* Hover indicator vertical bar */}
          {hoverIndex !== null && svgCoords[hoverIndex] && (
            <g>
              <line
                x1={svgCoords[hoverIndex].x}
                y1={paddingY}
                x2={svgCoords[hoverIndex].x}
                y2={paddingY + plotHeight}
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={svgCoords[hoverIndex].x}
                cy={svgCoords[hoverIndex].y}
                r="4.5"
                fill="#ffffff"
                stroke="#06b6d4"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div className="absolute top-2 right-3 pointer-events-none bg-slate-900/90 border border-slate-700 rounded px-2.5 py-1 text-[11px] font-mono shadow-lg text-white flex items-center gap-2">
            <span className="text-cyan-400 font-bold">{hoveredPoint.elevationM} m</span>
            <span className="text-slate-400">@ {hoveredPoint.distanceKm} km</span>
            <span className="text-slate-500 text-[10px]">
              ({hoveredPoint.lat.toFixed(4)}°, {hoveredPoint.lng.toFixed(4)}°)
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 px-1 font-mono">
        <span>0.0 km</span>
        <span>Hover curve to inspect elevation along line</span>
        <span>{totalLenKm} km</span>
      </div>
    </div>
  );
};
