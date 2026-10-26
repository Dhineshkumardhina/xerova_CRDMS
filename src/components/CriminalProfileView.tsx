import React, { useState, useMemo } from 'react';
import { CriminalProfile, CaseRecord, MediaItem, DocumentItem } from '../types';
import { jsPDF } from 'jspdf';
import {
  Edit3,
  Archive,
  RotateCcw,
  Link as LinkIcon,
  Eye,
  EyeOff,
  Upload,
  ZoomIn,
  FileText,
  BadgeAlert,
  ArrowRight,
  User,
  Fingerprint,
  ChevronDown,
  ChevronUp,
  Gavel,
  ShieldAlert,
  ShieldCheck,
  Shield,
  FolderOpen,
  Printer,
  Download,
  AlertTriangle,
  Activity,
  Info
} from 'lucide-react';

interface CriminalProfileViewProps {
  profile?: CriminalProfile | null;
  onEdit: (profile: CriminalProfile) => void;
  onArchiveToggle: (profileId: string) => void;
  onOpenCaseModal: (caseRecord: CaseRecord) => void;
  onOpenMediaModal: (media: MediaItem) => void;
  onOpenDocModal: (doc: DocumentItem) => void;
  onUploadMedia: (profileId: string, file: File) => void;
  onUploadDoc: (profileId: string, title: string) => void;
}

