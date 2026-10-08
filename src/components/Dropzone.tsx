import React, { useState, useRef } from 'react';
import { Upload, FileUp, Sparkles, AlertCircle, FileArchive, Map } from 'lucide-react';
import { uploadFile, loadSample } from '../services/api';

interface DropzoneProps {
  onUploadSuccess: (fileId: string) => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'kml' && ext !== 'zip') {
      setError(`Unsupported file extension '.${ext}'. GeoMeasure accepts '.kml' or '.zip' Shapefile archives.`);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum supported size is 50 MB.`);
      return;
    }

    try {
      setLoading(true);
      setUploadProgressMsg(`Uploading ${file.name} and executing geospatial projection pipeline...`);
      const res = await uploadFile(file);
      onUploadSuccess(res.id);
    } catch (err: any) {
      setError(err.message || 'File processing failed');
    } finally {
      setLoading(false);
      setUploadProgressMsg('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSample = async (type: 'kml' | 'shapefile') => {
    try {
      setError(null);
      setLoading(true);
      setUploadProgressMsg(`Loading sample ${type === 'kml' ? 'KML agricultural survey' : 'Shapefile cadastral parcels'}...`);
      const res = await loadSample(type);
      onUploadSuccess(res.id);
    } catch (err: any) {
      setError(err.message || 'Failed to load sample dataset');
    } finally {
      setLoading(false);
      setUploadProgressMsg('');
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Drag & Drop Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !loading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-emerald-400 bg-emerald-950/20 shadow-lg shadow-emerald-950/30'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
        } ${loading ? 'opacity-70 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".kml,.zip"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFile(e.target.files[0]);
            }
          }}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-1">
            {loading ? (
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileUp className="w-6 h-6" />
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">
              {loading ? 'Processing Geospatial Data...' : 'Drop your geospatial file here, or browse'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Accepts OGC <span className="text-emerald-400 font-mono">.kml</span> files or ESRI Shapefile packages compressed in <span className="text-emerald-400 font-mono">.zip</span> format.
            </p>
          </div>

          {!loading && (
            <div className="flex items-center gap-2 pt-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Map className="w-3 h-3 text-slate-400" />
                Automatic UTM Projection
              </span>
              <span>·</span>
              <span>Max 50 MB</span>
              <span>·</span>
              <span>Safe Zip Slip Sandbox</span>
            </div>
          )}

          {loading && uploadProgressMsg && (
            <p className="text-xs font-mono text-emerald-400 animate-pulse pt-2">
              {uploadProgressMsg}
            </p>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-red-300 text-xs animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Upload Notice:</span> {error}
          </div>
        </div>
      )}

      {/* Quick Sample Dataset Loaders */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-left">
            <div className="text-xs font-semibold text-white">Don't have a file ready?</div>
            <div className="text-[11px] text-slate-400">
              Explore immediate production benchmarks with pre-built real survey datasets
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => handleSample('kml')}
            disabled={loading}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors border border-slate-700 disabled:opacity-50"
          >
            <Map className="w-3.5 h-3.5 text-emerald-400" />
            Sample KML (Agri Survey)
          </button>
          <button
            onClick={() => handleSample('shapefile')}
            disabled={loading}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors border border-slate-700 disabled:opacity-50"
          >
            <FileArchive className="w-3.5 h-3.5 text-cyan-400" />
            Sample Shapefile ZIP (Parcels)
          </button>
        </div>
      </div>
    </div>
  );
};
