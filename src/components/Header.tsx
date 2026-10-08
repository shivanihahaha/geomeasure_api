import React from 'react';
import { Layers, Upload, FileCode, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  activeView: 'dashboard' | 'analysis';
  hasActiveAnalysis: boolean;
  onNavigate: (view: 'dashboard' | 'analysis') => void;
  onOpenUpload: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  hasActiveAnalysis,
  onNavigate,
  onOpenUpload,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <button
            onClick={() => onNavigate('dashboard')}
            className="text-left font-semibold text-lg tracking-tight text-white hover:text-emerald-400 transition-colors"
          >
            GeoMeasure
          </button>
        </div>

        {/* Zone 2: 4 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`transition-colors hover:text-white ${
              activeView === 'dashboard' ? 'text-emerald-400 font-semibold' : ''
            }`}
          >
            Dashboard
          </button>

          {hasActiveAnalysis && (
            <button
              onClick={() => onNavigate('analysis')}
              className={`transition-colors hover:text-white flex items-center gap-1.5 ${
                activeView === 'analysis' ? 'text-emerald-400 font-semibold' : ''
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Active Analysis
            </button>
          )}

          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white flex items-center gap-1"
          >
            <FileCode className="w-3.5 h-3.5" />
            Swagger API
          </a>
        </nav>

        {/* Zone 3: Primary action button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shadow-sm shadow-emerald-950"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File
          </button>
        </div>
      </div>
    </header>
  );
};
