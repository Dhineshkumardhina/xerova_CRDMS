import React, { useState, useRef, useEffect } from 'react';
import { CriminalProfile } from '../types';
import { Camera, X, Upload, Scan, CheckCircle2, AlertCircle, RefreshCw, UserCheck, ShieldAlert } from 'lucide-react';
import { api } from '../api';

interface PhotoSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  allProfiles: CriminalProfile[];
  onSelectMatchedProfile: (profile: CriminalProfile) => void;
  initialMode?: 'presets' | 'camera' | 'upload';
}

export const PhotoSearchModal: React.FC<PhotoSearchModalProps> = ({
  isOpen,
  onClose,
  allProfiles,
  onSelectMatchedProfile,
  initialMode,
}) => {
  const profilesList = Array.isArray(allProfiles) ? allProfiles : [];
  const [mode, setMode] = useState<'presets' | 'camera' | 'upload'>(() =>
    initialMode || (profilesList.length > 0 ? 'presets' : 'upload')
  );
  const [selectedPhoto, setSelectedPhoto] = useState<string>(profilesList[0]?.mugshotUrl || '');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [matchedResults, setMatchedResults] = useState<
    Array<{ profile: CriminalProfile; confidence: number; matchStatus?: string }>
  >([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    try {
      setMode('camera');
      setErrorMsg('');

      // Stop previous tracks if open
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access unavailable in current browser security context (requires localhost or HTTPS).');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (firstErr) {
        console.warn('Detailed camera constraints failed, attempting fallback { video: true }:', firstErr);
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play().catch((e) => console.warn('Video play warning:', e));
      }
    } catch (err: any) {
      console.warn('Camera access not granted or unavailable:', err);
      let friendly = err.message || 'Camera access unavailable. You can use photo upload.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendly = 'Camera permission was denied. Please allow camera access in your browser address bar.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendly = 'No webcam or camera device was found on your system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        friendly = 'Camera is in use by another application (Zoom, Teams, or another browser tab).';
      }
      setErrorMsg(friendly);
      setMode('upload');
    }
  };

  // Sync stream to video element whenever mode or cameraActive changes
  useEffect(() => {
    if (mode === 'camera' && cameraActive && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }
      video.muted = true;
      video.play().catch((e) => console.warn('Video play warning:', e));
    }
  }, [mode, cameraActive]);

  // Handle open/close and initialMode changes
  useEffect(() => {
    if (isOpen) {
      if (initialMode === 'camera') {
        startCamera();
      } else if (initialMode) {
        setMode(initialMode);
      }
    } else {
      stopCamera();
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setSelectedPhoto(dataUrl);
        stopCamera();
        setMode('upload');
        runBiometricScan(dataUrl);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setSelectedPhoto(url);
        runBiometricScan(url);
      };
      reader.readAsDataURL(file);
    }
  };

  const runBiometricScan = (photoUrl: string) => {
    setIsScanning(true);
    setScanProgress(0);
    setMatchedResults([]);
    setHasSearched(false);
    setErrorMsg('');

    const interval = setInterval(async () => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          
          // Execute backend biometric vector search
          api.searchFace(photoUrl)
            .then((backendResults) => {
              setMatchedResults(backendResults || []);
              setHasSearched(true);
            })
            .catch((err) => {
              setErrorMsg(err.message || 'Face processing error encountered');
              setMatchedResults([]);
              setHasSearched(true);
            });
          return 100;
        }
        return prev + 20;
      });
    }, 100);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs select-none animate-backdrop-enter">
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-modal-enter">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8F9FA]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-slate-800 text-[22px]">
              center_focus_strong
            </span>
            <h3 className="text-[16px] font-bold text-neutral-900">
              Biometric Facial Recognition Search
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-neutral-900 p-1.5 rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-xl border border-[#E5E7EB]">
            <button
              onClick={() => {
                stopCamera();
                setMode('presets');
              }}
              className={`flex-1 py-2 text-[12px] font-semibold rounded-lg cursor-pointer transition-all ${
                mode === 'presets' ? 'bg-white text-neutral-900 shadow-xs border border-[#E5E7EB]' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Preset Suspect Mugs
            </button>
            <button
              onClick={startCamera}
              className={`flex-1 py-2 text-[12px] font-semibold rounded-lg cursor-pointer transition-all ${
                mode === 'camera' ? 'bg-white text-neutral-900 shadow-xs border border-[#E5E7EB]' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Live Camera
            </button>
            <label
              className={`flex-1 py-2 text-[12px] font-semibold rounded-lg text-center cursor-pointer transition-all ${
                mode === 'upload' ? 'bg-white text-neutral-900 shadow-xs border border-[#E5E7EB]' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              Upload Photo
            </label>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[12px] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Active View / Camera or Photo Preview */}
          <div className="relative aspect-video max-h-64 bg-neutral-950 rounded-xl overflow-hidden flex items-center justify-center border border-[#E5E7EB] shadow-inner">
            {mode === 'camera' ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    (e.target as HTMLVideoElement).play().catch(() => {});
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border border-dashed border-white/50 m-6 rounded-lg pointer-events-none" />
                <button
                  onClick={capturePhoto}
                  className="absolute bottom-4 bg-white text-neutral-900 font-bold px-5 py-2 rounded-full shadow-lg hover:bg-neutral-100 transition-colors flex items-center gap-2 cursor-pointer text-[13px]"
                >
                  <Camera className="w-4 h-4" />
                  <span>Snap &amp; Match</span>
                </button>
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={selectedPhoto}
                  alt="Suspect for scanning"
                  className="max-h-full max-w-full object-contain"
                />

                {/* Laser Scanning Animation Overlay */}
                {isScanning && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                    <div className="w-48 h-48 border border-white/80 rounded-lg relative overflow-hidden flex items-center justify-center bg-black/30">
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-bounce" />
                      <div className="text-white text-[12px] font-mono font-bold tracking-widest text-center">
                        EXTRACTING BIOMETRIC VECTOR...
                        <br />
                        {scanProgress}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Presets List */}
          {mode === 'presets' && (
            <div>
              <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">
                Select Photo from Active Database
              </div>
              {allProfiles.length === 0 ? (
                <div className="p-4 text-center bg-neutral-50 border border-[#E5E7EB] rounded-lg text-[12px] text-neutral-500">
                  No suspect mugshots in database yet. Use <strong>Live Camera</strong> or <strong>Upload Photo</strong> above.
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                  {allProfiles.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPhoto(p.mugshotUrl);
                        runBiometricScan(p.mugshotUrl);
                      }}
                      className={`aspect-square rounded-lg border overflow-hidden relative cursor-pointer group transition-all ${
                        selectedPhoto === p.mugshotUrl
                          ? 'border-2 border-slate-900 ring-2 ring-slate-200'
                          : 'border-[#E5E7EB] hover:border-slate-400'
                      }`}
                    >
                      <img
                        src={p.mugshotUrl}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-neutral-900/80 text-white text-[9px] truncate px-1 py-0.5 text-center font-mono">
                        {p.name.split(' ')[0]}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Zero Results State */}
          {hasSearched && matchedResults.length === 0 && !isScanning && !errorMsg && (
            <div className="border border-[#E5E7EB] rounded-xl p-5 bg-neutral-50 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-neutral-900 font-bold text-[14px]">
                <ShieldAlert className="w-5 h-5 text-neutral-500" />
                <span>No Results Found</span>
              </div>
              <p className="text-[13px] text-neutral-600">
                No matching face embeddings found in database above the configured similarity threshold.
              </p>
            </div>
          )}

          {/* Biometric Candidate Results */}
          {matchedResults.length > 0 && !isScanning && (
            <div className="border border-[#E5E7EB] rounded-xl p-4 bg-neutral-50 space-y-3">
              {/* Mandatory Human Review Safeguard Banner */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 leading-snug">
                  <strong>Investigative Leads Only:</strong> Similarity scores provide candidate ranking and do not establish legal proof of identity. Independent human review is required before taking any official action.
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-900 font-bold text-[13px]">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Biometric Vector Match — Candidate Leads</span>
                </div>
                <span className="text-[11px] font-mono text-neutral-500">
                  MODEL: DLIB RESNET-34 (128-D)
                </span>
              </div>

              <div className="divide-y divide-[#E5E7EB]">
                {matchedResults.map((item, idx) => {
                  const profile = item?.profile;
                  if (!profile) return null;
                  const confidence = item.confidence ?? (item as any).similarityScore ?? 0;
                  const distance = (item as any).distance;
                  const confidenceLevel = (item as any).confidenceLevel || (confidence >= 80 ? 'HIGH' : confidence >= 65 ? 'MEDIUM' : 'LOW');
                  return (
                    <div
                      key={profile.id || idx}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={profile.mugshotUrl || ''}
                          alt={profile.name || 'Subject'}
                          className="w-12 h-12 rounded-lg object-cover border border-[#E5E7EB]"
                        />
                        <div>
                          <h4 className="text-[14px] font-bold text-neutral-900">{profile.name}</h4>
                          <div className="text-[12px] text-neutral-500">
                            ID: <span className="font-mono text-neutral-800 font-semibold">{profile.id}</span> • {profile.category}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[15px] font-bold font-mono text-neutral-900">
                            {confidence}%
                          </div>
                          <div className="flex items-center gap-1 justify-end">
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              confidenceLevel === 'HIGH' ? 'bg-emerald-100 text-emerald-800' :
                              confidenceLevel === 'MEDIUM' ? 'bg-blue-100 text-blue-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {confidenceLevel} CONFIDENCE
                            </span>
                          </div>
                          {typeof distance === 'number' && (
                            <div className="text-[10px] text-neutral-400 font-mono">
                              dist: {distance.toFixed(4)}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            onSelectMatchedProfile(profile);
                            handleClose();
                          }}
                          className="px-3.5 py-1.5 bg-neutral-900 text-white text-[12px] font-semibold rounded-lg hover:bg-black cursor-pointer shadow-xs transition-colors"
                        >
                          Review Dossier
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#E5E7EB] bg-[#F8F9FA] flex justify-between items-center">
          <span className="text-[11px] text-neutral-500">
            Engine: ResNet-34 128-D Metric Pipeline (dlib / ageitgey)
          </span>
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-[#E5E7EB] text-[12px] font-semibold text-neutral-800 bg-white rounded-lg hover:bg-neutral-50 cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
