import React from 'react';
import { FileRecord } from '../types/geospatial';
import {
  FileText,
  Clock,
  Trash2,
  ExternalLink,
  Download,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { getExportUrl } from '../services/api';

interface RecentFilesTableProps {
  files: FileRecord[];
  activeFileId: string | null;
  onSelectFile: (id: string) => void;
  onDeleteFile: (id: string) => void;
}

export const RecentFilesTable: React.FC<RecentFilesTableProps> = ({
  files,
  activeFileId,
  onSelectFile,
  onDeleteFile,
}) => {
  if (files.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
        <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="font-medium text-slate-400">No geospatial analyses recorded yet</p>
        <p className="mt-1 text-slate-500">
          Upload a .kml or Shapefile .zip above or load one of the test benchmark datasets.
        </p>
      </div>
    );
  }

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Geospatial Processing History</h3>
        <span className="text-xs text-slate-400 font-mono">{files.length} records</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium">
              <th className="py-2.5 px-4">Filename</th>
              <th className="py-2.5 px-4">Features</th>
              <th className="py-2.5 px-4">Source CRS</th>
              <th className="py-2.5 px-4">Projected Measurement CRS</th>
              <th className="py-2.5 px-4">Processed Date</th>
              <th className="py-2.5 px-4">Latency</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
            {files.map((f) => {
              const isActive = f.id === activeFileId;
              return (
                <tr
                  key={f.id}
                  className={`transition-colors ${
                    isActive
                      ? 'bg-emerald-950/30 text-white font-medium'
                      : 'hover:bg-slate-800/30'
                  }`}
                >
                  <td className="py-2.5 px-4 font-sans font-medium text-white max-w-[220px] truncate" title={f.filename}>
                    <div className="flex items-center gap-2">
                      {f.status === 'COMPLETED' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      )}
                      <span className="truncate">{f.filename}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-emerald-400 font-semibold">
                    {f.feature_count.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 max-w-[120px] truncate" title={f.crs}>
                    {f.crs}
                  </td>
                  <td className="py-2.5 px-4 text-slate-200 max-w-[140px] truncate" title={f.measurement_crs}>
                    {f.measurement_crs}
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-400">
                    {formatDate(f.created_at)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400">
                    {f.processing_time_ms} ms
                  </td>
                  <td className="py-2.5 px-4 text-right font-sans">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onSelectFile(f.id)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                        title="View Full Analysis"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={getExportUrl(f.id, 'geojson')}
                        download
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                        title="Export GeoJSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => onDeleteFile(f.id)}
                        className="p-1 rounded hover:bg-red-950/60 text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
