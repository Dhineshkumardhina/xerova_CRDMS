import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  ShieldAlert,
  KeyRound,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Lock,
  Shield,
  Fingerprint,
  CreditCard,
  Radio,
  Terminal,
  AlertTriangle,
  Building2,
  HelpCircle,
  Info,
  UserCheck,
  RefreshCw,
  Cpu,
  BadgeCheck,
  Hash,
  ExternalLink,
  ChevronRight,
  Server
} from 'lucide-react';
import { Officer } from '../types';

interface LoginScreenProps {
  onLogin: (officerId: string, password?: string) => Promise<void> | void;
  isAlreadyAuthenticated?: boolean;
  currentOfficer?: Officer;
  onReturnToDashboard?: () => void;
}

type AuthMethod = 'badge' | 'smartcard' | 'biometric';

interface DemoProfile {
  id: string;
  name: string;
  badge: string;
  rank: string;
  clearance: string;
  department: string;
  avatar: string;
  passwordDefault: string;
}

const DEMO_OFFICERS: DemoProfile[] = [
  {
    id: 'OFF-8829',
    name: 'Det. Alex Vance',
    badge: '8829-JD',
    rank: 'Senior Special Agent',
    clearance: 'Tier-4 High Security',
    department: 'Major Crimes Division // DOJ',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
    passwordDefault: 'DeptJusticeSecure#2024',
  },
  {
    id: 'OFF-4412',
    name: 'Insp. Marcus Brody',
    badge: '4412-MB',
    rank: 'Forensic Intelligence Lead',
    clearance: 'Tier-3 Investigative',
    department: 'Digital Forensic Unit',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300',
    passwordDefault: 'DeptJusticeSecure#2024',
  },
  {
    id: 'OFF-1002',
    name: 'Captain Elena Rostova',
    badge: '1002-ER',
    rank: 'Precinct Commander',
    clearance: 'Tier-5 Executive Oversight',
    department: 'Internal Affairs & Operations',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300',
    passwordDefault: 'DeptJusticeSecure#2024',
  },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  isAlreadyAuthenticated = false,
  currentOfficer,
  onReturnToDashboard,
}) => {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('badge');
  const [officerId, setOfficerId] = useState('8829-JD');
  const [password, setPassword] = useState('DeptJusticeSecure#2024');
  const [clearanceTier, setClearanceTier] = useState('Tier-4 High Security');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isServerOffline, setIsServerOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showStatuteModal, setShowStatuteModal] = useState(false);
  const [showDemoSelector, setShowDemoSelector] = useState(false);

  // Smart Card Simulation State
  const [smartCardReading, setSmartCardReading] = useState(false);
  const [smartCardInserted, setSmartCardInserted] = useState(true);

  // Biometric Simulation State
  const [biometricScanning, setBiometricScanning] = useState(false);
  const [biometricProgress, setBiometricProgress] = useState(0);

  // Real-time clock for federal terminal authenticity
  const [currentTime, setCurrentTime] = useState(new Date().toUTCString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toUTCString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState('CapsLock'));
    }
  };

  const handleLoginExecution = async (badgeToUse: string, passToUse?: string) => {
    setIsLoading(true);
    setErrorMessage('');
    setIsServerOffline(false);

    try {
      setLoadingStep('Verifying CJIS Node & Token Clearance...');
      await new Promise((r) => setTimeout(r, 400));
      setLoadingStep('Authenticating Cryptographic Key Exchange...');
      await onLogin(badgeToUse.trim(), passToUse);
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('connection') ||
        msg.includes('network')
      ) {
        setIsServerOffline(true);
      }
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerId.trim()) {
      setErrorMessage('Officer ID / Badge number is required.');
      return;
    }
    await handleLoginExecution(officerId, password);
  };

  const selectDemoProfile = (profile: DemoProfile) => {
    setOfficerId(profile.badge);
    setPassword(profile.passwordDefault);
    setClearanceTier(profile.clearance);
    setErrorMessage('');
    setIsServerOffline(false);
    setShowDemoSelector(false);
  };

  const handleSmartCardAuth = async () => {
    setSmartCardReading(true);
    setErrorMessage('');
    try {
      await new Promise((r) => setTimeout(r, 900));
      await handleLoginExecution('8829-JD', 'DeptJusticeSecure#2024');
    } catch {
      setErrorMessage('Smart card certificate verification timed out.');
    } finally {
      setSmartCardReading(false);
    }
  };

  const handleBiometricAuth = async () => {
    setBiometricScanning(true);
    setErrorMessage('');
    setBiometricProgress(0);

    const interval = setInterval(() => {
      setBiometricProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 100;
        }
        return prev + 25;
      });
    }, 200);

    setTimeout(async () => {
      clearInterval(interval);
      try {
        await handleLoginExecution('8829-JD', 'DeptJusticeSecure#2024');
      } catch {
        setErrorMessage('Biometric scan match below threshold. Please use Badge Credentials.');
      } finally {
        setBiometricScanning(false);
      }
    }, 1100);
  };

  const handleInstantDemoLogin = async () => {
    await handleLoginExecution('8829-JD', 'DeptJusticeSecure#2024');
  };

  return (
    <div className="bg-[#0B0F19] min-h-screen flex flex-col font-sans text-neutral-100 selection:bg-blue-600 selection:text-white relative">
      {/* Institutional Top Telemetry Banner */}
      <header className="w-full bg-[#070A12] border-b border-white/10 px-4 md:px-8 py-2 flex flex-wrap items-center justify-between text-[11px] font-mono tracking-wider text-neutral-400 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-semibold tracking-widest uppercase">
              CJIS NODE 04 ONLINE
            </span>
          </div>
          <span className="text-white/20 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center gap-1.5 text-neutral-400">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>FIPS 140-3 VALIDATED</span>
          </div>
          <span className="text-white/20 hidden md:inline">|</span>
          <div className="hidden md:flex items-center gap-1.5 text-neutral-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>AES-256-GCM ENCRYPTED</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-neutral-400 font-medium">TERMINAL: {currentTime}</span>
          <button
            type="button"
            onClick={() => setShowStatuteModal(true)}
            className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 transition-colors cursor-pointer"
          >
            Statutory Notice
          </button>
        </div>
      </header>

      {/* Main Split Authentication Matrix */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Hero & Intelligence Operations Panel */}
        <div className="hidden lg:flex flex-col justify-between w-7/12 bg-gradient-to-br from-[#090E1A] via-[#0C1322] to-[#060911] border-r border-white/10 p-12 xl:p-16 relative overflow-hidden">
          {/* Subtle Cyber Tactical Grid Background */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.4) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Radial Ambient Glow */}
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand Identity */}
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              {/* Official Law Enforcement Heraldic Seal */}
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-400/40 shadow-xl flex items-center justify-center p-2.5 group">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-amber-500/10 to-blue-500/10 opacity-70" />
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full text-amber-400 relative z-10 drop-shadow-md"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Outer Shield Shield Shape */}
                  <path
                    d="M50 8L86 22V52C86 73 70 89 50 95C30 89 14 73 14 52V22L50 8Z"
                    fill="currentColor"
                    fillOpacity="0.12"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  {/* Inner Ring */}
                  <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                  {/* 7-Point Star */}
                  <polygon
                    points="50,28 54,42 68,43 57,52 61,66 50,57 39,66 43,52 32,43 46,42"
                    fill="currentColor"
                    fillOpacity="0.85"
                  />
                  {/* Scales of Justice Icon */}
                  <path d="M46 72H54M50 64V72M43 66L50 64L57 66" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-amber-400 uppercase bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                    Official Federal Gateway
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400">RESTRICTED TIER-IV</span>
                </div>
                <h1 className="text-2xl font-black tracking-tight text-white mt-1">
                  CRMS <span className="text-blue-400 font-light">// INTELLIGENCE GRID</span>
                </h1>
                <p className="text-[12px] text-neutral-400 font-mono">
                  Criminal Record Retrieval &amp; Biometric Registry
                </p>
              </div>
            </div>

            {/* Core Mission Banner */}
            <div className="max-w-xl">
              <h2 className="text-[34px] leading-[42px] font-bold tracking-tight text-white mb-4">
                High-Trust Criminal Intelligence &amp; Case Registry.
              </h2>
              <p className="text-[15px] leading-[26px] text-neutral-300 font-normal">
                Engineered for authorized law enforcement detectives, forensic examiners, and judicial
                prosecutors. Delivers sub-second biometric dossier retrieval, inter-agency arrest cross-checks,
                and statutory case management under strict CJIS audit protocols.
              </p>
            </div>

            {/* Live Operational Capability Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10 max-w-2xl">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-xs hover:border-blue-500/40 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2.5">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div className="text-[13px] font-bold text-white mb-0.5">Automated ABIS</div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Facial recognition vector search and biometric dossier matches.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-xs hover:border-emerald-500/40 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-[13px] font-bold text-white mb-0.5">Inter-Agency Mesh</div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Real-time synchronization across municipal, state, and federal registries.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-xs hover:border-amber-500/40 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-2.5">
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="text-[13px] font-bold text-white mb-0.5">Cryptographic Audit</div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Every query is cryptographically signed, timestamped, and audited.
                </p>
              </div>
            </div>
          </div>

          {/* Left Footer: Compliance & Disclaimer */}
          <div className="relative z-10 pt-8 border-t border-white/10 flex flex-wrap items-center justify-between text-[11px] font-mono text-neutral-400 gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>STATION HOST: WASH-DC-BLDG-12 // CLUSTER 04</span>
            </div>
            <div className="flex items-center gap-4">
              <span>SYS VER 3.2.0</span>
              <span>•</span>
              <span>28 CFR PART 20 COMPLIANT</span>
            </div>
          </div>
        </div>

        {/* Right Authentication Terminal Form */}
        <div className="flex-1 flex flex-col justify-center items-center bg-[#F8FAFC] text-neutral-900 p-6 sm:p-10 lg:p-14 relative">
          <div className="w-full max-w-md">
            {/* Mobile Branding (Small screen only) */}
            <div className="lg:hidden mb-8 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#090E1A] border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-lg mb-3">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-950 uppercase">
                CRMS // Law Enforcement
              </h1>
              <p className="text-[11px] font-mono text-neutral-500 mt-0.5">
                Criminal Record Retrieval &amp; Biometric Registry
              </p>
            </div>

            {/* Active Session Card (If user navigated here while logged in) */}
            {isAlreadyAuthenticated && onReturnToDashboard && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-300/80 rounded-2xl shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-emerald-900">
                        Active Session Detected
                      </span>
                      <span className="px-1.5 py-0.5 bg-emerald-200/70 text-emerald-800 text-[10px] font-mono font-semibold rounded">
                        ONLINE
                      </span>
                    </div>
                    <p className="text-[12px] text-emerald-700 mt-0.5">
                      Authenticated as{' '}
                      <strong>{currentOfficer?.name || 'Officer J. Daniels'}</strong> (Badge #{currentOfficer?.badgeNumber || '8829'}).
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onReturnToDashboard}
                        className="py-2 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <span>Resume Command Console</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Primary Auth Container Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 p-7 sm:p-9 relative overflow-hidden">
              {/* High Security Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 tracking-wider uppercase font-mono mb-1">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Officer Gateway</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Terminal Verification
                  </h2>
                </div>

                {/* Quick Demo Access Trigger Button */}
                <button
                  type="button"
                  onClick={() => setShowDemoSelector(!showDemoSelector)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Switch or view authorized test credentials"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Demo Badges</span>
                </button>
              </div>

              {/* Demo Profiles Dropdown / Tray */}
              {showDemoSelector && (
                <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200/90 text-[12px]">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] font-mono">
                      Authorized Test Personas
                    </span>
                    <span className="text-[10px] text-slate-500">Click to fill</span>
                  </div>
                  <div className="space-y-2">
                    {DEMO_OFFICERS.map((profile) => (
                      <div
                        key={profile.badge}
                        onClick={() => selectDemoProfile(profile)}
                        className="p-2.5 rounded-lg bg-white border border-slate-200 hover:border-blue-500/80 hover:bg-blue-50/40 cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={profile.avatar}
                            alt={profile.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-300"
                          />
                          <div>
                            <div className="font-bold text-slate-900 text-[12px] group-hover:text-blue-700">
                              {profile.name}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Badge: {profile.badge} • {profile.clearance}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                          Select →
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Authentication Mode Switcher Tabs */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl mb-6 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setAuthMethod('badge')}
                  className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authMethod === 'badge'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Badge ID</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMethod('smartcard')}
                  className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authMethod === 'smartcard'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>CAC / PIV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMethod('biometric')}
                  className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    authMethod === 'biometric'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span>Biometrics</span>
                </button>
              </div>

              {/* Error Message Box */}
              {errorMessage && (
                <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[12px] flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-rose-900">Access Denied: </span>
                      <span>{errorMessage}</span>
                    </div>
                  </div>
                  {isServerOffline && (
                    <div className="pt-2 border-t border-rose-200 flex flex-col gap-2">
                      <p className="text-[11px] text-rose-700">
                        The backend API server (:8000) is unreachable. You can continue directly in secure offline / evaluation mode.
                      </p>
                      <button
                        type="button"
                        onClick={handleInstantDemoLogin}
                        className="w-full py-2 px-3 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Continue in Standalone Offline Mode</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* METHOD 1: BADGE ID & PASSWORD FORM */}
              {authMethod === 'badge' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Officer ID Field */}
                  <div>
                    <label
                      htmlFor="officer-id"
                      className="block text-[12px] font-bold text-slate-700 mb-1.5 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        <BadgeCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>Officer ID / Federal Badge #</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-600 font-normal">
                        e.g. 8829-JD
                      </span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Hash className="w-4 h-4" />
                      </div>
                      <input
                        id="officer-id"
                        type="text"
                        value={officerId}
                        onChange={(e) => setOfficerId(e.target.value)}
                        placeholder="Enter badge number (e.g. 8829-JD)"
                        required
                        className="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Clearance Tier Selector */}
                  <div>
                    <label
                      htmlFor="clearance-tier"
                      className="block text-[12px] font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5 text-blue-600" />
                      <span>Security Clearance Level</span>
                    </label>
                    <select
                      id="clearance-tier"
                      value={clearanceTier}
                      onChange={(e) => setClearanceTier(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-[12px] font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all cursor-pointer"
                    >
                      <option value="Tier-4 High Security">Tier-4 High Security (Senior Special Agent)</option>
                      <option value="Tier-3 Investigative">Tier-3 Investigative (Detective / Lead)</option>
                      <option value="Tier-2 Field Officer">Tier-2 Field Officer (Patrol &amp; Booking)</option>
                      <option value="Tier-5 Executive Oversight">Tier-5 Executive Oversight (Command Staff)</option>
                    </select>
                  </div>

                  {/* Password Field with CapsLock detection */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label
                        htmlFor="password"
                        className="block text-[12px] font-bold text-slate-700 flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5 text-blue-600" />
                        <span>Passcode / Cryptographic Key</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowHelpModal(true)}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-2 cursor-pointer"
                      >
                        Forgot credentials?
                      </button>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter secure passcode"
                        required
                        className="w-full h-11 pl-10 pr-10 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all shadow-xs"
                      />
                      <button
                        type="button"
                        id="toggle-password"
                        aria-label="Toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {capsLockActive && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Warning: Caps Lock is enabled.</span>
                      </div>
                    )}
                  </div>

                  {/* Terminal Session Guard Controls */}
                  <div className="flex items-center justify-between pt-1 text-[12px]">
                    <label className="flex items-center gap-2 cursor-pointer group select-none">
                      <input
                        type="checkbox"
                        checked={rememberSession}
                        onChange={(e) => setRememberSession(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white cursor-pointer accent-blue-600"
                      />
                      <span className="text-slate-600 group-hover:text-slate-900 font-medium">
                        Remember terminal for 12 hours
                      </span>
                    </label>

                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      SEC-LEVEL 4
                    </span>
                  </div>

                  {/* Submit Action Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-11 flex justify-center items-center gap-2 bg-[#090E1A] hover:bg-slate-900 text-white text-[13px] font-bold rounded-xl transition-all cursor-pointer shadow-md hover:shadow-lg disabled:opacity-75 disabled:cursor-not-allowed group"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2 text-[12px]">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>{loadingStep || 'Verifying Credentials...'}</span>
                        </div>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                          <span>Authenticate &amp; Open Terminal</span>
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* METHOD 2: CAC / SMART CARD SIMULATION */}
              {authMethod === 'smartcard' && (
                <div className="py-4 text-center space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 relative overflow-hidden">
                    <CreditCard className="w-10 h-10" />
                    {smartCardReading && (
                      <div className="absolute inset-0 bg-blue-600/20 animate-pulse flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900">
                      Common Access Card (CAC) / PIV
                    </h3>
                    <p className="text-[12px] text-slate-500 max-w-xs mx-auto mt-1">
                      Insert your Department of Justice Smart Card into the physical card reader.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-[11px] font-mono space-y-1">
                    <div className="flex justify-between text-slate-600">
                      <span>READER STATUS:</span>
                      <span className="text-emerald-600 font-bold">READY (USB-HID-02)</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>CHIP CERTIFICATE:</span>
                      <span className="text-slate-900 font-bold">DOJ-PIV-VALIDATED</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSmartCardAuth}
                    disabled={smartCardReading || isLoading}
                    className="w-full h-11 flex justify-center items-center gap-2 bg-[#090E1A] hover:bg-slate-900 text-white text-[13px] font-bold rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-75"
                  >
                    {smartCardReading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Reading Digital Certificate...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-400" />
                        Read Card &amp; Authenticate
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* METHOD 3: BIOMETRIC CLEARANCE SIMULATION */}
              {authMethod === 'biometric' && (
                <div className="py-4 text-center space-y-4">
                  <div className="relative w-24 h-24 mx-auto rounded-2xl bg-slate-900 border-2 border-blue-500/50 flex items-center justify-center overflow-hidden shadow-inner">
                    <Fingerprint className="w-12 h-12 text-blue-400" />
                    {biometricScanning && (
                      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/30 to-transparent animate-laser pointer-events-none" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900">
                      Officer Biometric Pass
                    </h3>
                    <p className="text-[12px] text-slate-500 max-w-xs mx-auto mt-1">
                      Automated optical fingerprint and facial vector cross-reference.
                    </p>
                  </div>

                  {biometricScanning && (
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                      <div
                        className="bg-blue-600 h-full transition-all duration-200"
                        style={{ width: `${biometricProgress}%` }}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleBiometricAuth}
                    disabled={biometricScanning || isLoading}
                    className="w-full h-11 flex justify-center items-center gap-2 bg-[#090E1A] hover:bg-slate-900 text-white text-[13px] font-bold rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-75"
                  >
                    {biometricScanning ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Matching Biometric Vectors ({biometricProgress}%)...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Fingerprint className="w-4 h-4 text-blue-400" />
                        Initiate Biometric Scan
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Quick One-Click Evaluation Mode Button */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleInstantDemoLogin}
                  disabled={isLoading}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-[11px] font-bold border border-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Instant Quick-Access (Pre-authorized Evaluation Mode)</span>
                </button>
              </div>
            </div>

            {/* Terminal Support & Agency Accreditation */}
            <div className="mt-6 flex flex-col items-center text-center gap-2">
              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                <button
                  type="button"
                  onClick={() => setShowHelpModal(true)}
                  className="hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Terminal Help Desk</span>
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setShowStatuteModal(true)}
                  className="hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Statutory Notice</span>
                </button>
              </div>

              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                FEDERAL LAW ENFORCEMENT RECORD NETWORK // CJIS COMPLIANT
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* IT Help Desk Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Station IT / CJIS Officer Dispatch
                </h3>
                <p className="text-[12px] text-slate-500">Credential recovery &amp; terminal assistance</p>
              </div>
            </div>

            <div className="space-y-3 text-[12px] text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between py-1 border-b border-slate-200/80">
                <span className="font-semibold">Station IT Hotline:</span>
                <span className="font-mono text-blue-700 font-bold">1-800-555-CJIS (Ext 4409)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/80">
                <span className="font-semibold">Security Officer Desk:</span>
                <span className="font-mono text-slate-800">Room 412, Central Precinct</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-semibold">Automated Reset:</span>
                <span className="text-emerald-700 font-bold">Dispatched via DOJ PIV Pager</span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Passwords cannot be reset via personal email. All badge reset requests require voice verification by a Shift Commander.
              </span>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-[12px] font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Dialog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statutory CJIS Notice Modal */}
      {showStatuteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 text-slate-900 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Statutory Access Notice &amp; Warning
                </h3>
                <p className="text-[12px] text-slate-500">18 U.S.C. § 1030 &amp; 28 CFR Part 20</p>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-3 text-[12px] text-slate-700 p-4 bg-slate-50 rounded-xl border border-slate-200 leading-relaxed font-sans">
              <p>
                <strong>AUTHORIZED LAW ENFORCEMENT ACCESS ONLY.</strong> This system is the property of the Criminal Record Management Division and contains privileged, law enforcement sensitive (LES) data.
              </p>
              <p>
                Users have no reasonable expectation of privacy when using this workstation. Any and all communications, queries, lookups, and data entries are subject to automated monitoring, recording, and auditing at all times.
              </p>
              <p>
                Unauthorized access, alteration, extraction, or dissemination of criminal history data constitutes a federal offense punishable by imprisonment up to 10 years and severe administrative sanctions.
              </p>
            </div>

            <div className="mt-5 flex justify-between items-center">
              <span className="text-[11px] font-mono text-slate-500">CJIS POLICY COMPLIANCE</span>
              <button
                type="button"
                onClick={() => setShowStatuteModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-[12px] font-bold rounded-xl transition-colors cursor-pointer"
              >
                I Understand &amp; Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

