import React from 'react';
import { FeatureItem } from '../types/geospatial';
import { X, Layers, Compass, CheckCircle } from 'lucide-react';

interface FeatureDetailModalProps {
  feature: FeatureItem | null;
  onClose: () => void;
}

export const FeatureDetailModal: React.FC<FeatureDetailModalProps> = ({
  feature,
  onClose,
}) => {
  if (!feature) return null;

  const m = feature.measurement;
  const p = feature.properties || {};
  const propEntries = Object.entries(p);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Feature Inspection #{feature.feature_id}
              </h3>
              <p className="text-xs text-slate-400">
                {feature.geometry_type} · Status: {feature.measurement_status}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Measurement Breakdown */}
          {m ? (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white">
                  Calculated {m.type === 'AREA' ? 'Polygon Area' : 'LineString Length'}
                </span>
                <span className="font-mono text-xs text-emerald-400 font-bold">
                  {m.formatted}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mb-3">
                Canonical SI base: <span className="font-mono text-slate-200">{m.value} {m.unit}</span>
              </div>

              {m.conversions && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80">
                  {Object.entries(m.conversions).map(([key, conv]) => (
                    <div key={key} className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-center">
                      <div className="text-[10px] text-slate-400 uppercase font-medium">{key}</div>
                      <div className="font-mono text-xs font-semibold text-white mt-0.5">
                        {conv.formatted}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-slate-400">
              {feature.geometry_type === 'Point' || feature.geometry_type === 'MultiPoint' ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Point geometries represent discrete coordinate locations (measurements not applicable).</span>
                </div>
              ) : (
                <div>Measurement status: {feature.measurement_status}</div>
              )}
            </div>
          )}

          {/* Projection Context */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase font-medium">Source CRS</div>
              <div className="font-mono text-xs text-slate-200 mt-1">{feature.crs}</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
              <div className="text-[10px] text-slate-500 uppercase font-medium">Measurement CRS</div>
              <div className="font-mono text-xs text-emerald-400 mt-1">{feature.measurement_crs}</div>
            </div>
          </div>

          {/* Properties / Attributes */}
          <div>
            <div className="text-xs font-semibold text-white mb-2 flex items-center justify-between">
              <span>Feature Attributes &amp; Extended Data</span>
              <span className="text-[11px] text-slate-500 font-normal">
                {propEntries.length} attributes detected
              </span>
            </div>

            {propEntries.length === 0 ? (
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-slate-500 text-center">
                No custom attribute tags found for this feature.
              </div>
            ) : (
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/90 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2 px-3 font-medium">Property Key</th>
                      <th className="py-2 px-3 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {propEntries.map(([k, val]) => (
                      <tr key={k} className="hover:bg-slate-800/30">
                        <td className="py-1.5 px-3 font-sans text-slate-400 font-medium">{k}</td>
                        <td className="py-1.5 px-3 text-slate-200 break-all">
                          {val !== null ? String(val) : '<null>'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Raw GeoJSON Preview */}
          <div>
            <div className="text-xs font-semibold text-white mb-2">Raw GeoJSON Geometry Object</div>
            <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-36">
              {JSON.stringify(feature.geometry, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
