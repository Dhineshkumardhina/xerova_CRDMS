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
  Info,
  Users,
  Share2,
  Phone,
  MapPin,
  Globe,
  AtSign,
  ExternalLink,
  CreditCard,
  Smartphone
} from 'lucide-react';

interface CriminalProfileViewProps {
  profile?: CriminalProfile | null;
  onEdit: (profile: CriminalProfile) => void;
  onArchiveToggle: (profileId: string) => void;
  onOpenCaseModal: (caseRecord: CaseRecord) => void;
  onOpenMediaModal: (media: MediaItem) => void;
  onOpenDocModal: (doc: DocumentItem) => void;
  onUploadMedia: (profileId: string, file: File) => void;
  onUploadDoc: (profileId: string, file: File) => void;
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
        onUploadDoc(profile.id, file);
      }
    }
  };

  const getImageFormat = (url: string): string => {
    if (url.startsWith('data:image/png')) return 'PNG';
    if (url.startsWith('data:image/webp')) return 'WEBP';
    if (url.includes('.png')) return 'PNG';
    if (url.includes('.webp')) return 'WEBP';
    return 'JPEG';
  };

  const handleDownloadDossierPDF = async () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const slateBlue = '#3B5B7A';
      const textDark = '#0F172A';
      const textMuted = '#475569';

      let currentY = 36;

      const checkPageBreak = (neededHeight: number) => {
        if (currentY + neededHeight > 268) {
          doc.addPage();
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`CENTRAL CRIMINAL ARCHIVE // RECORD REF: ${profile.id}`, 14, 12);
          doc.text(`SUBJECT: ${profile.name.toUpperCase()}`, 196, 12, { align: 'right' });
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.4);
          doc.line(14, 14, 196, 14);
          currentY = 22;
        }
      };

      // ==========================================
      // CLEAN HUMAN-DESIGNED DOCUMENT HEADER
      // ==========================================
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('POLICE DEPARTMENT • CRIMINAL RECORDS DIVISION', 14, 15);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text('Criminal Record Dossier', 14, 22);

      // Top Right Reference & Date
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Record ID: ${profile.id}`, 196, 15, { align: 'right' });
      doc.text(`Date Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, 196, 20, { align: 'right' });
      doc.text('Official Copy', 196, 25, { align: 'right' });

      // Clean separator rule
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.6);
      doc.line(14, 28, 196, 28);

      currentY = 35;

      // ==========================================
      // SECTION 1: SUBJECT PROFILE & DEMOGRAPHICS (WITH PHOTO)
      // ==========================================
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Subject Profile & Demographics', 14, currentY);
      currentY += 4;

      // Photo Dimensions in mm: 32mm width x 40mm height
      const photoX = 14;
      const photoY = currentY;
      const photoW = 32;
      const photoH = 40;

      // Draw photo container border/placeholder
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(photoX, photoY, photoW, photoH, 1, 1, 'FD');

      let photoAdded = false;

      // 1. First attempt: grab directly from rendered DOM <img> element if already loaded in browser
      try {
        const domImg = document.querySelector('img[alt="' + profile.name + '"]') as HTMLImageElement | null;
        if (domImg && domImg.complete && domImg.naturalWidth > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = domImg.naturalWidth || 200;
          canvas.height = domImg.naturalHeight || 250;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(domImg, 0, 0);
            const dataUri = canvas.toDataURL('image/jpeg', 0.9);
            doc.addImage(dataUri, 'JPEG', photoX, photoY, photoW, photoH - 4.5);
            photoAdded = true;
          }
        }
      } catch (e) {
        // Fall through to network/dataURI fetch
      }

      // 2. Second attempt: Data URI or fetch/blob conversion
      if (!photoAdded && profile.mugshotUrl) {
        try {
          if (profile.mugshotUrl.startsWith('data:image/')) {
            const format = getImageFormat(profile.mugshotUrl);
            doc.addImage(profile.mugshotUrl, format, photoX, photoY, photoW, photoH - 4.5);
            photoAdded = true;
          } else {
            // Fetch as blob first to completely bypass Canvas cross-origin tainting
            const res = await fetch(profile.mugshotUrl, { mode: 'cors' }).catch(() => null);
            if (res && res.ok) {
              const blob = await res.blob();
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(blob);
              });
              if (base64) {
                const format = getImageFormat(base64);
                doc.addImage(base64, format, photoX, photoY, photoW, photoH - 4.5);
                photoAdded = true;
              }
            }

            // If fetch failed (e.g. strict CORS without headers), try Image onload with fallback
            if (!photoAdded) {
              const imgData = await new Promise<string>((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || 200;
                    canvas.height = img.naturalHeight || 250;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.drawImage(img, 0, 0);
                      resolve(canvas.toDataURL('image/jpeg', 0.9));
                      return;
                    }
                  } catch (err) {
                    // Canvas tainted
                  }
                  resolve('');
                };
                img.onerror = () => resolve('');
                img.src = profile.mugshotUrl;
              });

              if (imgData) {
                doc.addImage(imgData, 'JPEG', photoX, photoY, photoW, photoH - 4.5);
                photoAdded = true;
              }
            }
          }
        } catch (e) {
          console.warn('Could not embed profile mugshot into PDF:', e);
        }
      }

      if (!photoAdded) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('PHOTO', photoX + photoW / 2, photoY + 18, { align: 'center' });
        doc.text('ATTACHMENT', photoX + photoW / 2, photoY + 22, { align: 'center' });
      }

      // Intake date badge at bottom of photo
      doc.setFillColor(248, 250, 252);
      doc.rect(photoX, photoY + photoH - 4.5, photoW, 4.5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.line(photoX, photoY + photoH - 4.5, photoX + photoW, photoY + photoH - 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Intake: ${profile.mugshotDate || 'Recent'}`, photoX + photoW / 2, photoY + photoH - 1.5, { align: 'center' });

      // Demographics Card (To the right of photo: starts at x = 49, width = 147)
      const demoBoxX = 49;
      const demoBoxW = 147;
      const col1LblX = 52;
      const col1ValX = 78;
      const col2LblX = 120;
      const col2ValX = 148;

      const idRows = [
        {
          leftLbl: 'Full Name:',
          leftVal: profile.name,
          rightLbl: 'Phone:',
          rightVal: profile.phone || 'Unlisted',
        },
        {
          leftLbl: 'Known Aliases:',
          leftVal: profile.alias || 'None',
          rightLbl: 'National ID:',
          rightVal: profile.rawIdNumber || profile.identificationNumber || 'Not recorded',
        },
        {
          leftLbl: "Father's Name:",
          leftVal: profile.fatherName || 'Not recorded',
          rightLbl: 'Device IMEI:',
          rightVal: profile.imei || 'Not recorded',
        },
        {
          leftLbl: 'DOB / Age:',
          leftVal: `${profile.dob} (${profile.age} yrs)`,
          rightLbl: 'Category:',
          rightVal: profile.category,
        },
        {
          leftLbl: 'Gender:',
          leftVal: profile.gender,
          rightLbl: 'Status:',
          rightVal: `${profile.status} ${profile.isArchived ? '(Archived)' : ''}`,
        },
        {
          leftLbl: 'Physical Build:',
          leftVal: `${profile.height || '—'}, ${profile.weight || '—'}`,
          rightLbl: 'City & State:',
          rightVal: `${profile.city || '—'}, ${profile.state || '—'}`,
        },
        {
          leftLbl: 'Eye / Hair:',
          leftVal: `${profile.eyeColor || 'Brown'} / ${profile.hairColor || 'Dark'}`,
          rightLbl: 'Address:',
          rightVal: profile.primaryAddress || 'No fixed address registered',
        },
      ];

      doc.setFontSize(8);
      let totalCardH = 3;
      const rowLayouts = idRows.map((row) => {
        const leftValLines = doc.splitTextToSize(String(row.leftVal), 40);
        const rightValLines = doc.splitTextToSize(String(row.rightVal), 46);
        const lineCount = Math.max(leftValLines.length, rightValLines.length);
        const rowHeight = Math.max(5.2, lineCount * 3.4 + 1.8);
        totalCardH += rowHeight;
        return { ...row, leftValLines, rightValLines, rowHeight };
      });

      const actualBoxH = Math.max(photoH, totalCardH);

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(demoBoxX, currentY, demoBoxW, actualBoxH, 1, 1, 'FD');
      doc.line(116, currentY, 116, currentY + actualBoxH);

      let rowY = currentY + 4.5;
      rowLayouts.forEach((r) => {
        // Left Column
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(r.leftLbl, col1LblX, rowY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(textDark);
        doc.text(r.leftValLines, col1ValX, rowY);

        // Right Column
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(r.rightLbl, col2LblX, rowY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(textDark);
        doc.text(r.rightValLines, col2ValX, rowY);

        rowY += r.rowHeight;
      });

      currentY += actualBoxH + 7;

      // ==========================================
      // SECTION 2: RECORD OVERVIEW & RISK
      // ==========================================
      checkPageBreak(26);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(textDark);
      doc.text('Record Overview', 14, currentY);
      currentY += 4;

      const cardW = 58;
      const cardH = 14;
      const cardGap = 4;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, currentY, cardW, cardH, 1, 1, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('SECURITY RISK LEVEL', 17, currentY + 4.5);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textDark);
      doc.text(`${riskAssessmentLevel} (${riskAssessmentScore}/100)`, 17, currentY + 10.5);

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14 + cardW + cardGap, currentY, cardW, cardH, 1, 1, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('ACTIVE CASES', 17 + cardW + cardGap, currentY + 4.5);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textDark);
      doc.text(`${activeCasesCount} Active Case(s)`, 17 + cardW + cardGap, currentY + 10.5);

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14 + (cardW + cardGap) * 2, currentY, cardW, cardH, 1, 1, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('RECORDED CONVICTIONS', 17 + (cardW + cardGap) * 2, currentY + 4.5);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textDark);
      doc.text(`${convictionsCount} Recorded`, 17 + (cardW + cardGap) * 2, currentY + 10.5);

      currentY += cardH + 7;

      // ==========================================
      // SECTION 3: PHYSICAL IDENTIFICATION MARKS
      // ==========================================
      if (profile.identificationMarks && profile.identificationMarks.length > 0) {
        checkPageBreak(25);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(textDark);
        doc.text('Identifying Marks & Scars', 14, currentY);
        currentY += 4;

        profile.identificationMarks.forEach((m) => {
          const detailText = m.detail ? ` — ${m.detail}` : '';
          const markLines = doc.splitTextToSize(`• ${m.description}${detailText}`, 174);
          const mHeight = Math.max(6, markLines.length * 3.8 + 2);
          checkPageBreak(mHeight + 2);

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(14, currentY, 182, mHeight, 0.8, 0.8, 'FD');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(textDark);
          doc.text(markLines, 17, currentY + 4);
          currentY += mHeight + 2;
        });
        currentY += 4;
      }

      // ==========================================
      // SECTION 4: CRIMINAL RECORD & CASE DOCKETS
      // ==========================================
      checkPageBreak(35);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(textDark);
      doc.text(`Case Dockets & Judicial History (${profile.cases.length})`, 14, currentY);
      currentY += 4;

      if (!profile.cases || profile.cases.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text('No active or historical cases on record.', 14, currentY + 4);
        currentY += 10;
      } else {
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.rect(14, currentY, 182, 6.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text('#', 16, currentY + 4.5);
        doc.text('CASE NO.', 23, currentY + 4.5);
        doc.text('DATE FILED', 55, currentY + 4.5);
        doc.text('STATUS', 80, currentY + 4.5);
        doc.text('CODE / COURT', 106, currentY + 4.5);
        doc.text('OFFENSE SUMMARY', 142, currentY + 4.5);
        currentY += 6.5;

        profile.cases.forEach((c, idx) => {
          const descLines = doc.splitTextToSize(c.description || 'No description filed', 50);
          const rowH = Math.max(7, descLines.length * 3.8 + 2.5);
          checkPageBreak(rowH + 2);

          doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
          doc.rect(14, currentY, 182, rowH, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.line(14, currentY + rowH, 196, currentY + rowH);

          doc.setFontSize(8);
          doc.setTextColor(textDark);
          doc.setFont('helvetica', 'normal');
          doc.text(String(idx + 1), 16, currentY + 4.2);
          doc.setFont('helvetica', 'bold');
          doc.text(c.caseNumber, 23, currentY + 4.2);
          doc.setFont('helvetica', 'normal');
          doc.text(c.dateFiled, 55, currentY + 4.2);
          doc.text(c.status, 80, currentY + 4.2);
          doc.text(`${c.penalCode || c.jurisdiction || '—'}`, 106, currentY + 4.2, { maxWidth: 33 });
          doc.text(descLines, 142, currentY + 4.2);

          currentY += rowH;
        });
        currentY += 6;
      }

      // ==========================================
      // SECTION 5: KNOWN RELATIVES & NEXT OF KIN
      // ==========================================
      if (profile.relatives && profile.relatives.length > 0) {
        checkPageBreak(30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(textDark);
        doc.text(`Family & Next of Kin (${profile.relatives.length})`, 14, currentY);
        currentY += 4;

        profile.relatives.forEach((r) => {
          const addrLines = doc.splitTextToSize(r.address || 'No registered residential address', 76);
          const relBoxH = Math.max(13, 7 + addrLines.length * 3.8);
          checkPageBreak(relBoxH + 3);

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(203, 213, 225);
          doc.roundedRect(14, currentY, 182, relBoxH, 1, 1, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text(r.relation.toUpperCase(), 18, currentY + 5);

          doc.setFontSize(8.5);
          doc.setTextColor(textDark);
          doc.text(r.name, 48, currentY + 5);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text('Phone:', 102, currentY + 5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(textDark);
          doc.text(r.phone || '—', 114, currentY + 5);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text('National ID:', 148, currentY + 5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(textDark);
          doc.text(r.aadhaar || '—', 166, currentY + 5);

          // Line 2: Residential Address
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text('Address:', 18, currentY + 10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(textDark);
          doc.text(addrLines, 33, currentY + 10);

          currentY += relBoxH + 2.5;
        });
        currentY += 3;
      }

      // ==========================================
      // SECTION 6: VERIFICATION & SIGNATURES BLOCK
      // ==========================================
      checkPageBreak(30);
      currentY += 4;
      doc.setDrawColor(203, 213, 225);
      doc.line(14, currentY, 196, currentY);
      currentY += 4;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Certified as an accurate record from the department database on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`,
        14,
        currentY
      );
      currentY += 10;

      // 3 Clean Signature Lines
      const sigColW = 54;
      const sigGap = 10;

      // Col 1: Reporting Officer
      doc.setDrawColor(148, 163, 184);
      doc.line(14, currentY + 8, 14 + sigColW, currentY + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(textDark);
      doc.text('Reporting Officer', 14, currentY + 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Signature & Badge No.', 14, currentY + 17);

      // Col 2: Station In-Charge
      doc.line(14 + sigColW + sigGap, currentY + 8, 14 + sigColW * 2 + sigGap, currentY + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(textDark);
      doc.text('Station In-Charge', 14 + sigColW + sigGap, currentY + 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Approval & Date', 14 + sigColW + sigGap, currentY + 17);

      // Col 3: Records Custodian
      doc.line(14 + (sigColW + sigGap) * 2, currentY + 8, 196, currentY + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(textDark);
      doc.text('Records Custodian', 14 + (sigColW + sigGap) * 2, currentY + 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Verification Seal', 14 + (sigColW + sigGap) * 2, currentY + 17);

      // Running page footers
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(14, 285, 196, 285);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Police Department Criminal Records • Official Dossier Copy', 14, 290);
        doc.text(`Page ${p} of ${totalPages}`, 196, 290, { align: 'right' });
      }

      // Save PDF
      doc.save(`Record_${profile.id}_${profile.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to generate Dossier PDF:', err);
    }
  };

  const handleDownloadCSV = () => {
    try {
      const headers = [
        'Record ID',
        'Full Legal Name',
        'Aliases',
        "Father's Name",
        'Date of Birth',
        'Age',
        'Gender',
        'Contact Phone',
        'Aadhaar Number (UIDAI)',
        'Device IMEI Number',
        'Primary Address',
        'City',
        'State',
        'Crime Category',
        'Calculated Risk Level',
        'Risk Assessment Score',
        'Record Status',
        'Total Cases',
        'Prior Convictions',
        'Known Relatives Summary',
        'Social Media Handles Summary',
        'Export Date'
      ];

      const relativesSummary = (profile.relatives || [])
        .map((r) => `${r.relation}: ${r.name} (Phone: ${r.phone || 'N/A'}, Aadhaar: ${r.aadhaar || 'N/A'}, IMEI: ${r.imei || 'N/A'})`)
        .join('; ');

      const socialSummary = (profile.socialMedia || [])
        .map((s) => `${s.platform}: ${s.handle}`)
        .join('; ');

      const row = [
        profile.id,
        profile.name,
        profile.alias || '',
        profile.fatherName || '',
        profile.dob,
        profile.age,
        profile.gender,
        profile.phone || '',
        profile.rawIdNumber || profile.identificationNumber || '',
        profile.imei || '',
        profile.primaryAddress || '',
        profile.city || '',
        profile.state || '',
        profile.category,
        riskAssessmentLevel,
        riskAssessmentScore,
        profile.status,
        profile.totalCases,
        profile.convictions,
        relativesSummary,
        socialSummary,
        new Date().toISOString()
      ];

      const escapeCSV = (val: any) => {
        const s = String(val ?? '').replace(/"/g, '""');
        return `"${s}"`;
      };

      const csvContent = [
        headers.map(escapeCSV).join(','),
        row.map(escapeCSV).join(',')
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `RECORD_${profile.id}_${profile.name.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto w-full">
      {/* ========================================================= */}
      {/* 1. SCREEN VIEW (Visible on web interface, HIDDEN on print) */}
      {/* ========================================================= */}
      <div className="space-y-6 print:hidden">
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

        <div className="flex items-center gap-3 flex-wrap print:hidden">
          <button
            onClick={handleDownloadDossierPDF}
            id="download-dossier-pdf-button"
            className="bg-[#171717] hover:bg-black text-white text-[12px] font-semibold px-3.5 py-2 rounded-[8px] transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            title="Export aligned, official certified dossier PDF"
          >
            <Download className="w-4 h-4" />
            <span>Export Dossier (PDF)</span>
          </button>
          <button
            onClick={handleDownloadCSV}
            id="download-record-csv-button"
            className="bg-white border border-[#E5E5E5] text-[#171717] hover:bg-[#F3F3F4] text-[12px] font-semibold px-3.5 py-2 rounded-[8px] transition-colors flex items-center gap-2 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            title="Export aligned CSV spreadsheet of criminal record"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Export CSV Data</span>
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
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start printable-bento-grid">
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
          <section className="bg-white border border-[#E5E5E5] rounded-[10px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] print:border-slate-300 print:shadow-none break-inside-avoid">
            <div
              onClick={() => toggleCollapse('personal')}
              className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between cursor-pointer hover:bg-neutral-100 transition-colors print:bg-slate-100 print:border-slate-300"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-600 text-[20px] print:hidden">badge</span>
                <h3 className="text-[15px] font-bold text-[#171717] print:text-slate-900">Personal Information</h3>
              </div>
              <div className="print:hidden">
                {collapsedSections['personal'] ? (
                  <ChevronDown className="w-4 h-4 text-[#525252]" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-[#525252]" />
                )}
              </div>
            </div>

            <div className={`p-4 flex flex-col gap-3.5 ${collapsedSections['personal'] ? 'hidden print:!flex' : 'flex'}`}>
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
                    {profile.dob} ({profile.age} yrs)
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
                    Contact Phone
                  </div>
                  <div className="font-mono text-[13px] text-[#171717]">{profile.phone || 'Unlisted'}</div>
                </div>

                <div className="col-span-2">
                  <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">
                    Aadhaar Card No (UIDAI) / National ID
                  </div>
                  <div className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-[8px] border border-[#E5E5E5] group print:border-slate-300 print:bg-white">
                    <span className="font-mono text-[13px] text-[#171717] tracking-widest font-semibold">
                      <span className="print:hidden">
                        {isIdRevealed
                          ? profile.rawIdNumber || profile.identificationNumber
                          : profile.identificationNumber}
                      </span>
                      <span className="hidden print:inline font-mono">
                        {profile.rawIdNumber || profile.identificationNumber}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsIdRevealed(!isIdRevealed)}
                      className="print:hidden text-[12px] font-semibold text-[#525252] hover:text-[#171717] flex items-center gap-1 cursor-pointer"
                    >
                      {isIdRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{isIdRevealed ? 'Hide' : 'Reveal'}</span>
                    </button>
                  </div>
                </div>

                {profile.imei && (
                  <div className="col-span-2">
                    <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">
                      Device IMEI No (Forensics &amp; Surveillance)
                    </div>
                    <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-[8px] border border-[#E5E5E5] print:border-slate-300 print:bg-white">
                      <Smartphone className="w-3.5 h-3.5 text-purple-600 shrink-0 print:hidden" />
                      <span className="font-mono text-[13px] font-semibold text-[#171717] tracking-wider">
                        {profile.imei}
                      </span>
                    </div>
                  </div>
                )}

                <div className="col-span-2">
                  <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">
                    Primary Address
                  </div>
                  <div className="text-[13px] text-[#171717] leading-relaxed">
                    {profile.primaryAddress || 'Unregistered Address'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Identification Marks */}
          <section className="bg-white border border-[#E5E5E5] rounded-[10px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] print:border-slate-300 print:shadow-none break-inside-avoid">
            <div
              onClick={() => toggleCollapse('marks')}
              className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between cursor-pointer hover:bg-neutral-100 transition-colors print:bg-slate-100 print:border-slate-300"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-600 text-[20px] print:hidden">
                  accessibility_new
                </span>
                <h3 className="text-[15px] font-bold text-[#171717] print:text-slate-900">Identification Marks &amp; Scars</h3>
              </div>
              <div className="print:hidden">
                {collapsedSections['marks'] ? (
                  <ChevronDown className="w-4 h-4 text-[#525252]" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-[#525252]" />
                )}
              </div>
            </div>

            <div className={collapsedSections['marks'] ? 'hidden print:!block' : 'block'}>
              <ul className="flex flex-col divide-y divide-[#E5E5E5] print:divide-slate-200">
                {profile.identificationMarks.length === 0 ? (
                  <li className="p-4 text-[13px] text-[#525252]">No identification marks recorded.</li>
                ) : (
                  profile.identificationMarks.map((mark) => (
                    <li key={mark.id} className="px-4 py-3 flex gap-3 items-start hover:bg-neutral-50 transition-colors">
                      <span className="material-symbols-outlined text-slate-500 mt-0.5 text-[18px] shrink-0 print:hidden">
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
            </div>
          </section>

          {/* 4. Known Relatives & Emergency Contacts */}
          <section className="bg-white border border-[#E5E5E5] rounded-[10px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] print:border-slate-300 print:shadow-none break-inside-avoid">
            <div
              onClick={() => toggleCollapse('relatives')}
              className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between cursor-pointer hover:bg-neutral-100 transition-colors print:bg-slate-100 print:border-slate-300"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700 print:hidden" />
                <h3 className="text-[15px] font-bold text-[#171717] print:text-slate-900">Known Relatives &amp; Next of Kin</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-neutral-200/80 text-[#525252] print:bg-slate-200">
                  {(profile.relatives || []).length}
                </span>
                <div className="print:hidden">
                  {collapsedSections['relatives'] ? (
                    <ChevronDown className="w-4 h-4 text-[#525252]" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-[#525252]" />
                  )}
                </div>
              </div>
            </div>

            <div className={collapsedSections['relatives'] ? 'hidden print:!block' : 'block'}>
              <ul className="flex flex-col divide-y divide-[#E5E5E5] print:divide-slate-200">
                {(!profile.relatives || profile.relatives.length === 0) ? (
                  <li className="p-4 text-[13px] text-[#525252] italic">
                    No relatives or next of kin recorded for this subject.
                  </li>
                ) : (
                  profile.relatives.map((rel) => (
                    <li key={rel.id} className="p-3.5 hover:bg-neutral-50 transition-colors flex items-start gap-3">
                      {rel.photoUrl ? (
                        <img
                          src={rel.photoUrl}
                          alt={rel.name}
                          onClick={() => onOpenMediaModal?.({
                            id: rel.id,
                            title: `${rel.name} (${rel.relation})`,
                            filename: `${rel.name}.jpg`,
                            type: 'photo',
                            url: rel.photoUrl!
                          })}
                          className="w-11 h-11 rounded-lg object-cover border border-[#E5E5E5] shadow-xs shrink-0 cursor-pointer hover:ring-2 hover:ring-[#3B5B7A] transition-all print:cursor-default"
                          title="Photo"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-neutral-100 border border-[#E5E5E5] flex items-center justify-center text-neutral-600 font-bold text-[14px] shrink-0">
                          {rel.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 shrink-0">
                            {rel.relation}
                          </span>
                          <span className="text-[13px] font-bold text-[#171717] truncate">
                            {rel.name}
                          </span>
                        </div>
                        {rel.phone && (
                          <div className="text-[12px] font-mono text-[#525252] flex items-center gap-1.5 pt-0.5">
                            <Phone className="w-3.5 h-3.5 text-neutral-400 print:hidden" />
                            <span>Phone: {rel.phone}</span>
                          </div>
                        )}
                        {rel.aadhaar && (
                          <div className="text-[12px] font-mono text-slate-700 flex items-center gap-1.5 pt-0.5">
                            <CreditCard className="w-3.5 h-3.5 text-slate-500 print:hidden" />
                            <span>Aadhaar: {rel.aadhaar}</span>
                          </div>
                        )}
                        {rel.imei && (
                          <div className="text-[12px] font-mono text-purple-700 flex items-center gap-1.5 pt-0.5">
                            <Smartphone className="w-3.5 h-3.5 text-purple-500 print:hidden" />
                            <span>IMEI: {rel.imei}</span>
                          </div>
                        )}
                        {rel.address && (
                          <div className="text-[12px] text-[#525252] flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 print:hidden" />
                            <span>Address: {rel.address}</span>
                          </div>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>

          {/* 5. Social Media & Digital Footprints */}
          <section className="bg-white border border-[#E5E5E5] rounded-[10px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] print:border-slate-300 print:shadow-none break-inside-avoid">
            <div
              onClick={() => toggleCollapse('socialMedia')}
              className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between cursor-pointer hover:bg-neutral-100 transition-colors print:bg-slate-100 print:border-slate-300"
            >
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-slate-700 print:hidden" />
                <h3 className="text-[15px] font-bold text-[#171717] print:text-slate-900">Social Media &amp; Digital Handles</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-neutral-200/80 text-[#525252] print:bg-slate-200">
                  {(profile.socialMedia || []).length}
                </span>
                <div className="print:hidden">
                  {collapsedSections['socialMedia'] ? (
                    <ChevronDown className="w-4 h-4 text-[#525252]" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-[#525252]" />
                  )}
                </div>
              </div>
            </div>

            <div className={collapsedSections['socialMedia'] ? 'hidden print:!block' : 'block'}>
              <ul className="flex flex-col divide-y divide-[#E5E5E5] print:divide-slate-200">
                {(!profile.socialMedia || profile.socialMedia.length === 0) ? (
                  <li className="p-4 text-[13px] text-[#525252] italic">
                    No social media accounts or digital handles indexed.
                  </li>
                ) : (
                  profile.socialMedia.map((sm) => (
                    <li key={sm.id} className="px-4 py-3 hover:bg-neutral-50 transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {sm.platform}
                        </span>
                        <span className="font-mono text-[13px] font-semibold text-[#171717]">
                          {sm.handle}
                        </span>
                      </div>
                      {sm.profileUrl && (
                        <div>
                          <span className="hidden print:inline font-mono text-[11px] text-slate-600">
                            {sm.profileUrl}
                          </span>
                          <a
                            href={sm.profileUrl.startsWith('http') ? sm.profileUrl : `https://${sm.profileUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12px] text-[#3B5B7A] hover:underline flex items-center gap-1 font-medium print:hidden"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>
        </div>

        {/* Right Column (Cases & Data) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {/* 4. Case History (Tabs & Table) */}
          <section className="bg-white border border-[#E5E5E5] rounded-[10px] overflow-hidden flex flex-col shadow-[0_1px_3px_rgba(0,0,0,0.04)] print:border-slate-300 print:shadow-none break-inside-avoid">
            {/* Tab Header - Screen Only */}
            <div className="flex border-b border-[#E5E5E5] bg-[#F8F9FA] px-2 pt-2 gap-1 overflow-x-auto hide-scrollbar print:hidden">
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

            {/* Table Content - Screen View */}
            <div className="print:hidden">
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
            </div>

            {/* Complete Unified Case Record & Docket History - Printable View Only */}
            <div className="hidden print:block p-4 space-y-4">
              <div className="border border-slate-300 rounded-[8px] overflow-hidden">
                <div className="bg-[#1E293B] text-white px-3 py-1.5 font-bold text-[11px] flex justify-between items-center">
                  <span>JUDICIAL PROSECUTION DOCKETS &amp; CASE RECORDS ({profile.cases.length} TOTAL)</span>
                  <span className="text-[9.5px] font-mono text-slate-300">CERTIFIED ARCHIVE</span>
                </div>
                <table className="w-full text-left border-collapse text-[10.5px]">
                  <thead className="bg-[#F1F5F9] border-b border-slate-300 text-[9.5px] uppercase font-bold text-slate-700">
                    <tr>
                      <th className="px-3 py-1.5">#</th>
                      <th className="px-3 py-1.5">Docket ID</th>
                      <th className="px-3 py-1.5">Date Filed</th>
                      <th className="px-3 py-1.5">Status</th>
                      <th className="px-3 py-1.5">Jurisdiction &amp; Code</th>
                      <th className="px-3 py-1.5">Offense Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-900">
                    {profile.cases.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-3 text-center text-slate-500 italic">
                          No judicial case dockets recorded for this subject.
                        </td>
                      </tr>
                    ) : (
                      profile.cases.map((cs, idx) => (
                        <tr key={cs.id} className={idx % 2 === 1 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                          <td className="px-3 py-2 font-mono font-bold text-slate-500">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-800 whitespace-nowrap">{cs.caseNumber}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-600">{cs.dateFiled}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                              cs.status === 'Closed' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                              cs.status === 'Warrant Issued' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                              'bg-slate-100 text-slate-800 border-slate-300'
                            }`}>
                              {cs.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{cs.jurisdiction} • {cs.penalCode || 'N/A'}</td>
                          <td className="px-3 py-2 text-slate-800 leading-snug">{cs.description}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Subject Classification & Jurisdiction Summary for Print */}
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-[6px]">
                  <div className="font-bold text-slate-600 uppercase text-[9.5px]">Primary Criminal Classification</div>
                  <div className="font-bold text-slate-900 text-[12px]">{profile.category}</div>
                  <div className="text-slate-500 text-[9.5px] mt-0.5">Subject is indexed under Class A/B state criminal codes.</div>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-[6px]">
                  <div className="font-bold text-slate-600 uppercase text-[9.5px]">Investigating Jurisdiction</div>
                  <div className="font-bold text-slate-900 text-[12px]">{profile.city} Metropolitan District</div>
                  <div className="text-slate-500 text-[9.5px] mt-0.5">Active regional surveillance in {profile.state} circuit.</div>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Documents & Media */}
          <section className="bg-white border border-[#E5E5E5] rounded-[10px] p-5 flex flex-col gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] print:border-slate-300 print:shadow-none break-inside-avoid">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3 print:border-slate-300">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-600 text-[20px] print:hidden">
                  perm_media
                </span>
                <h3 className="text-[16px] font-bold text-[#171717] print:text-slate-900">Documents &amp; Evidence Files</h3>
              </div>

              <div className="print:hidden">
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
                  className="group relative aspect-square bg-neutral-100 rounded-[8px] border border-[#E5E5E5] overflow-hidden cursor-pointer shadow-xs hover:border-slate-400 transition-all print:border-slate-300 print:cursor-default"
                >
                  <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-neutral-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2 text-center print:hidden">
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
                  className="aspect-square bg-neutral-50 hover:bg-neutral-100 transition-colors rounded-[8px] border border-[#E5E5E5] flex flex-col items-center justify-center gap-2 cursor-pointer p-3 text-center group shadow-xs hover:border-slate-400 print:border-slate-300 print:bg-white print:cursor-default"
                >
                  <span className="material-symbols-outlined text-[32px] text-slate-600 group-hover:text-slate-900 transition-colors print:text-slate-700">
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

              {/* Add More Media Tile - Hidden on Print */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square border-2 border-dashed border-[#E5E5E5] hover:border-slate-400 rounded-[8px] flex flex-col items-center justify-center gap-1 text-[#525252] hover:text-[#171717] cursor-pointer transition-colors p-2 text-center bg-white print:hidden"
              >
                <Upload className="w-5 h-5 text-slate-500" />
                <span className="text-[11px] font-semibold">Add Evidence</span>
              </div>
            </div>
          </section>
        </div>
      </div>
      </div>
      {/* End of Screen View */}

      {/* ========================================================= */}
      {/* 2. OFFICIAL RECORD DOSSIER (Visible ONLY on print)         */}
      {/* Human-designed, clean, professional law enforcement record */}
      {/* ========================================================= */}
      <div className="hidden print:block font-sans text-slate-800 w-full text-[11px] leading-relaxed">
        {/* Header: Clean Departmental Title */}
        <div className="border-b-2 border-slate-800 pb-3 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                Police Department • Criminal Records Division
              </div>
              <h1 className="text-[19px] font-bold tracking-tight text-slate-900 mt-0.5">
                Criminal Record Dossier
              </h1>
            </div>
            <div className="text-right text-[10.5px]">
              <div><span className="text-slate-500">Record ID:</span> <span className="font-mono font-bold text-slate-900">{profile.id}</span></div>
              <div><span className="text-slate-500">Date Generated:</span> <span className="text-slate-700">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span></div>
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5">Official Law Enforcement Copy</div>
            </div>
          </div>
        </div>

        {/* Profile Summary Card: Mugshot + Essential Details */}
        <div className="border border-slate-300 rounded-md p-4 mb-4 break-inside-avoid bg-white">
          <table className="w-full border-collapse">
            <tbody>
              <tr className="align-top">
                {/* Subject Photo Cell */}
                <td className="w-[124px] pr-4 align-top">
                  <div className="w-[110px] border border-slate-300 rounded overflow-hidden bg-slate-100 text-center">
                    {profile.mugshotUrl ? (
                      <img
                        src={profile.mugshotUrl}
                        alt={profile.name}
                        crossOrigin="anonymous"
                        loading="eager"
                        decoding="sync"
                        style={{ width: '110px', height: '135px', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div className="w-[110px] h-[135px] bg-slate-200 flex flex-col items-center justify-center text-slate-400">
                        <User className="w-10 h-10 mb-1" />
                        <span className="text-[9px] uppercase font-semibold">No Photo</span>
                      </div>
                    )}
                    <div className="bg-slate-50 border-t border-slate-200 text-[9px] text-slate-500 py-0.5 font-mono">
                      Intake: {profile.mugshotDate || 'Recent'}
                    </div>
                  </div>
                </td>

                {/* Core Subject Details Cell */}
                <td className="align-top">
                  <div className="flex items-baseline justify-between border-b border-slate-200 pb-2 mb-3">
                    <div>
                      <h2 className="text-[17px] font-bold text-slate-900 leading-none">
                        {profile.name}
                      </h2>
                      {profile.alias && (
                        <div className="text-[11px] text-slate-600 mt-1">
                          <span className="text-slate-400 font-medium">Aliases:</span> {profile.alias}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-300 bg-slate-50 text-slate-700">
                        {profile.status}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-300 bg-slate-50 text-slate-700">
                        {profile.category}
                      </span>
                    </div>
                  </div>

              {/* Demographics Grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[9.5px]">Father's Name</span>
                  <span className="text-slate-900 font-medium">{profile.fatherName || 'Not recorded'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">Date of Birth / Age</span>
                  <span className="text-slate-900 font-medium">{profile.dob} ({profile.age} years)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">Gender</span>
                  <span className="text-slate-900 font-medium">{profile.gender}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">Contact Phone</span>
                  <span className="text-slate-900 font-medium font-mono">{profile.phone || 'Unlisted'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">Aadhaar / National ID</span>
                  <span className="text-slate-900 font-medium font-mono tracking-wide">
                    {profile.rawIdNumber || profile.identificationNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9.5px]">Physical Build</span>
                  <span className="text-slate-900 font-medium">
                    {profile.height || '—'}, {profile.weight || '—'} • {profile.eyeColor || 'Brown'} eyes, {profile.hairColor || 'Dark'} hair
                  </span>
                </div>
                {profile.imei && (
                  <div>
                    <span className="text-slate-500 block text-[9.5px]">Device IMEI</span>
                    <span className="text-slate-900 font-medium font-mono">{profile.imei}</span>
                  </div>
                )}
                <div className={profile.imei ? '' : 'col-span-2'}>
                  <span className="text-slate-500 block text-[9.5px]">Residential Address</span>
                  <span className="text-slate-900 font-medium">
                    {profile.primaryAddress || 'No fixed address registered'}, {profile.city}, {profile.state}
                  </span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

        {/* Record Overview & Key Statistics */}
        <div className="grid grid-cols-4 gap-3 mb-4 break-inside-avoid">
          <div className="border border-slate-300 rounded p-2.5 bg-slate-50">
            <div className="text-[9.5px] text-slate-500 uppercase font-semibold">Security Risk</div>
            <div className="text-[13px] font-bold text-slate-900 mt-0.5">{riskAssessmentLevel} ({riskAssessmentScore}/100)</div>
          </div>
          <div className="border border-slate-300 rounded p-2.5 bg-slate-50">
            <div className="text-[9.5px] text-slate-500 uppercase font-semibold">Crime Category</div>
            <div className="text-[13px] font-bold text-slate-900 mt-0.5">{profile.category}</div>
          </div>
          <div className="border border-slate-300 rounded p-2.5 bg-slate-50">
            <div className="text-[9.5px] text-slate-500 uppercase font-semibold">Active Cases</div>
            <div className="text-[13px] font-bold text-slate-900 mt-0.5">{activeCasesCount} Active</div>
          </div>
          <div className="border border-slate-300 rounded p-2.5 bg-slate-50">
            <div className="text-[9.5px] text-slate-500 uppercase font-semibold">Past Convictions</div>
            <div className="text-[13px] font-bold text-slate-900 mt-0.5">{convictionsCount} Recorded</div>
          </div>
        </div>

        {/* Physical Identification Marks */}
        {profile.identificationMarks && profile.identificationMarks.length > 0 && (
          <div className="border border-slate-300 rounded-md p-3 mb-4 break-inside-avoid bg-white">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-2 border-b border-slate-200 pb-1">
              Identifying Marks &amp; Scars
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
              {profile.identificationMarks.map((m, idx) => (
                <div key={m.id || idx} className="flex items-start gap-1.5">
                  <span className="text-slate-400 font-bold">•</span>
                  <span>
                    <strong className="text-slate-800">{m.description}</strong>
                    {m.detail && <span className="text-slate-600"> — {m.detail}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Judicial Cases & Charges Table */}
        <div className="border border-slate-300 rounded-md overflow-hidden mb-4 break-inside-avoid bg-white">
          <div className="px-3 py-2 bg-slate-100 border-b border-slate-300 flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
              Case Dockets &amp; Judicial History ({profile.cases.length})
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Jurisdiction: {profile.city}, {profile.state}
            </span>
          </div>
          <table className="w-full text-left border-collapse text-[10.5px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[9.5px] font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-3 py-1.5 w-8">#</th>
                <th className="px-3 py-1.5 w-28">Case No.</th>
                <th className="px-3 py-1.5 w-24">Date Filed</th>
                <th className="px-3 py-1.5 w-24">Status</th>
                <th className="px-3 py-1.5 w-36">Code / Court</th>
                <th className="px-3 py-1.5">Offense Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {profile.cases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                    No active or historical cases on record.
                  </td>
                </tr>
              ) : (
                profile.cases.map((cs, idx) => (
                  <tr key={cs.id} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                    <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2 font-mono font-medium text-slate-900 whitespace-nowrap">{cs.caseNumber}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{cs.dateFiled}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{cs.status}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{cs.penalCode || cs.jurisdiction}</td>
                    <td className="px-3 py-2 text-slate-800 leading-snug">{cs.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Known Relatives & Emergency Contacts */}
        {profile.relatives && profile.relatives.length > 0 && (
          <div className="border border-slate-300 rounded-md overflow-hidden mb-4 break-inside-avoid bg-white">
            <div className="px-3 py-2 bg-slate-100 border-b border-slate-300">
              <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">
                Family &amp; Next of Kin ({profile.relatives.length})
              </span>
            </div>
            <table className="w-full text-left border-collapse text-[10.5px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-[9.5px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-1.5 w-24">Relation</th>
                  <th className="px-3 py-1.5 w-36">Name</th>
                  <th className="px-3 py-1.5 w-28">Phone</th>
                  <th className="px-3 py-1.5 w-32">National ID</th>
                  <th className="px-3 py-1.5">Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {profile.relatives.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium text-slate-700">{r.relation}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{r.name}</td>
                    <td className="px-3 py-2 font-mono text-slate-700">{r.phone || '—'}</td>
                    <td className="px-3 py-2 font-mono text-slate-700">{r.aadhaar || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Signature & Verification Block */}
        <div className="pt-4 mt-4 border-t border-slate-300 break-inside-avoid">
          <div className="text-[10px] text-slate-500 mb-6 italic">
            Certified as an accurate record from the department database on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
          </div>
          <div className="grid grid-cols-3 gap-10 text-[10.5px]">
            <div>
              <div className="border-b border-slate-400 pb-6 mb-1.5"></div>
              <div className="font-semibold text-slate-900">Reporting Officer</div>
              <div className="text-[9.5px] text-slate-500">Signature &amp; Badge No.</div>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-6 mb-1.5"></div>
              <div className="font-semibold text-slate-900">Station In-Charge</div>
              <div className="text-[9.5px] text-slate-500">Approval &amp; Date</div>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-6 mb-1.5"></div>
              <div className="font-semibold text-slate-900">Records Custodian</div>
              <div className="text-[9.5px] text-slate-500">Verification Seal</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

