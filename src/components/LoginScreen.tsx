import React, { useState } from 'react';
import { Eye, EyeOff, ShieldAlert, LogIn, KeyRound } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (officerId: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [officerId, setOfficerId] = useState('8829-JD');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerId.trim()) {
      setErrorMessage('Officer ID / Username is required');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    setTimeout(() => {
      setIsLoading(false);
      onLogin(officerId.trim());
    }, 450);
  };

  const handleDemoFill = () => {
    setOfficerId('8829-JD');
    setPassword('DeptJusticeSecure#2024');
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

          <div className="mb-6">
            <h2 className="text-[22px] leading-[30px] font-bold text-neutral-900 mb-1">
              Authentication Required
            </h2>
            <p className="text-[13px] text-neutral-500">
              Please verify your officer credentials to access the system.
            </p>
          </div>

          {/* Security Note Banner */}
          <div className="flex items-start gap-3 p-3.5 mb-6 bg-neutral-50 border border-[#E5E7EB] rounded-xl">
            <span className="material-symbols-outlined text-slate-800 text-[20px] shrink-0 mt-0.5">
              shield
            </span>
            <p className="text-[12px] leading-[17px] text-neutral-700">
              <strong className="text-neutral-900 font-semibold">Authorized Personnel Only.</strong> All access is logged and audited under federal CJIS guidelines.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[12px] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Officer ID Field */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[12px] font-semibold text-neutral-800" htmlFor="officer-id">
                  Officer ID / Username
                </label>
                <button
                  type="button"
                  onClick={handleDemoFill}
                  className="text-[11px] font-medium text-slate-700 hover:text-slate-900 flex items-center gap-1 underline underline-offset-2 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" /> Quick Demo Fill
                </button>
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
                onClick={() => alert('Credentials recovery link has been dispatched to official DOJ tele-terminal 8829.')}
                className="text-[12px] font-semibold text-neutral-700 hover:text-neutral-900 hover:underline underline-offset-2 cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {/* Action */}
            <div className="pt-3">
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
          </form>

          <div className="mt-8 pt-6 border-t border-[#E5E7EB] text-center">
            <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
              Department of Justice Secure Gateway
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
