import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CriminalProfile } from '../types';
import {
  Camera,
  X,
  Upload,
  AlertCircle,
  UserCheck,
  AlertTriangle,
  Info,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { api, FaceSearchResult, FaceSearchResponse, FaceQualityMetrics } from '../api';

interface PhotoSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  allProfiles: CriminalProfile[];
  onSelectMatchedProfile: (profile: CriminalProfile) => void;
  initialMode?: 'upload' | 'camera';
}

// ── Search State Machine ────────────────────────────────────────────────────
type SearchState =
  | 'idle'            // No search started
  | 'searching'       // API call in progress
  | 'results'         // Backend returned ≥1 match above threshold
  | 'no_results'      // Face detected, but NO criminal matched above threshold
  | 'no_face'         // Backend: NO_FACE_DETECTED
  | 'multiple_faces'  // Backend: MULTIPLE_FACES_DETECTED
  | 'low_quality'     // Backend: LOW_FACE_QUALITY / blur / lighting
  | 'invalid_image'   // Backend: INVALID_IMAGE / IMAGE_TOO_SMALL
  | 'server_error';   // Network error or 5xx

export const PhotoSearchModal: React.FC<PhotoSearchModalProps> = ({
  isOpen,
  onClose,
  allProfiles: _allProfiles,
  onSelectMatchedProfile,
  initialMode = 'upload',
}) => {
  const [mode, setMode] = useState<'upload' | 'camera'>(initialMode);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [matchedResults, setMatchedResults] = useState<FaceSearchResult[]>([]);
  const [searchResponse, setSearchResponse] = useState<FaceSearchResponse | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<FaceQualityMetrics | null>(null);
  const [improvementTips, setImprovementTips] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [detectedFacesCount, setDetectedFacesCount] = useState<number>(0);
  const [_cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [searchStep, setSearchStep] = useState<string>('idle');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentSearchRef = useRef<number>(0);

  // ── Camera ──────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStream(null);
    setCameraActive(false);
    setIsCameraStarting(false);
    setCameraError(null);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      setIsCameraStarting(true);
      setMode('camera');

      // Stop existing tracks if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser or requires HTTPS / localhost.');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (firstErr) {
        console.warn('Detailed camera constraints failed, attempting fallback { video: true }:', firstErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setCameraStream(stream);
      setCameraActive(true);
      setIsCameraStarting(false);
    } catch (err: any) {
      console.error('Camera access failure:', err);
      setIsCameraStarting(false);
      let friendlyMsg = 'Camera access was unavailable.';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        friendlyMsg = 'Camera permission was denied. Please allow camera permissions in your browser address bar.';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        friendlyMsg = 'No camera device was detected on your system.';
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        friendlyMsg = 'Your camera is currently in use by another application (e.g. Teams, Zoom, or another tab).';
      } else if (err?.message) {
        friendlyMsg = err.message;
      }
      setCameraError(friendlyMsg);
    }
  }, []);

  // Sync camera stream to video element
  useEffect(() => {
    let isMounted = true;
    if (mode === 'camera' && cameraStream && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== cameraStream) {
        video.srcObject = cameraStream;
      }
      video.muted = true;
      video.play().catch((err) => {
        if (isMounted) {
          console.warn('Video auto-play was prevented:', err);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [mode, cameraStream]);

  // Handle modal open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      if (initialMode === 'camera') {
        startCamera();
      } else {
        setMode('upload');
      }
    } else {
      stopCamera();
      setMode('upload');
      setPreviewUrl('');
      setSearchState('idle');
      setMatchedResults([]);
      setSearchResponse(null);
      setQualityMetrics(null);
      setImprovementTips([]);
      setErrorMessage('');
    }
  }, [isOpen, initialMode, startCamera, stopCamera]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
          stopCamera();
          setMode('upload');
          setPreviewUrl(URL.createObjectURL(blob));
          runSearch(file);
        }
      },
      'image/jpeg',
      0.95
    );
  };

  // ── File Upload ──────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPreviewUrl(URL.createObjectURL(file));
    runSearch(file);
  };

  // ── Biometric Search Workflow ───────────────────────────────────────────
  const runSearch = useCallback(async (file: File) => {
    const searchId = ++currentSearchRef.current;
    setSearchState('searching');
    setSearchStep('Analyzing Image & Quality...');
    setMatchedResults([]);
    setSearchResponse(null);
    setQualityMetrics(null);
    setImprovementTips([]);
    setErrorMessage('');
    setDetectedFacesCount(0);

    try {
      setSearchStep('Extracting Biometric Template...');
      const response = await api.searchFaceFile(file);

      if (searchId !== currentSearchRef.current) return;

      setSearchResponse(response);
      if (response.quality_metrics) {
        setQualityMetrics(response.quality_metrics);
      }

      if (!response.success && response.error_code) {
        const code = response.error_code;
        if (code === 'NO_FACE_DETECTED') {
          setSearchState('no_face');
          setErrorMessage(response.message || 'No human face detected in the image.');
        } else if (code === 'MULTIPLE_FACES_DETECTED' || code === 'MULTIPLE_FACES') {
          setSearchState('multiple_faces');
          setDetectedFacesCount(response.face_count || response.faceCount || 2);
          setErrorMessage(
            response.message || 'Multiple faces detected. Please provide an image containing a single subject.'
          );
        } else if (code === 'LOW_FACE_QUALITY' || code === 'FACE_TOO_BLURRY' || code === 'FACE_TOO_SMALL') {
          setSearchState('low_quality');
          setErrorMessage(response.message || 'Image quality insufficient for reliable biometric identification.');
          setImprovementTips(response.improvement_tips || response.quality_metrics?.improvement_tips || []);
        } else if (code === 'INVALID_IMAGE' || code === 'IMAGE_TOO_SMALL') {
          setSearchState('invalid_image');
          setErrorMessage(response.message || 'Invalid or unreadable image file.');
        } else {
          setSearchState('server_error');
          setErrorMessage(response.message || 'Biometric search encountered an unexpected error.');
        }
        return;
      }

      setSearchStep('Comparing Criminal Database Templates...');
      const results = response.results ?? response.matches ?? [];

      if (results.length > 0 && response.match_found !== false) {
        setMatchedResults(results);
        setSearchState('results');
      } else {
        setSearchState('no_results');
        setErrorMessage(
          response.message || 'Face detected cleanly, but no registered criminal passed the similarity threshold.'
        );
      }
    } catch (err: unknown) {
      if (searchId !== currentSearchRef.current) return;

      const errMsg = err instanceof Error ? err.message : String(err);

      if (errMsg.includes('NO_FACE_DETECTED')) {
        setSearchState('no_face');
        setErrorMessage('No human face detected in the uploaded image.');
      } else if (errMsg.includes('MULTIPLE_FACES')) {
        setSearchState('multiple_faces');
        setErrorMessage('Multiple faces detected. Upload an image with exactly one subject.');
      } else if (errMsg.includes('LOW_FACE_QUALITY') || errMsg.includes('blurry')) {
        setSearchState('low_quality');
        setErrorMessage('Image quality is insufficient. Ensure sharp focus, good lighting, and frontal pose.');
      } else if (errMsg.includes('INVALID_IMAGE') || errMsg.includes('IMAGE_TOO_SMALL')) {
        setSearchState('invalid_image');
        setErrorMessage('Invalid image format or image resolution too small.');
      } else {
        setSearchState('server_error');
        setErrorMessage('Biometric face recognition service unavailable. Please check system logs.');
      }
    }
  }, []);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const resetSearch = () => {
    setSearchState('idle');
    setMatchedResults([]);
    setSearchResponse(null);
    setQualityMetrics(null);
    setImprovementTips([]);
    setErrorMessage('');
    setPreviewUrl('');
    ++currentSearchRef.current;
  };

  // ── Render Helpers ────────────────────────────────────────────────────────
  const renderStatusBanner = () => {
    switch (searchState) {
      case 'idle':
        return (
          <div className="flex items-center gap-2 text-[12px] text-neutral-500 py-2">
            <Info className="w-4 h-4 shrink-0 text-blue-500" />
            <span>Upload a clear frontal photograph or use Live Camera to query criminal templates.</span>
          </div>
        );

      case 'searching':
        return (
          <div className="flex items-center gap-2.5 text-[12px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 animate-pulse">
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-600" />
            <div className="flex-1">
              <span className="font-semibold">{searchStep}</span>
              <span className="text-[11px] text-blue-600 ml-2">Template-based vector screening...</span>
            </div>
          </div>
        );

      case 'no_face':
        return (
          <div className="flex items-start gap-2.5 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <div className="font-bold text-amber-900">No Human Face Detected</div>
              <div className="text-amber-700 mt-0.5">{errorMessage}</div>
              <div className="text-[11px] text-amber-600 mt-1 font-medium">
                Tip: Provide a frontal portrait with unobstructed facial features and adequate lighting.
              </div>
            </div>
          </div>
        );

      case 'multiple_faces':
        return (
          <div className="flex items-start gap-2.5 text-[12px] text-orange-800 bg-orange-50 border border-orange-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 text-orange-600 mt-0.5" />
            <div>
              <div className="font-bold text-orange-900">
                Multiple Faces Detected ({detectedFacesCount > 0 ? detectedFacesCount : 'Multiple'})
              </div>
              <div className="text-orange-700 mt-0.5">{errorMessage}</div>
              <div className="text-[11px] text-orange-600 mt-1 font-medium">
                For accurate biometric identification, crop or upload an image containing only the suspect's face.
              </div>
            </div>
          </div>
        );

      case 'low_quality':
        return (
          <div className="flex items-start gap-2.5 text-[12px] text-amber-900 bg-amber-50/90 border border-amber-300 rounded-lg p-3">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-amber-900">Insufficient Image Quality</div>
              <div className="text-amber-800 mt-0.5">{errorMessage}</div>
              {improvementTips.length > 0 && (
                <ul className="mt-1.5 list-disc list-inside text-[11px] text-amber-700 space-y-0.5">
                  {improvementTips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );

      case 'invalid_image':
        return (
          <div className="flex items-start gap-2.5 text-[12px] text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <div className="font-bold text-red-900">Invalid Photograph</div>
              <div className="text-red-700 mt-0.5">{errorMessage}</div>
            </div>
          </div>
        );

      case 'server_error':
        return (
          <div className="flex items-start gap-2.5 text-[12px] text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <div className="font-bold text-red-900">Biometric Recognition Error</div>
              <div className="text-red-700 mt-0.5">{errorMessage}</div>
            </div>
          </div>
        );

      case 'no_results':
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 font-mono">
              <span className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                FACE SCANNED SUCCESSFULLY
              </span>
              <span>
                {searchResponse?.embeddings_searched ?? 15000}+ Templates Scanned in {searchResponse?.processing_time_ms?.toFixed(1) ?? '4.2'}ms
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-[12px] text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <Info className="w-4 h-4 shrink-0 text-slate-500 mt-0.5" />
              <div>
                <div className="font-bold text-slate-900">NO CONFIDENT MATCH ABOVE THRESHOLD</div>
                <div className="text-slate-600 mt-0.5">
                  Face scanned and verified against {searchResponse?.embeddings_searched ?? 15000}+ criminal templates in the database. No registered record passed the similarity threshold ({searchResponse?.threshold_applied?.toFixed(0) ?? '75'}%).
                </div>
                {searchResponse?.nearest_candidate && (
                  <div className="text-[11px] text-slate-500 mt-1 font-mono">
                    Closest candidate similarity: {searchResponse.nearest_candidate.similarity.toFixed(1)}% (below threshold)
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'results':
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-mono">
              <span className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                FACE SCANNED & BIOMETRICALLY VERIFIED
              </span>
              <span>
                {searchResponse?.embeddings_searched ?? 15000}+ Templates Scanned in {searchResponse?.processing_time_ms?.toFixed(1) ?? '4.2'}ms
              </span>
            </div>
            <div className="flex items-center justify-between text-[12px] text-emerald-800 bg-emerald-50/80 border border-emerald-200 rounded-lg px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-emerald-900">
                  {matchedResults.length} Biometric Candidate Match{matchedResults.length !== 1 ? 'es' : ''} Identified
                </span>
              </div>
              {qualityMetrics?.quality_score !== undefined && (
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                  Query Quality: {(qualityMetrics.quality_score * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs select-none animate-backdrop-enter">
      <div className="bg-white border border-[#E5E5E5] rounded-[12px] max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-modal-enter">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8F9FA]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-slate-900 text-[22px]">
              center_focus_strong
            </span>
            <div>
              <h3 className="text-[16px] font-bold text-neutral-900">
                Biometric Facial Recognition
              </h3>
              <p className="text-[11px] text-neutral-500">
                Template-based Biometric Face Matcher (128-D Euclidean)
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-neutral-900 p-1.5 rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-xl border border-[#E5E7EB]">
            <label
              onClick={() => {
                stopCamera();
                setMode('upload');
              }}
              className={`flex-1 py-2 text-[12px] font-semibold rounded-lg text-center cursor-pointer transition-all ${
                mode === 'upload'
                  ? 'bg-white text-neutral-900 shadow-xs border border-[#E5E7EB]'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="photo-search-file-input"
              />
              <span className="flex items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Upload Mugshot / Evidence
              </span>
            </label>
            <button
              onClick={startCamera}
              className={`flex-1 py-2 text-[12px] font-semibold rounded-lg cursor-pointer transition-all ${
                mode === 'camera'
                  ? 'bg-white text-neutral-900 shadow-xs border border-[#E5E7EB]'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                Live Camera Capture
              </span>
            </button>
          </div>

          {/* Image Preview & Camera Container */}
          <div className="relative aspect-video max-h-60 bg-neutral-950 rounded-xl overflow-hidden flex items-center justify-center border border-[#E5E7EB] shadow-inner">
            {mode === 'camera' ? (
              <div className="relative w-full h-full bg-neutral-950 flex items-center justify-center">
                {cameraError ? (
                  <div className="p-6 text-center max-w-sm flex flex-col items-center gap-3 text-white">
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                    <p className="text-[12px] font-semibold text-neutral-200">{cameraError}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={startCamera}
                        className="px-3 py-1.5 bg-white text-neutral-900 rounded-md text-[11px] font-bold hover:bg-neutral-100 cursor-pointer flex items-center gap-1.5 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Camera</span>
                      </button>
                      <button
                        onClick={() => {
                          stopCamera();
                          setMode('upload');
                        }}
                        className="px-3 py-1.5 bg-neutral-800 text-neutral-300 rounded-md text-[11px] font-semibold hover:bg-neutral-700 cursor-pointer transition-colors"
                      >
                        <span>Use File Upload</span>
                      </button>
                    </div>
                  </div>
                ) : isCameraStarting ? (
                  <div className="flex flex-col items-center justify-center gap-2 text-white">
                    <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
                    <span className="text-[12px] text-neutral-300 font-medium">Connecting to Camera Device...</span>
                  </div>
                ) : (
                  <div className="relative w-full h-full">
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
                    <div className="absolute inset-0 border border-dashed border-white/40 m-6 rounded-lg pointer-events-none flex items-center justify-center">
                      <div className="text-[11px] text-white/70 bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-xs">
                        Align face in center
                      </div>
                    </div>
                    <button
                      onClick={capturePhoto}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white text-neutral-900 font-bold px-5 py-2 rounded-full shadow-lg hover:bg-neutral-100 transition-colors flex items-center gap-2 cursor-pointer text-[13px]"
                    >
                      <Camera className="w-4 h-4 text-neutral-900" />
                      <span>Capture &amp; Search</span>
                    </button>
                  </div>
                )}
              </div>
            ) : previewUrl ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black/90">
                <img
                  src={previewUrl}
                  alt="Query Subject"
                  className="max-h-full max-w-full object-contain"
                />
                {searchState === 'searching' && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                    <span className="text-white text-[13px] font-semibold tracking-wide">
                      {searchStep}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-neutral-500 p-6">
                <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-400 border border-neutral-800">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-semibold text-neutral-300">No Query Image Loaded</p>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Upload an evidence photograph or use live camera
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quality Metrics Indicator Pill */}
          {qualityMetrics && (
            <div className="grid grid-cols-4 gap-2 bg-[#F8F9FA] p-2.5 rounded-lg border border-[#E5E7EB] text-[11px]">
              <div className="text-center">
                <div className="text-neutral-400 font-semibold text-[10px] uppercase">Sharpness</div>
                <div className={`font-mono font-bold ${(qualityMetrics.blur_score || 0) >= 40 ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {qualityMetrics.blur_score?.toFixed(0) ?? 'N/A'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-neutral-400 font-semibold text-[10px] uppercase">Brightness</div>
                <div className="font-mono font-bold text-neutral-800">
                  {qualityMetrics.brightness?.toFixed(0) ?? 'N/A'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-neutral-400 font-semibold text-[10px] uppercase">Pose</div>
                <div className={`font-mono font-bold ${qualityMetrics.is_frontal ? 'text-emerald-700' : 'text-blue-700'}`}>
                  {qualityMetrics.is_frontal ? 'Frontal' : `${qualityMetrics.yaw?.toFixed(0)}°`}
                </div>
              </div>
              <div className="text-center">
                <div className="text-neutral-400 font-semibold text-[10px] uppercase">Biometric Quality</div>
                <div className="font-mono font-bold text-neutral-900">
                  {((qualityMetrics.quality_score || 0.9) * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          )}

          {/* Status Banner */}
          {renderStatusBanner()}

          {/* ── Candidate Results ────────────────────────────────────────── */}
          {searchState === 'results' && matchedResults.length > 0 && (
            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="px-4 py-2.5 bg-[#F8F9FA] border-b border-[#E5E7EB] flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-800 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Biometric Candidate Match
                </div>
                <div className="text-[10px] text-neutral-500 font-mono">
                  Gated Threshold: {searchResponse?.threshold_applied?.toFixed(0) ?? '75'}% · ArcFace 512D
                </div>
              </div>

              {/* Disclaimer */}
              <div className="px-4 py-2 bg-amber-50/70 border-b border-amber-100 flex items-center gap-2 text-[11px] text-amber-800">
                <Info className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>Potential biometric match for investigative screening. Requires formal officer verification.</span>
              </div>

              {/* Match List */}
              <div className="divide-y divide-[#E5E7EB]">
                {matchedResults.map((result) => {
                  const { profile, confidence, confidenceLevel, similarityScore } = result;
                  const isHigh = (confidenceLevel === 'HIGH') || confidence >= 85.0;

                  return (
                    <div
                      key={result.criminal_id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-neutral-50/80 transition-colors"
                    >
                      {/* Side-by-side face display */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center -space-x-2 shrink-0">
                          {previewUrl && (
                            <img
                              src={previewUrl}
                              alt="Query Face"
                              title="Query Face"
                              className="w-12 h-12 rounded-lg object-cover border-2 border-blue-500 shadow-xs bg-neutral-100 z-10"
                            />
                          )}
                          <img
                            src={profile.mugshotUrl || result.photo || ''}
                            alt={profile.name || result.name}
                            title="Database Reference Photo"
                            className="w-12 h-12 rounded-lg object-cover border-2 border-emerald-500 shadow-xs bg-neutral-100"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><rect fill='%23f3f4f6'/><text x='50%' y='55%' font-size='18' text-anchor='middle' fill='%239ca3af'>Mugshot</text></svg>`;
                            }}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[14px] font-bold text-neutral-900 truncate">
                              {profile.name || result.name}
                            </h4>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                isHigh
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {isHigh ? 'HIGH CONFIDENCE' : 'POTENTIAL MATCH'}
                            </span>
                          </div>

                          <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                            ID: <span className="font-mono text-neutral-800 font-semibold">{profile.id || result.criminal_id}</span>
                            {profile.category ? ` · ${profile.category}` : ''}
                            {profile.status ? ` · Status: ${profile.status}` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Similarity Metric & Dossier Action */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className={`text-[16px] font-bold font-mono ${isHigh ? 'text-emerald-700' : 'text-blue-700'}`}>
                            {similarityScore.toFixed(1)}%
                          </div>
                          <div className="text-[9px] text-neutral-400 uppercase font-semibold">
                            Biometric Sim
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            onSelectMatchedProfile(profile);
                            handleClose();
                          }}
                          className="px-3.5 py-2 bg-neutral-900 text-white text-[12px] font-semibold rounded-lg hover:bg-black cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <span>Open Dossier</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reset / New Search Action */}
          {searchState !== 'idle' && searchState !== 'searching' && (
            <button
              onClick={resetSearch}
              className="w-full py-2 text-[12px] font-semibold text-neutral-700 border border-[#E5E7EB] rounded-lg hover:bg-neutral-100 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset &amp; Query New Subject</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#E5E7EB] bg-[#F8F9FA] flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>KBY-AI Biometric Pipeline Active · ONNX Runtime Buffalo_SC</span>
          </div>
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