export const CriminalProfileView: React.FC<CriminalProfileViewProps> = ({
  profile,
  onEdit,
  onArchiveToggle,
  onOpenCaseModal,
  onOpenMediaModal,
  onOpenDocModal,
  onUploadMedia,
  onUploadDoc,
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'previous' | 'categories'>('active');
  const [isIdRevealed, setIsIdRevealed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!profile) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[12px] p-12 text-center shadow-xs max-w-md mx-auto my-12 space-y-4">
        <div className="w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center mx-auto text-neutral-400">
          <User className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-neutral-900">No Profile Selected</h3>
          <p className="text-[13px] text-neutral-500 mt-1">
            Search existing records or create a new criminal profile to view and edit detailed docket information.
          </p>
        </div>
      </div>
    );
  }

  const toggleCollapse = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const activeCases = profile.cases.filter((c) => c.status !== 'Closed');
  const previousCases = profile.cases.filter((c) => c.status === 'Closed');

  // Dynamic Risk Assessment Score & Level calculation based on active cases and prior convictions
  const activeCasesCount = activeCases.length;
  const convictionsCount = profile.convictions ?? previousCases.length;

  // Composite Risk Score (0-100 scale)
  const riskAssessmentScore = Math.min(100, Math.max(5, (activeCasesCount * 30) + (convictionsCount * 15)));

  // Risk Level determination based on active cases & prior convictions
  let riskAssessmentLevel: 'High' | 'Medium' | 'Low' = 'Low';
  if (activeCasesCount >= 2 || convictionsCount >= 3 || riskAssessmentScore >= 50) {
    riskAssessmentLevel = 'High';
  } else if (activeCasesCount === 1 || convictionsCount >= 1 || riskAssessmentScore >= 20) {
    riskAssessmentLevel = 'Medium';
  } else {
    riskAssessmentLevel = 'Low';
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        onUploadMedia(profile.id, file);
      } else {
        onUploadDoc(profile.id, file.name);
      }
    }
  };

  const handleDownloadDossierPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Colors
      const slateBlue = '#3B5B7A';
      const textDark = '#171717';
      const textMuted = '#525252';

      // Header Banner
      doc.setFillColor(248, 249, 250);
      doc.rect(0, 0, 210, 30, 'F');

      // Title & Department
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(textDark);
      doc.text('CENTRAL LAW ENFORCEMENT DOSSIER', 14, 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(textMuted);
      doc.text(`RECORD REF: ${profile.id}  |  STATUS: ${profile.status.toUpperCase()}  |  GENERATED: ${new Date().toLocaleDateString()}`, 14, 22);

      // Section 1: Subject Identity
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(slateBlue);
      doc.text('1. SUBJECT IDENTIFICATION & DEMOGRAPHICS', 14, 38);

      doc.setDrawColor(229, 229, 229);
      doc.setLineWidth(0.5);
      doc.line(14, 41, 196, 41);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(textDark);
      doc.text(`Full Legal Name:`, 14, 48);
      doc.setFont('helvetica', 'normal');
      doc.text(`${profile.name}`, 55, 48);

      doc.setFont('helvetica', 'bold');
      doc.text(`Known Aliases:`, 14, 54);
      doc.setFont('helvetica', 'normal');
      doc.text(`${profile.alias || 'None Recorded'}`, 55, 54);

      doc.setFont('helvetica', 'bold');
      doc.text(`Date of Birth / Age:`, 14, 60);
      doc.setFont('helvetica', 'normal');
      doc.text(`${profile.dob} (${profile.age} yrs)`, 55, 60);

      doc.setFont('helvetica', 'bold');
      doc.text(`Gender / Nationality:`, 14, 66);
      doc.setFont('helvetica', 'normal');
      doc.text(`${profile.gender} / ${profile.nationality || 'Unspecified'}`, 55, 66);

      doc.setFont('helvetica', 'bold');
      doc.text(`Physical Build:`, 14, 72);
      doc.setFont('helvetica', 'normal');
      doc.text(`${profile.height || 'N/A'}, ${profile.weight || 'N/A'}, Hair: ${profile.hairColor || 'N/A'}, Eyes: ${profile.eyeColor || 'N/A'}`, 55, 72);

      doc.setFont('helvetica', 'bold');
      doc.text(`Identifying Scars/Marks:`, 14, 78);
      doc.setFont('helvetica', 'normal');
      doc.text(`${profile.identifyingMarks || 'None cataloged'}`, 55, 78);

      // Section 2: Threat & Classification
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(slateBlue);
      doc.text('2. THREAT ASSESSMENT & CLASSIFICATION', 14, 90);
      doc.line(14, 93, 196, 93);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(textDark);
      doc.text(`Current Status:`, 14, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(`${profile.status} ${profile.isArchived ? '(Archived)' : ''}`, 55, 100);

      doc.setFont('helvetica', 'bold');
      doc.text(`Threat Level:`, 14, 106);
      doc.setFont('helvetica', 'normal');
      doc.text(`${profile.threatLevel || 'Standard'} (Calculated Risk Level: ${riskAssessmentLevel.toUpperCase()}, Score: ${riskAssessmentScore}/100)`, 55, 106);

      doc.setFont('helvetica', 'bold');
      doc.text(`Crime Categories:`, 14, 112);
      doc.setFont('helvetica', 'normal');
      doc.text(`${(profile.crimeCategories || []).join(', ') || 'None specified'}`, 55, 112);

      doc.setFont('helvetica', 'bold');
      doc.text(`Last Known Location:`, 14, 118);
      doc.setFont('helvetica', 'normal');
      doc.text(`${profile.lastKnownLocation || 'Unknown'}`, 55, 118);

      // Section 3: Summary of Offenses
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(slateBlue);
      doc.text('3. CRIMINAL RECORD & CASE DOCKETS', 14, 130);
      doc.line(14, 133, 196, 133);

      let currentY = 140;
      if (profile.cases.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(textMuted);
        doc.text('No active or historical cases filed in this docket repository.', 14, currentY);
        currentY += 10;
      } else {
        profile.cases.forEach((c, idx) => {
          if (currentY > 265) {
            doc.addPage();
            currentY = 20;
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(textDark);
          doc.text(`${idx + 1}. [${c.caseNumber}] - Status: ${c.status}`, 14, currentY);
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(textMuted);
          doc.text(`Date Filed: ${c.dateFiled}  |  Penal Code: ${c.penalCode || 'N/A'}  |  Jurisdiction: ${c.jurisdiction || 'Local'}`, 18, currentY + 5);
          doc.text(`Description: ${c.description}`, 18, currentY + 10);
          currentY += 16;
        });
      }

      // Section 4: Biometrics & Official Footnote
      if (currentY > 255) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(slateBlue);
      doc.text('4. VERIFICATION & CUSTODIAL ATTESTATION', 14, currentY + 6);
      doc.line(14, currentY + 9, 196, currentY + 9);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(textMuted);
      doc.text(
        'This electronic document represents an official certified summary extracted from the Central Law Enforcement Information System. Unauthorized tampering, duplication, or transmission without judicial clearance is prohibited.',
        14,
        currentY + 16,
        { maxWidth: 182 }
      );

      // Save PDF
      doc.save(`DOSSIER_${profile.id}_${profile.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to generate Dossier PDF:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto w-full">
      {/* Page Header Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E5E7EB] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <span className="font-mono text-[13px] text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200 font-semibold">
              {profile.id}
            </span>
            {/* Risk Assessment Score Badge */}
            <div
              id="risk-assessment-score-badge"
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[12px] font-bold border shadow-xs ${
                riskAssessmentLevel === 'High'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : riskAssessmentLevel === 'Medium'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
              title={`Risk Score: ${riskAssessmentScore}/100 based on ${activeCasesCount} active case(s) and ${convictionsCount} prior conviction(s)`}
            >
              {riskAssessmentLevel === 'High' ? (
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              ) : riskAssessmentLevel === 'Medium' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>Risk Assessment: {riskAssessmentLevel} ({riskAssessmentScore}/100)</span>
            </div>
            {profile.isHistorical && (
              <span className="inline-flex items-center gap-1.5 bg-neutral-100 text-neutral-700 text-[12px] font-semibold px-2 py-0.5 rounded-md border border-neutral-200">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                Historical Record
              </span>
            )}
            {profile.isArchived && (
              <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[12px] font-bold px-2 py-0.5 rounded-md border border-red-200">
                ARCHIVED
              </span>
            )}
          </div>
          <h1 className="text-[24px] md:text-[28px] font-bold text-neutral-900 tracking-tight">
            Criminal Profile: {profile.name}
          </h1>
          {profile.alias && (
            <p className="text-[14px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
              <Fingerprint className="w-4 h-4 text-slate-500" />
              <span>Alias: &ldquo;<strong className="text-neutral-800">{profile.alias}</strong>&rdquo;</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleDownloadDossierPDF}
            id="download-dossier-pdf-button"
            className="bg-transparent text-[#3B5B7A] hover:bg-[#3B5B7A]/10 text-[12px] font-semibold px-3.5 py-2 rounded-[8px] transition-colors flex items-center gap-2 cursor-pointer"
            title="Download simplified dossier PDF"
          >
            <Download className="w-4 h-4" />
            <span>Download Full Dossier PDF</span>
          </button>
          <button
            onClick={() => window.print()}
            id="print-dossier-button"
            className="bg-white border border-[#E5E5E5] text-[#171717] text-[12px] font-semibold px-4 py-2 rounded-[8px] hover:bg-[#F3F3F4] transition-colors flex items-center gap-2 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            title="Print or export certified dossier record"
          >
            <Printer className="w-4 h-4 text-[#3B5B7A]" />
            <span>Print Dossier</span>
          </button>
          <button
            onClick={() => onEdit(profile)}
            className="bg-white border border-[#E5E5E5] text-[#171717] text-[12px] font-semibold px-4 py-2 rounded-[8px] hover:bg-[#F3F3F4] transition-colors flex items-center gap-2 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <Edit3 className="w-4 h-4 text-[#525252]" />
            <span>Edit Record</span>
          </button>
          <button
            onClick={() => onArchiveToggle(profile.id)}
            className={`text-[12px] font-semibold px-4 py-2 rounded-[8px] transition-colors flex items-center gap-2 cursor-pointer shadow-xs ${
              profile.isArchived
                ? 'bg-[#171717] text-white hover:bg-black'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {profile.isArchived ? (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Restore Record</span>
              </>
            ) : (
              <>
                <Archive className="w-4 h-4" />
                <span>Archive Record</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column (Overview & Identity) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          {/* 1. Profile Overview Card */}
          <section className="bg-white border border-[#E5E5E5] rounded-[10px] p-5 flex flex-col gap-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-start gap-4">
              {/* Mugshot */}
              <div className="w-32 h-44 bg-neutral-100 rounded-[8px] border border-[#E5E5E5] overflow-hidden shrink-0 relative shadow-xs">
                <img
                  src={profile.mugshotUrl}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 w-full bg-neutral-900/80 backdrop-blur-xs text-white font-mono text-[10px] py-1 text-center border-t border-neutral-800">
                  {profile.mugshotDate}
                </div>
              </div>

              {/* Basic metadata */}
              <div className="flex flex-col flex-1 gap-2.5 pt-0.5 min-w-0">
                <div>
                  <h3 className="text-[18px] font-bold text-[#171717] truncate mb-1">
                    {profile.name}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Calculated Risk Assessment Badge */}
                    <span
                      id="card-risk-assessment-badge"
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border shadow-2xs ${
                        riskAssessmentLevel === 'High'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : riskAssessmentLevel === 'Medium'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {riskAssessmentLevel === 'High' ? (
                        <ShieldAlert className="w-3 h-3 text-rose-600" />
                      ) : riskAssessmentLevel === 'Medium' ? (
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                      ) : (
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      )}
                      <span>{riskAssessmentLevel} Risk ({riskAssessmentScore}/100)</span>
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                      {profile.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <div className="bg-neutral-50 p-2.5 rounded-[8px] border border-[#E5E5E5]">
                    <div className="text-[11px] font-bold text-[#525252] mb-0.5 uppercase">
                      Total Cases
                    </div>
                    <div className="text-[20px] font-bold text-[#171717] leading-none font-mono">
                      {profile.totalCases.toString().padStart(2, '0')}
                    </div>
                  </div>
                  <div className="bg-neutral-50 p-2.5 rounded-[8px] border border-[#E5E5E5]">
                    <div className="text-[11px] font-bold text-[#525252] mb-0.5 uppercase">
                      Convictions
                    </div>
                    <div className="text-[20px] font-bold text-[#171717] leading-none font-mono">
                      {profile.convictions.toString().padStart(2, '0')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Automated Risk Assessment Calculation Matrix */}
            <div className="pt-3 border-t border-[#E5E5E5] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#171717] uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#3B5B7A]" />
                  <span>Risk Assessment Metric</span>
                </span>
                <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10.5px] ${
                  riskAssessmentLevel === 'High'
                    ? 'text-rose-700 bg-rose-50 border border-rose-200'
                    : riskAssessmentLevel === 'Medium'
                    ? 'text-amber-800 bg-amber-50 border border-amber-200'
                    : 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                }`}>
                  {riskAssessmentLevel.toUpperCase()} RISK • SCORE {riskAssessmentScore}/100
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/80">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    riskAssessmentLevel === 'High'
                      ? 'bg-rose-600'
                      : riskAssessmentLevel === 'Medium'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(8, riskAssessmentScore)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#525252]">
                <span>Active Cases Factor: <strong className="text-[#171717]">{activeCasesCount}</strong></span>
                <span>Prior Convictions: <strong className="text-[#171717]">{convictionsCount}</strong></span>
              </div>
            </div>
          </section>

          {/* 2. Personal Information */}
          <section className="bg-white border border-[#E5E5E5] rounded-[10px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div
              onClick={() => toggleCollapse('personal')}
              className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between cursor-pointer hover:bg-neutral-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-600 text-[20px]">badge</span>
                <h3 className="text-[15px] font-bold text-[#171717]">Personal Information</h3>
              </div>
              {collapsedSections['personal'] ? (
                <ChevronDown className="w-4 h-4 text-[#525252]" />
              ) : (
                <ChevronUp className="w-4 h-4 text-[#525252]" />
              )}
            </div>

            {!collapsedSections['personal'] && (
              <div className="p-4 flex flex-col gap-3.5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="col-span-2">
                    <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">
                      Full Name
                    </div>
                    <div className="text-[14px] font-semibold text-[#171717]">{profile.name}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">
                      Father&apos;s Name
                    </div>
                    <div className="text-[14px] text-[#171717]">{profile.fatherName || 'Unknown'}</div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">
                      DOB / Age
                    </div>
                    <div className="text-[14px] text-[#171717]">
                      {profile.dob} ({profile.age})
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">
                      Gender
                    </div>
                    <div className="text-[14px] text-[#171717]">{profile.gender}</div>
                  </div>

                  {profile.height && (
                    <div>
                      <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">
                        Height / Weight
                      </div>
                      <div className="text-[13px] font-mono text-[#171717]">
                        {profile.height} / {profile.weight}
                      </div>
                    </div>
                  )}

                  {profile.eyeColor && (
                    <div>
                      <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">
                        Eye Color
                      </div>
                      <div className="text-[13px] text-[#171717]">{profile.eyeColor}</div>
                    </div>
                  )}

                  <div className="col-span-2">
                    <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">
                      Phone
                    </div>
                    <div className="font-mono text-[13px] text-[#171717]">{profile.phone}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">
                      Identification Number
                    </div>
                    <div className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-[8px] border border-[#E5E5E5] group">
                      <span className="font-mono text-[13px] text-[#171717] tracking-widest font-semibold">
                        {isIdRevealed
                          ? profile.rawIdNumber || profile.identificationNumber
                          : profile.identificationNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsIdRevealed(!isIdRevealed)}
                        className="text-[12px] font-semibold text-[#525252] hover:text-[#171717] flex items-center gap-1 cursor-pointer"
                      >
                        {isIdRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{isIdRevealed ? 'Hide' : 'Reveal'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">
                      Primary Address
                    </div>
                    <div className="text-[13px] text-[#171717] leading-relaxed">
                      {profile.primaryAddress}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 3. Identification Marks */}
          <section className="bg-white border border-[#E5E5E5] rounded-[10px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div
              onClick={() => toggleCollapse('marks')}
              className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between cursor-pointer hover:bg-neutral-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-600 text-[20px]">
                  accessibility_new
                </span>
                <h3 className="text-[15px] font-bold text-[#171717]">Identification Marks</h3>
              </div>
              {collapsedSections['marks'] ? (
                <ChevronDown className="w-4 h-4 text-[#525252]" />
              ) : (
                <ChevronUp className="w-4 h-4 text-[#525252]" />
              )}
            </div>

            {!collapsedSections['marks'] && (
              <ul className="flex flex-col divide-y divide-[#E5E5E5]">
                {profile.identificationMarks.length === 0 ? (
                  <li className="p-4 text-[13px] text-[#525252]">No identification marks recorded.</li>
                ) : (
                  profile.identificationMarks.map((mark) => (
                    <li key={mark.id} className="px-4 py-3 flex gap-3 items-start hover:bg-neutral-50 transition-colors">
                      <span className="material-symbols-outlined text-slate-500 mt-0.5 text-[18px] shrink-0">
                        emergency
                      </span>
                      <div className="text-[13px] text-[#171717]">
                        <span className="font-semibold">{mark.description}</span>
                        {mark.detail && (
                          <div className="text-[11px] text-[#525252] mt-0.5">{mark.detail}</div>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </section>
        </div>

        {/* Right Column (Cases & Data) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {/* 4. Case History (Tabs & Table) */}
          <section className="bg-white border border-[#E5E5E5] rounded-[10px] overflow-hidden flex flex-col shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            {/* Tab Header */}
            <div className="flex border-b border-[#E5E5E5] bg-[#F8F9FA] px-2 pt-2 gap-1 overflow-x-auto hide-scrollbar">
              <button
                onClick={() => setActiveTab('active')}
                className={`px-4 py-2.5 text-[12px] font-semibold flex items-center gap-2 rounded-t-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'active'
                    ? 'border-b-2 border-slate-900 text-slate-900 bg-white font-bold'
                    : 'border-b-2 border-transparent text-[#525252] hover:text-[#171717] hover:bg-neutral-100'
                }`}
              >
                <Gavel className="w-4 h-4" />
                <span>Active Cases ({activeCases.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('previous')}
                className={`px-4 py-2.5 text-[12px] font-semibold flex items-center gap-2 rounded-t-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'previous'
                    ? 'border-b-2 border-slate-900 text-slate-900 bg-white font-bold'
                    : 'border-b-2 border-transparent text-[#525252] hover:text-[#171717] hover:bg-neutral-100'
                }`}
              >
                <span>Previous Cases ({previousCases.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('categories')}
                className={`px-4 py-2.5 text-[12px] font-semibold flex items-center gap-2 rounded-t-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'categories'
                    ? 'border-b-2 border-slate-900 text-slate-900 bg-white font-bold'
                    : 'border-b-2 border-transparent text-[#525252] hover:text-[#171717] hover:bg-neutral-100'
                }`}
              >
                <span>Categories &amp; Jurisdiction</span>
              </button>
            </div>

            {/* Table Content */}
            {activeTab !== 'categories' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[540px]">
                  <thead className="bg-[#F8F9FA] border-b border-[#E5E5E5]">
                    <tr>
                      <th className="px-4 py-2.5 text-[12px] font-bold text-[#525252] uppercase tracking-wider whitespace-nowrap">
                        Case ID
                      </th>
                      <th className="px-4 py-2.5 text-[12px] font-bold text-[#525252] uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-2.5 text-[12px] font-bold text-[#525252] uppercase tracking-wider whitespace-nowrap">
                        Date Filed
                      </th>
                      <th className="px-4 py-2.5 text-[12px] font-bold text-[#525252] uppercase tracking-wider whitespace-nowrap">
                        Status
                      </th>
                      <th className="px-4 py-2.5 text-[12px] font-bold text-[#525252] uppercase tracking-wider text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px] text-[#171717] divide-y divide-[#E5E5E5]">
                    {(activeTab === 'active' ? activeCases : previousCases).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[#525252]">
                          No cases in this view.
                        </td>
                      </tr>
                    ) : (
                      (activeTab === 'active' ? activeCases : previousCases).map((cs, idx) => (
                        <tr
                          key={cs.id}
                          className={`hover:bg-neutral-50 transition-colors ${
                            idx % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'
                          }`}
                        >
                          <td className="px-4 py-3 font-mono font-semibold text-[12px] whitespace-nowrap text-slate-800">
                            {cs.caseNumber}
                          </td>
                          <td className="px-4 py-3 max-w-[220px] truncate font-medium text-[#171717]" title={cs.description}>
                            {cs.description}
                          </td>
                          <td className="px-4 py-3 text-[#525252] whitespace-nowrap text-[12px]">
                            {cs.dateFiled}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {cs.status === 'Under Investigation' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-800 border border-slate-200">
                                Under Investigation
                              </span>
                            )}
                            {cs.status === 'Court Pending' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                Court Pending
                              </span>
                            )}
                            {cs.status === 'Warrant Issued' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                                Warrant Issued
                              </span>
                            )}
                            {cs.status === 'Pre-Trial' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                                Pre-Trial
                              </span>
                            )}
                            {cs.status === 'Closed' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Closed
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => onOpenCaseModal(cs)}
                              className="text-[#171717] font-semibold text-[12px] hover:underline cursor-pointer"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-50 rounded-[8px] border border-[#E5E5E5]">
                    <div className="text-[11px] font-bold text-[#525252] uppercase mb-1">
                      Primary Criminal Class
                    </div>
                    <div className="text-[16px] font-bold text-[#171717]">{profile.category}</div>
                    <p className="text-[12px] text-[#525252] mt-1">
                      Subject has documented offenses under Class A/B state criminal codes.
                    </p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-[8px] border border-[#E5E5E5]">
                    <div className="text-[11px] font-bold text-[#525252] uppercase mb-1">
                      Investigating Jurisdiction
                    </div>
                    <div className="text-[16px] font-bold text-[#171717]">{profile.city} Metropolitan District</div>
                    <p className="text-[12px] text-[#525252] mt-1">
                      Cross-jurisdiction alert status: Active in {profile.state} &amp; Regional circuits.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="px-4 py-3 border-t border-[#E5E5E5] bg-white flex justify-between items-center text-[#525252] text-[12px]">
              <span>Showing {activeTab === 'active' ? activeCases.length : previousCases.length} cases</span>
              <button
                onClick={() => setActiveTab(activeTab === 'active' ? 'previous' : 'active')}
                className="flex items-center gap-1 hover:text-[#171717] transition-colors font-semibold cursor-pointer"
              >
                <span>Switch Tab View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>

          {/* 5. Documents & Media */}
          <section className="bg-white border border-[#E5E5E5] rounded-[10px] p-5 flex flex-col gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-600 text-[20px]">
                  perm_media
                </span>
                <h3 className="text-[16px] font-bold text-[#171717]">Documents &amp; Media</h3>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,application/pdf"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[#171717] text-[12px] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload File</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Profile Images */}
              {profile.media.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onOpenMediaModal(item)}
                  className="group relative aspect-square bg-neutral-100 rounded-[8px] border border-[#E5E5E5] overflow-hidden cursor-pointer shadow-xs hover:border-slate-400 transition-all"
                >
                  <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-neutral-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2 text-center">
                    <ZoomIn className="w-5 h-5 text-white" />
                    <span className="text-white text-[11px] font-medium truncate w-full">
                      {item.filename}
                    </span>
                  </div>
                </div>
              ))}

              {/* Documents */}
              {profile.documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onOpenDocModal(doc)}
                  className="aspect-square bg-neutral-50 hover:bg-neutral-100 transition-colors rounded-[8px] border border-[#E5E5E5] flex flex-col items-center justify-center gap-2 cursor-pointer p-3 text-center group shadow-xs hover:border-slate-400"
                >
                  <span className="material-symbols-outlined text-[32px] text-slate-600 group-hover:text-slate-900 transition-colors">
                    picture_as_pdf
                  </span>
                  <div
                    className="text-[11px] font-semibold text-[#171717] truncate w-full px-1"
                    title={doc.filename}
                  >
                    {doc.filename}
                  </div>
                  <div className="font-mono text-[9px] text-[#525252]">{doc.size}</div>
                </div>
              ))}

              {/* Add More Media Tile */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square border-2 border-dashed border-[#E5E5E5] hover:border-slate-400 rounded-[8px] flex flex-col items-center justify-center gap-1 text-[#525252] hover:text-[#171717] cursor-pointer transition-colors p-2 text-center bg-white"
              >
                <Upload className="w-5 h-5 text-slate-500" />
                <span className="text-[11px] font-semibold">Add Evidence</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
