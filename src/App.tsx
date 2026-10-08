import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { MetricCards } from './components/MetricCards';
import { CrsCard } from './components/CrsCard';
import { InteractiveMap } from './components/InteractiveMap';
import { FeatureTable } from './components/FeatureTable';
import { FeatureDetailModal } from './components/FeatureDetailModal';
import { RecentFilesTable } from './components/RecentFilesTable';
import { UploadModal } from './components/UploadModal';
import {
  FileRecord,
  MapData,
  FeatureItem,
  MeasurementSummary,
} from './types/geospatial';
import {
  listFiles,
  getFileInfo,
  getFileMeasurements,
  getMapData,
  getFeatures,
  deleteFile,
  getExportUrl
} from './services/api';
import {
  Layers,
  ArrowLeft,
  Download,
  FileCode,
  FileSpreadsheet,
  Globe,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'dashboard' | 'analysis'>('dashboard');
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Active Analysis State
  const [fileRecord, setFileRecord] = useState<FileRecord | null>(null);
  const [summary, setSummary] = useState<MeasurementSummary | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [features, setFeatures] = useState<FeatureItem[]>([]);
  const [selectedFeatureId, setSelectedFeatureId] = useState<number | null>(null);

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Load files list on mount
  const refreshFiles = async () => {
    try {
      const data = await listFiles();
      setFiles(data.files || []);
      // If no active file and files exist, set the first one as active
      if (!activeFileId && data.files && data.files.length > 0) {
        setActiveFileId(data.files[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load files:', err);
    }
  };

  useEffect(() => {
    refreshFiles();
  }, []);

  // Load details for an active file
  const loadAnalysis = async (fileId: string) => {
    setLoadingAnalysis(true);
    setErrorMsg(null);
    try {
      const [info, measRes, mapRes, featRes] = await Promise.all([
        getFileInfo(fileId),
        getFileMeasurements(fileId),
        getMapData(fileId),
        getFeatures(fileId, 0, 500),
      ]);

      setFileRecord(info);
      setSummary(measRes.summary);
      setMapData(mapRes);
      setFeatures(featRes.features);
      setActiveFileId(fileId);
      setView('analysis');
    } catch (err: any) {
      console.error('Failed to load analysis:', err);
      setErrorMsg(err.message || 'Failed to load analysis');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleUploadSuccess = async (fileId: string) => {
    await refreshFiles();
    await loadAnalysis(fileId);
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this analysis?')) return;
    try {
      await deleteFile(fileId);
      if (activeFileId === fileId) {
        setActiveFileId(null);
        setFileRecord(null);
        setSummary(null);
        setMapData(null);
        setFeatures([]);
        setView('dashboard');
      }
      await refreshFiles();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const selectedFeature = features.find((f) => f.feature_id === selectedFeatureId) || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Universal Top Bar Contract */}
      <Header
        activeView={view}
        hasActiveAnalysis={!!fileRecord}
        onNavigate={(v) => setView(v)}
        onOpenUpload={() => setIsUploadModalOpen(true)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Error notification banner */}
        {errorMsg && (
          <div className="p-4 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs text-red-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ----------------- DASHBOARD VIEW ----------------- */}
        {view === 'dashboard' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Hero / Overview Pitch */}
            <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Geospatial Measurement Platform
                </h1>
                <p className="mt-1 text-sm text-slate-400 max-w-2xl">
                  Automated metric polygon area and linestring length analysis for ESRI Shapefiles (.zip) and OGC KML datasets with geodetic CRS detection and optimal UTM reprojection.
                </p>
              </div>

              {activeFileId && (
                <button
                  onClick={() => loadAnalysis(activeFileId)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 rounded-lg transition-colors"
                >
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Return to Active Dataset
                </button>
              )}
            </div>

            {/* Drag & Drop Upload Zone */}
            <Dropzone onUploadSuccess={handleUploadSuccess} />

            {/* Recent Analyses Table */}
            <RecentFilesTable
              files={files}
              activeFileId={activeFileId}
              onSelectFile={(id) => loadAnalysis(id)}
              onDeleteFile={handleDelete}
            />
          </div>
        )}

        {/* ----------------- ACTIVE ANALYSIS VIEW ----------------- */}
        {view === 'analysis' && (
          <div className="space-y-6 animate-fadeIn">
            {loadingAnalysis ? (
              <div className="p-20 text-center space-y-4">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-mono text-slate-400">Loading geospatial data and rendering map...</p>
              </div>
            ) : !fileRecord || !summary ? (
              <div className="p-16 text-center space-y-3 bg-slate-900/40 border border-slate-800 rounded-xl">
                <p className="text-sm text-slate-400">No active file selected for inspection.</p>
                <button
                  onClick={() => setView('dashboard')}
                  className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <>
                {/* Active Analysis Navigation Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setView('dashboard')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Back to Dashboard"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-white tracking-tight truncate max-w-md" title={fileRecord.filename}>
                          {fileRecord.filename}
                        </h2>
                        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                          {fileRecord.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>ID: <code className="text-slate-300">{fileRecord.id}</code></span>
                        <span>·</span>
                        <span>{fileRecord.feature_count} features parsed</span>
                        <span>·</span>
                        <span>{fileRecord.processing_time_ms} ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Export Toolbar */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <a
                      href={getExportUrl(fileRecord.id, 'json')}
                      download
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
                    >
                      <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                      Export JSON
                    </a>
                    <a
                      href={getExportUrl(fileRecord.id, 'csv')}
                      download
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                      Export CSV
                    </a>
                    <a
                      href={getExportUrl(fileRecord.id, 'geojson')}
                      download
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5 text-amber-400" />
                      Export GeoJSON
                    </a>
                  </div>
                </div>

                {/* Metric Summary Cards */}
                <MetricCards
                  summary={summary}
                  processingTimeMs={fileRecord.processing_time_ms}
                />

                {/* CRS Transformation Engine Card */}
                <CrsCard
                  sourceCrs={fileRecord.crs}
                  measurementCrs={fileRecord.measurement_crs}
                  measurementUnits={fileRecord.measurement_units || 'meters'}
                  crsStrategy={summary.crs_strategy}
                />

                {/* Interactive Leaflet Map */}
                <InteractiveMap
                  mapData={mapData}
                  selectedFeatureId={selectedFeatureId}
                  onSelectFeature={(id) => setSelectedFeatureId(id)}
                />

                {/* Tabular Feature Inspection Grid */}
                <FeatureTable
                  fileId={fileRecord.id}
                  features={features}
                  selectedFeatureId={selectedFeatureId}
                  onSelectFeature={(id) => setSelectedFeatureId(id)}
                />
              </>
            )}
          </div>
        )}
      </main>

      {/* Feature Deep Inspection Modal */}
      <FeatureDetailModal
        feature={selectedFeature}
        onClose={() => setSelectedFeatureId(null)}
      />

      {/* Upload Modal (accessible globally) */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
