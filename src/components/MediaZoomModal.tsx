import React from 'react';
import { MediaItem, DocumentItem } from '../types';
import { X, Download, ZoomIn, FileText } from 'lucide-react';

interface MediaZoomModalProps {
  media: MediaItem | null;
  document: DocumentItem | null;
  onClose: () => void;
}

export const MediaZoomModal: React.FC<MediaZoomModalProps> = ({ media, document, onClose }) => {
  if (!media && !document) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/70 backdrop-blur-xs select-none animate-backdrop-enter">
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-modal-enter">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8F9FA]">
          <div>
            <h3 className="text-[16px] font-bold text-neutral-900 truncate">
              {media ? media.title : document?.title}
            </h3>
            <p className="text-[12px] font-mono text-neutral-500">
              {media ? media.filename : document?.filename} • {media?.dateUploaded || document?.dateUploaded}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 p-1.5 rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex items-center justify-center bg-neutral-950">
          {media ? (
            <img
              src={media.url}
              alt={media.title}
              className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-xl"
            />
          ) : (
            <div className="p-8 bg-white rounded-xl max-w-md w-full text-center space-y-4 shadow-xl border border-[#E5E7EB]">
              <span className="material-symbols-outlined text-[64px] text-slate-800">
                picture_as_pdf
              </span>
              <div>
                <h4 className="text-[16px] font-bold text-neutral-900">{document?.title}</h4>
                <p className="text-[12px] text-neutral-500 mt-1 font-mono">
                  File Size: {document?.size} • Type: PDF Evidence
                </p>
              </div>
              <div className="p-3.5 bg-neutral-50 rounded-lg border border-[#E5E7EB] text-[12px] text-neutral-700 text-left">
                <strong className="text-neutral-900 font-semibold">Certified DOJ Document</strong>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Digitally signed and hashed under federal chain of custody protocols.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#E5E7EB] bg-[#F8F9FA] flex justify-between items-center">
          <button
            onClick={() => alert(`Downloading verified copy of ${media?.filename || document?.filename}...`)}
            className="text-[12px] font-semibold text-neutral-700 flex items-center gap-1.5 hover:text-neutral-900 hover:underline cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download High-Res Original</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 text-white text-[12px] font-semibold rounded-lg hover:bg-black cursor-pointer shadow-xs transition-colors"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
