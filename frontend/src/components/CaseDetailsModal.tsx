import React, { useState } from 'react';
import { CaseRecord } from '../types';
import {
  X,
  Gavel,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Printer,
  Check,
  Layers,
  UserCheck,
  Search,
  Scale,
  Camera,
  AlertCircle,
  MapPin,
  FileCheck
} from 'lucide-react';

interface CaseDetailsModalProps {
  caseRecord: CaseRecord | null;
  onClose: () => void;
}

interface MilestoneItem {
  id: string;
  title: 'Reported' | 'Evidence Collected' | 'Suspect Interviewed' | 'Trial Scheduled';
  date: string;
  status: 'completed' | 'in_progress' | 'pending';
  statusLabel: string;
  summary: string;
  officerOrEntity: string;
  referenceTag?: string;
  icon: React.ReactNode;
}

function parseBaseDate(dateStr: string): Date {
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return new Date(2023, 9, 12);
}

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function generateCaseTimeline(caseRecord: CaseRecord): MilestoneItem[] {
  const baseDate = parseBaseDate(caseRecord.dateFiled);
  const status = (caseRecord.status || '').toLowerCase();

  const isClosed = status.includes('closed') || status.includes('cleared') || status.includes('adjudicated');
  const isCourtPending = status.includes('court') || status.includes('pre-trial');
  const isWarrant = status.includes('warrant');
  const isUnderInvestigation = status.includes('investigation');

  // Dates
  const reportedDate = new Date(baseDate);
  const evidenceDate = new Date(baseDate);
  evidenceDate.setDate(evidenceDate.getDate() + 3);

  const interviewDate = new Date(baseDate);
  interviewDate.setDate(interviewDate.getDate() + 14);

  const trialDate = new Date(baseDate);
  trialDate.setDate(trialDate.getDate() + 45);

  // Milestone 1: Reported
  const m1: MilestoneItem = {
    id: 'm-reported',
    title: 'Reported',
    date: formatDateDisplay(reportedDate),
    status: 'completed',
    statusLabel: 'Completed',
    summary: `First Information Report (${caseRecord.caseNumber}) officially docketed. Initial dispatch incident narrative logged into state repository.`,
    officerOrEntity: caseRecord.jurisdiction || 'Dispatch Station // Sector Command',
    referenceTag: `${caseRecord.caseNumber}-INTAKE`,
    icon: <FileText className="w-4 h-4" />,
  };

  // Milestone 2: Evidence Collected
  const m2: MilestoneItem = {
    id: 'm-evidence',
    title: 'Evidence Collected',
    date: formatDateDisplay(evidenceDate),
    status: 'completed',
    statusLabel: 'Completed',
    summary: `Physical and digital forensic artifacts tagged into evidence chain of custody. Surveillance footage and incident site documentation certified.`,
    officerOrEntity: 'Forensic Lab // Evidence Custodian',
    referenceTag: `EVD-${caseRecord.caseNumber.replace('FIR-', '')}`,
    icon: <Search className="w-4 h-4" />,
  };

  // Milestone 3: Suspect Interviewed
  let m3Status: 'completed' | 'in_progress' | 'pending' = 'completed';
  let m3Label = 'Completed';
  let m3Summary = `Formal custodial interrogation executed. Statements and alibi deposition logged with legal counsel acknowledgment.`;

  if (isUnderInvestigation) {
    m3Status = 'in_progress';
    m3Label = 'In Progress';
    m3Summary = `Preliminary interview scheduled with lead investigator. Deposition recordings and suspect questioning underway.`;
  } else if (isWarrant) {
    m3Status = 'in_progress';
    m3Label = 'Active Warrant';
    m3Summary = `Suspect evading custody. Judicial arrest warrant issued; formal custodial interview pending apprehension.`;
  }

  const m3: MilestoneItem = {
    id: 'm-interview',
    title: 'Suspect Interviewed',
    date: formatDateDisplay(interviewDate),
    status: m3Status,
    statusLabel: m3Label,
    summary: m3Summary,
    officerOrEntity: caseRecord.officerInCharge || 'Lead Detective // Major Crimes',
    referenceTag: `INT-${caseRecord.caseNumber.replace('FIR-', '')}`,
    icon: <UserCheck className="w-4 h-4" />,
  };

  // Milestone 4: Trial Scheduled
  let m4Status: 'completed' | 'in_progress' | 'pending' = 'pending';
  let m4Label = 'Pending';
  let m4Summary = `Awaiting trial calendar assignment upon completion of preliminary evidentiary review and formal charges filing.`;

  if (isClosed) {
    m4Status = 'completed';
    m4Label = 'Adjudicated';
    m4Summary = `Court trial completed in ${caseRecord.courtRoom || 'Judicial District Court'}. Final disposition and judicial decree entered.`;
  } else if (isCourtPending) {
    m4Status = 'in_progress';
    m4Label = 'Docketed';
    m4Summary = `Scheduled before ${caseRecord.presidingJudge || 'Presiding Magistrate'} in ${caseRecord.courtRoom || 'Central Court'}. ${caseRecord.courtroomNotes || 'Pre-trial conferences assigned.'}`;
  } else if (isWarrant) {
    m4Status = 'pending';
    m4Label = 'On Hold';
    m4Summary = `Trial scheduling suspended pending execution of active judicial warrant by law enforcement.`;
  }

  const m4: MilestoneItem = {
    id: 'm-trial',
    title: 'Trial Scheduled',
    date: formatDateDisplay(trialDate),
    status: m4Status,
    statusLabel: m4Label,
    summary: m4Summary,
    officerOrEntity: caseRecord.courtRoom || caseRecord.presidingJudge || 'State Judicial Registrar',
    referenceTag: `CAL-${caseRecord.caseNumber.replace('FIR-', '')}`,
    icon: <Scale className="w-4 h-4" />,
  };

  return [m1, m2, m3, m4];
}

