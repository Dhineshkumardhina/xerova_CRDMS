import React, { useState } from 'react';
import { Eye, EyeOff, ShieldAlert, KeyRound, ArrowRight, CheckCircle2, Info, Server } from 'lucide-react';
import { Officer } from '../types';
import { getApiBaseUrl } from '../api/client';

interface LoginScreenProps {
  onLogin: (officerId: string, password?: string) => Promise<void> | void;
  isAlreadyAuthenticated?: boolean;
  currentOfficer?: Officer;
  onReturnToDashboard?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  isAlreadyAuthenticated = false,
  currentOfficer,
  onReturnToDashboard,
}) => {
  const [officerId, setOfficerId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showResetNotice, setShowResetNotice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => getApiBaseUrl());
  const [testingServer, setTestingServer] = useState(false);
  const [serverStatus, setServerStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerId.trim()) {
      setErrorMessage('Officer ID / Badge number is required');
      return;
    }
    if (!password) {
      setErrorMessage('Password is required');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    setShowResetNotice(false);
    try {
      await onLogin(officerId.trim(), password);
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please check credentials.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#F5F6F8] min-h-screen flex flex-col md:flex-row font-sans text-neutral-900 selection:bg-neutral-200 selection:text-neutral-900">
      {/* Left Panel: Branding & Mission */}
      <div className="hidden md:flex flex-col justify-center items-start w-1/2 bg-slate-950 text-white border-r border-[#E5E7EB]/20 p-[10%] relative overflow-hidden">
        {/* Grid Background Pattern */}
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10 max-w-lg">
          <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-6 backdrop-blur-xs">
            <span
              className="material-symbols-outlined text-[36px] text-white"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              local_police
            </span>
          </div>
          <h1 className="text-[32px] leading-[40px] font-bold tracking-tight text-white mb-4">
            CRIME RECORD
            <br />
            MANAGEMENT SYSTEM
          </h1>
          <p className="text-[15px] leading-[26px] text-neutral-300 font-normal">
            Secure Criminal Record Retrieval &amp; Management. Engineered for authorized
            law enforcement and judicial personnel to process records with statutory precision.
          </p>

          <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[12px] font-mono font-medium tracking-wide uppercase text-neutral-300">
              Secure Node 04 // DOJ High-Trust Grid
            </span>
          </div>
        </div>

        {/* Institutional Footer */}
        <div className="absolute bottom-[8%] left-[10%] z-10">
          <p className="font-mono text-[12px] text-neutral-400 uppercase tracking-widest">
            SYS.VER_2.4.1 // DEPT. OF JUSTICE
          </p>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="flex flex-col justify-center items-center w-full md:w-1/2 bg-[#F8F9FA] p-6 md:p-12 py-16 md:py-0">
        <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-2xl border border-[#E5E7EB] shadow-xs">
          {/* Mobile Header (Visible only on small screens) */}
          <div className="md:hidden mb-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center mb-3">
              <span
                className="material-symbols-outlined text-[32px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                local_police
              </span>
            </div>
            <h1 className="text-[24px] font-bold text-neutral-900 uppercase tracking-tight">CRMS</h1>
            <p className="text-[12px] text-neutral-500 uppercase tracking-wider mt-1 font-mono">Justice Ledger Portal</p>
          </div>

          {/* Active Session Notice if already logged in */}
          {isAlreadyAuthenticated && onReturnToDashboard && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-emerald-800 text-[13px] font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Active Session Detected</span>
              </div>
              <p className="text-[12px] text-emerald-700">
                You are currently signed in as{' '}
                <strong>{currentOfficer?.name || 'Officer Daniels'}</strong> (Badge #{currentOfficer?.badgeNumber || '8829'}).
              </p>
              <button
                type="button"
                onClick={onReturnToDashboard}
                className="mt-1 w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-[12px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Return to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-[22px] leading-[30px] font-bold text-neutral-900 mb-1">
              Authentication Required
            </h2>
            <p className="text-[13px] text-neutral-500">
              Please verify your officer credentials to access the system.
            </p>
          </div>

          {/* Security Note Banner */}
          <div className="flex items-start gap-3 p-3.5 mb-5 bg-neutral-50 border border-[#E5E7EB] rounded-xl">
            <span className="material-symbols-outlined text-slate-800 text-[20px] shrink-0 mt-0.5">
              shield
            </span>
            <div className="text-[12px] leading-[17px] text-neutral-700">
              <strong className="text-neutral-900 font-semibold">Authorized Personnel Only.</strong> All access is logged and audited under CJIS guidelines.
            </div>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[12px] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {showResetNotice && (
            <div className="mb-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-[12px] flex items-start gap-2.5">
              <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              <div className="leading-[18px]">
                <strong className="text-slate-900 font-semibold">Credential Reset Protocol:</strong> In accordance with CJIS standards, badge credentials cannot be reset remotely. Contact your precinct systems administrator with your official badge ID.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Officer ID Field */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[12px] font-semibold text-neutral-800" htmlFor="officer-id">
                  Officer ID / Badge Number
                </label>
              </div>
              <input
                id="officer-id"
                type="text"
                value={officerId}
                onChange={(e) => setOfficerId(e.target.value)}
                placeholder="e.g. 8829-JD"
                required
                className="w-full h-11 px-3.5 bg-white border border-[#E5E7EB] rounded-xl text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none shadow-xs transition-all"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[12px] font-semibold text-neutral-800 mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter credentials"
                  required
                  className="w-full h-11 px-3.5 pr-10 bg-white border border-[#E5E7EB] rounded-xl text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none shadow-xs transition-all"
                />
                <button
                  type="button"
                  id="toggle-password"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-800 transition-colors flex items-center justify-center p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center pt-1">
              <label className="flex items-center gap-2 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={rememberSession}
                  onChange={(e) => setRememberSession(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E5E7EB] text-slate-900 focus:ring-slate-900 bg-white cursor-pointer accent-slate-900"
                />
                <span className="text-[12px] text-neutral-600 group-hover:text-neutral-900 transition-colors">
                  Remember session
                </span>
              </label>
              <button
                type="button"
                onClick={() => setShowResetNotice(!showResetNotice)}
                className="text-[12px] font-semibold text-neutral-700 hover:text-neutral-900 hover:underline underline-offset-2 cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {/* Primary Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 flex justify-center items-center bg-neutral-900 text-white text-[13px] font-bold rounded-xl hover:bg-black transition-colors focus:outline-none cursor-pointer shadow-xs disabled:opacity-75"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 text-[13px]">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Authenticating Node...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign In
                    <span className="material-symbols-outlined text-[18px]">login</span>
                  </span>
                )}
              </button>
            </div>

            {/* Quick Access Credentials Helper */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 mb-1.5">
                <span>Demo Law Enforcement Credentials:</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOfficerId('8829-JD');
                    setPassword('DeptJusticeSecure#2024');
                    setErrorMessage('');
                  }}
                  className="px-3 py-2 bg-white hover:bg-neutral-100 border border-[#E5E7EB] rounded-xl text-left transition-colors cursor-pointer shadow-xs group"
                >
                  <div className="text-[11px] font-bold text-neutral-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Super Admin</span>
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 group-hover:text-neutral-800">
                    8829-JD • DeptJusticeSecure#2024
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOfficerId('7710-SO');
                    setPassword('OfficerSecure#2024');
                    setErrorMessage('');
                  }}
                  className="px-3 py-2 bg-white hover:bg-neutral-100 border border-[#E5E7EB] rounded-xl text-left transition-colors cursor-pointer shadow-xs group"
                >
                  <div className="text-[11px] font-bold text-neutral-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span>Police Member</span>
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 group-hover:text-neutral-800">
                    7710-SO • OfficerSecure#2024
                  </div>
                </button>
              </div>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-[#E5E7EB] text-center">
            <button
              type="button"
              onClick={() => setShowServerSettings(!showServerSettings)}
              className="text-[11px] font-mono text-neutral-500 hover:text-neutral-800 flex items-center justify-center gap-1.5 mx-auto cursor-pointer transition-colors"
            >
              <Server className="w-3.5 h-3.5" />
              <span>Backend Server: {serverUrl}</span>
            </button>

            {showServerSettings && (
              <div className="mt-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-left">
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  API Endpoint URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="https://server.domain/api/v1"
                    className="flex-1 px-2.5 py-1.5 text-[12px] bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setTestingServer(true);
                      setServerStatus(null);
                      try {
                        const target = serverUrl.replace(/\/+$/, '');
                        const res = await fetch(`${target}/health`, { method: 'GET', signal: AbortSignal.timeout(5000) });
                        if (res.ok) {
                          localStorage.setItem('crms_api_base_url', target);
                          setServerStatus('Online - Connected successfully');
                        } else {
                          setServerStatus(`Error: HTTP ${res.status}`);
                        }
                      } catch (err: any) {
                        setServerStatus('Offline: Could not connect to host');
                      } finally {
                        setTestingServer(false);
                      }
                    }}
                    disabled={testingServer}
                    className="px-3 py-1.5 bg-neutral-900 text-white text-[11px] font-bold rounded-lg hover:bg-black transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {testingServer ? 'Testing...' : 'Save & Test'}
                  </button>
                </div>
                {serverStatus && (
                  <p className={`mt-1.5 text-[11px] font-medium ${serverStatus.includes('Online') ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {serverStatus}
                  </p>
                )}
                <p className="mt-1.5 text-[10px] text-neutral-400">
                  Default on Android: <code className="bg-neutral-200 px-1 py-0.5 rounded">http://10.0.2.2:8000/api/v1</code> for emulator or intranet HTTPS URL.
                </p>
              </div>
            )}

            <p className="mt-4 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
              Department of Justice Secure Gateway
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
