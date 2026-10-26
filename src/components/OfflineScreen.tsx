import React, { useState } from 'react';
import { WifiOff, RefreshCw, Database } from 'lucide-react';

interface OfflineScreenProps {
  onRetry: () => void;
  onWorkOffline: () => void;
}

export const OfflineScreen: React.FC<OfflineScreenProps> = ({ onRetry, onWorkOffline }) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryClick = () => {
    setIsRetrying(true);
    setTimeout(() => {
      setIsRetrying(false);
      onRetry();
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans select-none text-neutral-900">
      {/* Subtle Background Pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Central Content Container */}
      <div className="max-w-[440px] w-full bg-white border border-[#E5E7EB] rounded-2xl p-8 md:p-10 flex flex-col items-center text-center relative z-10 shadow-xs">
        {/* Radar Icon */}
        <div className="relative w-20 h-20 rounded-2xl bg-neutral-100 border border-[#E5E7EB] flex items-center justify-center text-slate-800 mb-6">
          <span className="material-symbols-outlined text-[36px] relative z-10 text-slate-900">
            wifi_off
          </span>
        </div>

        {/* Typography */}
        <h1 className="text-[22px] md:text-[26px] font-bold text-neutral-900 mb-2 tracking-tight">
          No Network Connection
        </h1>
        <p className="text-[14px] text-neutral-500 mb-8 max-w-[320px] leading-relaxed">
          You are currently offline. Local criminal records cache remains fully operational.
        </p>

        {/* Actions */}
        <div className="flex flex-col w-full gap-3">
          <button
            onClick={handleRetryClick}
            disabled={isRetrying}
            className="w-full h-11 bg-neutral-900 text-white text-[12px] font-bold tracking-wider uppercase rounded-xl transition-all hover:bg-black focus:outline-none flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-75"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <span>Retry Connection</span>
            )}
          </button>

          <button
            onClick={onWorkOffline}
            className="w-full h-11 bg-white border border-[#E5E7EB] text-neutral-800 text-[12px] font-bold tracking-wider uppercase rounded-xl transition-colors hover:bg-neutral-50 focus:outline-none flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Work Offline</span>
          </button>
        </div>

        {/* Status Indicator */}
        <div className="mt-8 flex items-center gap-2 bg-neutral-50 px-4 py-2 rounded-full border border-[#E5E7EB]">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
            System Offline • Local Cache Active
          </span>
        </div>
      </div>
    </div>
  );
};
