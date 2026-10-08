import React, { useState, useMemo } from 'react';
import { FeatureItem } from '../types/geospatial';
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  FileSpreadsheet,
  FileCode,
  Globe
} from 'lucide-react';
import { getExportUrl } from '../services/api';

interface FeatureTableProps {
  fileId: string;
  features: FeatureItem[];
  selectedFeatureId: number | null;
  onSelectFeature: (id: number) => void;
}

export const FeatureTable: React.FC<FeatureTableProps> = ({
  fileId,
  features,
  selectedFeatureId,
  onSelectFeature,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'id' | 'type' | 'measurement'>('id');
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter & Search
  const filteredFeatures = useMemo(() => {
    return features.filter((f) => {
      // Type filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'polygon' && !f.geometry_type.includes('Polygon')) return false;
        if (typeFilter === 'linestring' && !f.geometry_type.includes('LineString')) return false;
        if (typeFilter === 'point' && !f.geometry_type.includes('Point')) return false;
      }

      // Search term
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();

      if (String(f.feature_id).includes(s)) return true;
      if (f.geometry_type.toLowerCase().includes(s)) return true;

      // Search inside properties
      for (const val of Object.values(f.properties || {})) {
        if (val && String(val).toLowerCase().includes(s)) return true;
      }

      return false;
    });
  }, [features, typeFilter, searchTerm]);

  // Sort
  const sortedFeatures = useMemo(() => {
    return [...filteredFeatures].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'id') {
        cmp = a.feature_id - b.feature_id;
      } else if (sortField === 'type') {
        cmp = a.geometry_type.localeCompare(b.geometry_type);
      } else if (sortField === 'measurement') {
        const valA = a.measurement?.value ?? -1;
        const valB = b.measurement?.value ?? -1;
        cmp = valA - valB;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredFeatures, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(sortedFeatures.length / pageSize) || 1;
  const paginatedFeatures = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFeatures.slice(start, start + pageSize);
  }, [sortedFeatures, currentPage, pageSize]);

  const handleSort = (field: 'id' | 'type' | 'measurement') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getFeatureName = (f: FeatureItem): string => {
    const p = f.properties || {};
    return p.name || p.NAME || p.Name || p.label || p.PARCEL_ID || `Feature #${f.feature_id}`;
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search features by name, attribute, or index..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filter Tabs & Export buttons */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-3">
          {/* Segmented Filter Control */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => {
                setTypeFilter('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                typeFilter === 'all'
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({features.length})
            </button>
            <button
              onClick={() => {
                setTypeFilter('polygon');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                typeFilter === 'polygon'
                  ? 'bg-slate-800 text-emerald-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Polygons
            </button>
            <button
              onClick={() => {
                setTypeFilter('linestring');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                typeFilter === 'linestring'
                  ? 'bg-slate-800 text-cyan-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Lines
            </button>
            <button
              onClick={() => {
                setTypeFilter('point');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                typeFilter === 'point'
                  ? 'bg-slate-800 text-amber-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Points
            </button>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-1.5">
            <a
              href={getExportUrl(fileId, 'json')}
              download
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-md transition-colors border border-slate-700"
              title="Download Full JSON"
            >
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              JSON
            </a>
            <a
              href={getExportUrl(fileId, 'csv')}
              download
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-md transition-colors border border-slate-700"
              title="Download CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              CSV
            </a>
            <a
              href={getExportUrl(fileId, 'geojson')}
              download
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-md transition-colors border border-slate-700"
              title="Download GeoJSON"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              GeoJSON
            </a>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium select-none">
              <th
                onClick={() => handleSort('id')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
              >
                ID {sortField === 'id' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="py-3 px-4">Name / Identifier</th>
              <th
                onClick={() => handleSort('type')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
              >
                Geometry Type {sortField === 'type' && (sortAsc ? '↑' : '↓')}
              </th>
              <th
                onClick={() => handleSort('measurement')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
              >
                Calculated Metric {sortField === 'measurement' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="py-3 px-4">Converted Units</th>
              <th className="py-3 px-4 text-center">Attributes</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
            {paginatedFeatures.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                  No features found matching the current search query or filter.
                </td>
              </tr>
            ) : (
              paginatedFeatures.map((f) => {
                const isSelected = f.feature_id === selectedFeatureId;
                const m = f.measurement;
                const name = getFeatureName(f);
                const propCount = Object.keys(f.properties || {}).length;

                return (
                  <tr
                    key={f.feature_id}
                    onClick={() => onSelectFeature(f.feature_id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-950/40 text-white font-medium'
                        : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <td className="py-2.5 px-4 text-slate-400">#{f.feature_id}</td>
                    <td className="py-2.5 px-4 font-sans font-medium text-white max-w-[200px] truncate" title={name}>
                      {name}
                    </td>
                    <td className="py-2.5 px-4 font-sans">
                      <span
                        className={`text-xs ${
                          f.geometry_type.includes('Polygon')
                            ? 'text-emerald-400'
                            : f.geometry_type.includes('LineString')
                            ? 'text-cyan-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {f.geometry_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      {m ? (
                        <span className="font-semibold text-emerald-400 font-mono">
                          {m.formatted}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-sans text-[11px]">
                          {f.measurement_status === 'NOT_APPLICABLE' ? 'Point (N/A)' : 'Unsupported'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-xs text-slate-400">
                      {m?.conversions ? (
                        <span>
                          {m.type === 'AREA'
                            ? `${m.conversions.ha?.formatted || ''} · ${m.conversions.acres?.formatted || ''}`
                            : `${m.conversions.km?.formatted || ''} · ${m.conversions.ft?.formatted || ''}`}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center font-sans text-slate-400 text-xs">
                      {propCount} keys
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectFeature(f.feature_id);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div>
          Showing {sortedFeatures.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
          {Math.min(currentPage * pageSize, sortedFeatures.length)} of {sortedFeatures.length} features
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono tabular-nums">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
