import React from 'react';
import { X } from 'lucide-react';
import { Dropzone } from './Dropzone';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (fileId: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Upload Geospatial File</h3>
            <p className="text-xs text-slate-400">
              Upload KML or Shapefile ZIP archive for automatic geodesic measurement
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <Dropzone
            onUploadSuccess={(id) => {
              onUploadSuccess(id);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
};
