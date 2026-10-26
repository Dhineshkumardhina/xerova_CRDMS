import React, { useState } from 'react';
import { Officer } from '../types';
import { Shield, Key, Database, Bell, Eye, Lock, HardDrive, RefreshCw } from 'lucide-react';

interface SettingsViewProps {
  officer: Officer;
  isOffline: boolean;
  onToggleOffline: () => void;
  onResetDatabase: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  officer,
  isOffline,
  onToggleOffline,
  onResetDatabase,
}) => {
  const [offlineSyncInterval, setOfflineSyncInterval] = useState('5');
  const [biometricThreshold, setBiometricThreshold] = useState('85');
  const [enableAuditLog, setEnableAuditLog] = useState(true);
  const [highContrastMode, setHighContrastMode] = useState(false);

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto w-full">
      <div className="border-b border-[#E5E7EB] pb-4">
        <h1 className="text-[24px] md:text-[30px] font-bold text-neutral-900 tracking-tight">
          System &amp; Security Settings
        </h1>
        <p className="text-[14px] md:text-[16px] text-neutral-500 mt-1">
          Configure node security, offline local database caching, and biometric matching parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Officer Credentials */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
            <Shield className="w-5 h-5 text-slate-800" />
            <h3 className="text-[16px] font-bold text-neutral-900">Officer Authentication Profile</h3>
          </div>
          <div className="flex items-center gap-4">
            <img
              src={officer.avatarUrl}
              alt={officer.name}
              className="w-14 h-14 rounded-full object-cover border border-[#E5E7EB]"
            />
            <div>
              <div className="text-[16px] font-bold text-neutral-900">{officer.name}</div>
              <div className="text-[12px] text-neutral-500">
                Badge #{officer.badgeNumber} • {officer.rank}
              </div>
              <div className="text-[11px] font-mono text-neutral-800 font-semibold mt-0.5">
                Clearance: {officer.clearanceLevel}
              </div>
            </div>
          </div>
          <div className="p-3.5 bg-neutral-50 rounded-xl border border-[#E5E7EB] text-[12px] text-neutral-700 space-y-1">
            <div>Department: <strong className="text-neutral-900">{officer.department}</strong></div>
            <div>Node Session ID: <span className="font-mono text-neutral-900 font-semibold">NODE-04-DOJ-8829-TLS</span></div>
          </div>
        </div>

        {/* Offline Cache & Node Sync */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
            <HardDrive className="w-5 h-5 text-slate-800" />
            <h3 className="text-[16px] font-bold text-neutral-900">Offline Synchronization &amp; Storage</h3>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-neutral-900">Simulate Offline Mode</div>
              <div className="text-[11px] text-neutral-500">
                Test offline cache behavior &amp; local record persistence.
              </div>
            </div>
            <button
              onClick={onToggleOffline}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold border cursor-pointer shadow-xs transition-colors ${
                isOffline
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white text-neutral-800 border-[#E5E7EB] hover:bg-neutral-50'
              }`}
            >
              {isOffline ? 'Offline Active' : 'Go Offline'}
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-3">
            <div>
              <div className="text-[13px] font-semibold text-neutral-900">Reset Local Database</div>
              <div className="text-[11px] text-neutral-500">
                Restore initial demonstration dataset records.
              </div>
            </div>
            <button
              onClick={onResetDatabase}
              className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-white hover:bg-neutral-50 border border-[#E5E7EB] text-neutral-800 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Biometrics Engine Settings */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
            <Eye className="w-5 h-5 text-slate-800" />
            <h3 className="text-[16px] font-bold text-neutral-900">Biometric Recognition Parameters</h3>
          </div>

          <div>
            <div className="flex justify-between text-[13px] font-semibold text-neutral-900 mb-1.5">
              <span>Minimum Matching Confidence Threshold</span>
              <span className="font-mono text-neutral-900 font-bold">{biometricThreshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="99"
              value={biometricThreshold}
              onChange={(e) => setBiometricThreshold(e.target.value)}
              className="w-full accent-slate-900 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-400 mt-1 font-mono">
              <span>50% (Permissive)</span>
              <span>99% (Strict Statutory Threshold)</span>
            </div>
          </div>
        </div>

        {/* Security Policies */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
            <Lock className="w-5 h-5 text-slate-800" />
            <h3 className="text-[16px] font-bold text-neutral-900">Security Compliance</h3>
          </div>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-[13px] font-semibold text-neutral-900">Audit Logging</div>
              <div className="text-[11px] text-neutral-500">
                Record all dossier views &amp; biometric inquiries to central audit trail.
              </div>
            </div>
            <input
              type="checkbox"
              checked={enableAuditLog}
              onChange={(e) => setEnableAuditLog(e.target.checked)}
              className="w-4 h-4 rounded border-[#E5E7EB] text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