export const CaseDetailsModal: React.FC<CaseDetailsModalProps> = ({ caseRecord, onClose }) => {
  const [printNotif, setPrintNotif] = useState(false);

  if (!caseRecord) return null;

  const timelineMilestones = generateCaseTimeline(caseRecord);

  const handlePrint = () => {
    setPrintNotif(true);
    setTimeout(() => setPrintNotif(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs select-none animate-backdrop-enter">
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-modal-enter">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#F8F9FA]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[8px] bg-[#3B5B7A]/10 border border-[#3B5B7A]/20 flex items-center justify-center text-[#3B5B7A]">
              <Gavel className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-mono text-[#525252] font-semibold">{caseRecord.caseNumber}</div>
              <h3 className="text-[16px] font-bold text-[#171717]">{caseRecord.category} Case Docket</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#525252] hover:text-[#171717] p-1.5 rounded-[8px] hover:bg-neutral-200/60 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-[13px] text-[#171717]">
          {/* Status Banner */}
          <div className="p-3.5 bg-neutral-50 border border-[#E5E5E5] rounded-[10px] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#525252] uppercase tracking-wider block">
                Current Procedural Status
              </span>
              <span className="text-[14px] font-bold text-[#171717]">{caseRecord.status}</span>
            </div>
            <span className="font-mono text-[12px] text-[#525252] font-medium">
              Filed: {caseRecord.dateFiled}
            </span>
          </div>

          {/* Vertical Investigative Timeline View */}
          <div className="p-5 bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between mb-5 border-b border-[#E5E5E5] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#3B5B7A]" />
                <h4 className="text-[12px] font-bold text-[#171717] uppercase tracking-wider">
                  Investigative &amp; Judicial Milestones
                </h4>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-[4px] bg-[#3B5B7A]/10 text-[#3B5B7A] border border-[#3B5B7A]/20">
                Timeline Registry
              </span>
            </div>

            {/* Vertical Timeline container */}
            <div className="relative pl-6 sm:pl-8 space-y-6">
              {/* Vertical connecting line */}
              <div className="absolute left-[11px] sm:left-[15px] top-3 bottom-3 w-0.5 bg-[#E5E5E5]" />

              {timelineMilestones.map((milestone, idx) => {
                const isCompleted = milestone.status === 'completed';
                const isInProgress = milestone.status === 'in_progress';
                const isPending = milestone.status === 'pending';

                return (
                  <div key={milestone.id} className="relative group">
                    {/* Node Circle on Vertical Line */}
                    <div
                      className={`absolute -left-[23px] sm:-left-[31px] top-0.5 w-7 h-7 rounded-full flex items-center justify-center text-[12px] transition-all shadow-xs z-10 ${
                        isCompleted
                          ? 'bg-[#3B5B7A] text-white border-2 border-white ring-2 ring-[#3B5B7A]/20'
                          : isInProgress
                          ? 'bg-white text-[#3B5B7A] border-2 border-[#3B5B7A] ring-3 ring-[#3B5B7A]/20'
                          : 'bg-white text-[#A3A3A3] border border-[#E5E5E5]'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      ) : (
                        milestone.icon
                      )}
                    </div>

                    {/* Milestone Details Card */}
                    <div
                      className={`p-3.5 rounded-[8px] border transition-all ${
                        isInProgress
                          ? 'bg-[#3B5B7A]/5 border-[#3B5B7A]/40 shadow-xs'
                          : isCompleted
                          ? 'bg-neutral-50/70 border-[#E5E5E5] hover:border-neutral-300'
                          : 'bg-white border-[#E5E5E5] opacity-75'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[13px] font-bold ${
                              isInProgress
                                ? 'text-[#3B5B7A]'
                                : isCompleted
                                ? 'text-[#171717]'
                                : 'text-[#525252]'
                            }`}
                          >
                            {milestone.title}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isInProgress
                                ? 'bg-[#3B5B7A]/10 text-[#3B5B7A] border-[#3B5B7A]/20'
                                : 'bg-neutral-100 text-[#525252] border-[#E5E5E5]'
                            }`}
                          >
                            {milestone.statusLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#525252]">
                          <Calendar className="w-3 h-3 text-[#525252]" />
                          <span>{milestone.date}</span>
                        </div>
                      </div>

                      <p className="text-[12px] text-[#171717] leading-relaxed mb-2">
                        {milestone.summary}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E5E5E5]/60 text-[11px] text-[#525252]">
                        <span className="font-medium flex items-center gap-1">
                          <span className="text-[#525252] font-semibold">Lead:</span> {milestone.officerOrEntity}
                        </span>
                        {milestone.referenceTag && (
                          <span className="font-mono text-[10px] text-[#525252] bg-white px-1.5 py-0.5 rounded border border-[#E5E5E5]">
                            {milestone.referenceTag}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details */}
          <div>
            <h4 className="text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1.5">
              Incident Summary &amp; Allegations
            </h4>
            <p className="p-3.5 bg-neutral-50 rounded-[10px] border border-[#E5E5E5] leading-relaxed text-[#171717]">
              {caseRecord.description}
            </p>
          </div>

          {caseRecord.courtRoom && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-neutral-50 rounded-[10px] border border-[#E5E5E5]">
                <span className="text-[11px] font-bold text-[#525252] uppercase block">
                  Court Jurisdiction
                </span>
                <span className="font-medium text-[#171717]">{caseRecord.courtRoom}</span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-[10px] border border-[#E5E5E5]">
                <span className="text-[11px] font-bold text-[#525252] uppercase block">
                  Presiding Officer / Judge
                </span>
                <span className="font-medium text-[#171717]">{caseRecord.presidingJudge || 'Assigned Magistrate'}</span>
              </div>
            </div>
          )}

          {caseRecord.penalCode && (
            <div>
              <h4 className="text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1.5">
                Statutory Penal Code
              </h4>
              <div className="font-mono text-[13px] p-2.5 bg-neutral-100/80 rounded-[8px] border border-[#E5E5E5] text-[#171717] font-semibold">
                {caseRecord.penalCode}
              </div>
            </div>
          )}

          {caseRecord.notes && (
            <div>
              <h4 className="text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1.5">
                Investigative Notes
              </h4>
              <p className="text-[12px] text-[#525252] italic leading-relaxed bg-neutral-50 p-3 rounded-[10px] border border-[#E5E5E5]">
                &ldquo;{caseRecord.notes}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#E5E5E5] bg-[#F8F9FA] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#525252] hover:text-[#171717] cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Certified Docket
            </button>
            {printNotif && (
              <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-[4px] font-medium animate-in fade-in">
                Docket sent to secure print queue
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#171717] text-white text-[12px] font-semibold rounded-[8px] hover:bg-black cursor-pointer shadow-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
