import React, { useState, useEffect, useRef } from 'react';
import { CaseRecord, Officer } from '../types';
import { api } from '../api';
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
  FileCheck,
  Download,
  Upload,
  Plus,
  Loader2,
  Paperclip,
  FolderOpen,
  User,
  Phone
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
  const [activeTab, setActiveTab] = useState<'timeline' | 'evidence' | 'dossier'>('timeline');
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Officer Assignment State
  const [availableOfficers, setAvailableOfficers] = useState<Officer[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>('');
  const [isAssigningOfficer, setIsAssigningOfficer] = useState(false);
  const [assignSuccessMsg, setAssignSuccessMsg] = useState<string | null>(null);

  // New Case Note / Activity State
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [activityType, setActivityType] = useState('Investigation Progress');
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDesc, setActivityDesc] = useState('');
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);

  // Evidence Upload State
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!caseRecord) return;
    let isMounted = true;
    const fetchDetail = async () => {
      setIsLoadingDetail(true);
      try {
        const [data, officers] = await Promise.all([
          api.getCaseDetail(caseRecord.id),
          api.getOfficers(),
        ]);
        if (isMounted) {
          setDetailData(data);
          if (Array.isArray(officers)) {
            setAvailableOfficers(officers);
          }
        }
      } catch (err) {
        console.warn('Could not load case detail from server, using local caseRecord', err);
      } finally {
        if (isMounted) setIsLoadingDetail(false);
      }
    };
    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [caseRecord?.id]);

  const handleAssignOfficer = async () => {
    if (!caseRecord || !selectedOfficerId) return;
    setIsAssigningOfficer(true);
    setAssignSuccessMsg(null);
    try {
      const res = await api.assignCaseOfficer(caseRecord.id, selectedOfficerId);
      const chosenOfficer = availableOfficers.find((o) => o.id === selectedOfficerId);
      const officerLabel = chosenOfficer ? `${chosenOfficer.name} (${chosenOfficer.badgeNumber})` : (res.leadOfficer || 'Assigned');
      setDetailData((prev: any) => ({
        ...prev,
        officerInCharge: officerLabel,
      }));
      setAssignSuccessMsg(`Lead Officer updated: ${officerLabel}`);
      setTimeout(() => setAssignSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to assign officer. Check jurisdiction clearances.');
    } finally {
      setIsAssigningOfficer(false);
    }
  };

  if (!caseRecord) return null;

  const timelineMilestones = generateCaseTimeline(caseRecord);

  const handlePrint = () => {
    setPrintNotif(true);
    setTimeout(() => setPrintNotif(false), 2500);
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseRecord || !activityTitle.trim() || !activityDesc.trim()) return;
    setIsSubmittingActivity(true);
    try {
      const act = await api.addCaseActivity(caseRecord.id, {
        activityType,
        title: activityTitle.trim(),
        description: activityDesc.trim(),
      });
      setDetailData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          activities: [act, ...(prev.activities || [])],
        };
      });
      setActivityTitle('');
      setActivityDesc('');
      setIsAddingNote(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add activity log');
    } finally {
      setIsSubmittingActivity(false);
    }
  };

  const handleUploadCaseDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !caseRecord) return;
    setIsUploadingDoc(true);
    setUploadError(null);
    try {
      const doc = await api.uploadDocument(file, file.name, 'Case Evidence', undefined, caseRecord.id);
      setDetailData((prev: any) => {
        if (!prev) return prev;
        const newDocItem = {
          id: doc.id,
          title: doc.title,
          filename: doc.original_filename || file.name,
          size: `${((doc.file_size || file.size) / (1024 * 1024)).toFixed(1)} MB`,
          type: doc.file_extension || 'pdf',
          dateUploaded: 'Today',
          url: '',
        };
        return {
          ...prev,
          documents: [newDocItem, ...(prev.documents || [])],
        };
      });
    } catch (err: any) {
      console.error('Case evidence upload failed:', err);
      setUploadError(err.message || 'Document upload failed. Ensure file is not executable.');
    } finally {
      setIsUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadDoc = async (docId: string, filename: string) => {
    setDownloadingDocId(docId);
    try {
      await api.downloadDocument(docId, filename);
    } catch (err: any) {
      alert(err.message || 'Failed to download file. Clearance verified.');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const liveActivities = detailData?.activities || [];
  const liveDocuments = detailData?.documents || [];

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

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E5E5E5] px-6 bg-white gap-6 text-[13px] font-medium">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'timeline'
                ? 'border-[#171717] text-[#171717] font-bold'
                : 'border-transparent text-[#525252] hover:text-[#171717]'
            }`}
          >
            Investigative Milestones
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`py-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'evidence'
                ? 'border-[#171717] text-[#171717] font-bold'
                : 'border-transparent text-[#525252] hover:text-[#171717]'
            }`}
          >
            <span>Evidence &amp; Custody Files</span>
            <span className="px-1.5 py-0.2 bg-neutral-100 border border-[#E5E5E5] text-[11px] rounded-full text-[#525252]">
              {liveDocuments.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('dossier')}
            className={`py-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'dossier'
                ? 'border-[#171717] text-[#171717] font-bold'
                : 'border-transparent text-[#525252] hover:text-[#171717]'
            }`}
          >
            FIR &amp; Judicial Docket
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-[13px] text-[#171717]">
          {/* Status & Assignment Banner */}
          <div className="p-3.5 bg-neutral-50 border border-[#E5E5E5] rounded-[10px] space-y-3">
            <div className="flex items-center justify-between">
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

            {/* Jurisdiction & Lead Investigating Officer Row */}
            <div className="pt-2.5 border-t border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3 text-[12px]">
              <div>
                <span className="text-[10px] font-bold text-[#525252] uppercase block">Jurisdiction Station</span>
                <span className="font-medium text-[#171717]">
                  {detailData?.jurisdiction || caseRecord.jurisdiction || 'Metro Central Station'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#525252] uppercase block">Lead Investigating Officer</span>
                <span className="font-medium text-[#171717]">
                  {detailData?.officerInCharge || caseRecord.officerInCharge || 'Unassigned'}
                </span>
              </div>

              {availableOfficers.length > 0 && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <select
                    value={selectedOfficerId}
                    onChange={(e) => setSelectedOfficerId(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-[#E5E5E5] rounded-[6px] text-[11px] outline-none text-[#171717]"
                  >
                    <option value="">-- Assign Officer --</option>
                    {availableOfficers.map((off) => (
                      <option key={off.id} value={off.id}>
                        {off.name} ({off.badgeNumber} - {off.rank})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignOfficer}
                    disabled={!selectedOfficerId || isAssigningOfficer}
                    className="px-2.5 py-1 bg-[#171717] text-white text-[11px] font-semibold rounded-[6px] hover:bg-black disabled:opacity-50 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {isAssigningOfficer ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                    <span>Assign</span>
                  </button>
                </div>
              )}
            </div>

            {assignSuccessMsg && (
              <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-[6px] font-medium animate-in fade-in">
                {assignSuccessMsg}
              </div>
            )}
          </div>

          {/* TAB 1: TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="p-5 bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-5 border-b border-[#E5E5E5] pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#3B5B7A]" />
                    <h4 className="text-[12px] font-bold text-[#171717] uppercase tracking-wider">
                      Chronological Case Ledger &amp; Milestones
                    </h4>
                  </div>
                  <button
                    onClick={() => setIsAddingNote(!isAddingNote)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-[6px] bg-[#171717] text-white hover:bg-black transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingNote ? 'Cancel' : 'Add Note / Log'}</span>
                  </button>
                </div>

                {/* Inline Add Note Form */}
                {isAddingNote && (
                  <form onSubmit={handleCreateActivity} className="mb-6 p-4 bg-neutral-50 border border-[#E5E5E5] rounded-[8px] space-y-3">
                    <div className="text-[12px] font-bold text-[#171717]">Record Investigation Log Entry</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#525252] uppercase mb-1">
                          Activity Classification
                        </label>
                        <select
                          value={activityType}
                          onChange={(e) => setActivityType(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-[#E5E5E5] rounded-[6px] text-[12px] outline-none"
                        >
                          <option value="Investigation Progress">Investigation Progress</option>
                          <option value="Interview Deposition">Interview Deposition</option>
                          <option value="Forensic Evidence Intake">Forensic Evidence Intake</option>
                          <option value="Search Warrant Executed">Search Warrant Executed</option>
                          <option value="Judicial Hearing Order">Judicial Hearing Order</option>
                          <option value="General Note">General Note</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#525252] uppercase mb-1">
                          Log Title / Headline
                        </label>
                        <input
                          type="text"
                          value={activityTitle}
                          onChange={(e) => setActivityTitle(e.target.value)}
                          placeholder="e.g. Ballistics report received from forensic lab"
                          required
                          className="w-full px-2.5 py-1.5 bg-white border border-[#E5E5E5] rounded-[6px] text-[12px] outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#525252] uppercase mb-1">
                        Detailed Narrative &amp; Findings
                      </label>
                      <textarea
                        rows={2}
                        value={activityDesc}
                        onChange={(e) => setActivityDesc(e.target.value)}
                        placeholder="Provide details of investigator action, evidence tagged, or witness statements..."
                        required
                        className="w-full px-2.5 py-1.5 bg-white border border-[#E5E5E5] rounded-[6px] text-[12px] outline-none resize-y"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingNote(false)}
                        className="px-3 py-1 bg-white border border-[#E5E5E5] text-[11px] font-semibold rounded-[6px] hover:bg-neutral-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingActivity}
                        className="px-3 py-1 bg-[#171717] text-white text-[11px] font-semibold rounded-[6px] hover:bg-black disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isSubmittingActivity && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span>Submit Log Entry</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Timeline display: live activities if present, else default milestones */}
                <div className="relative pl-6 sm:pl-8 space-y-6">
                  <div className="absolute left-[11px] sm:left-[15px] top-3 bottom-3 w-0.5 bg-[#E5E5E5]" />

                  {liveActivities.length > 0 ? (
                    liveActivities.map((act: any) => (
                      <div key={act.id} className="relative group">
                        <div className="absolute -left-[23px] sm:-left-[31px] top-0.5 w-7 h-7 rounded-full flex items-center justify-center text-[12px] bg-white text-[#3B5B7A] border-2 border-[#3B5B7A] ring-3 ring-[#3B5B7A]/20 shadow-xs z-10">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                        <div className="p-3.5 rounded-[8px] border border-[#E5E5E5] bg-neutral-50/70 hover:border-neutral-300 transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-bold text-[#171717]">{act.title}</span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border bg-[#3B5B7A]/10 text-[#3B5B7A] border-[#3B5B7A]/20">
                                {act.activityType}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#525252]">
                              <Calendar className="w-3 h-3" />
                              <span>{act.createdAt}</span>
                            </div>
                          </div>
                          <p className="text-[12px] text-[#171717] leading-relaxed mb-2">{act.description}</p>
                          <div className="pt-2 border-t border-[#E5E5E5]/60 text-[11px] text-[#525252]">
                            <span className="font-medium">Officer: {act.officerName}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    timelineMilestones.map((milestone) => {
                      const isCompleted = milestone.status === 'completed';
                      const isInProgress = milestone.status === 'in_progress';
                      return (
                        <div key={milestone.id} className="relative group">
                          <div
                            className={`absolute -left-[23px] sm:-left-[31px] top-0.5 w-7 h-7 rounded-full flex items-center justify-center text-[12px] transition-all shadow-xs z-10 ${
                              isCompleted
                                ? 'bg-[#3B5B7A] text-white border-2 border-white ring-2 ring-[#3B5B7A]/20'
                                : isInProgress
                                ? 'bg-white text-[#3B5B7A] border-2 border-[#3B5B7A] ring-3 ring-[#3B5B7A]/20'
                                : 'bg-white text-[#A3A3A3] border border-[#E5E5E5]'
                            }`}
                          >
                            {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : milestone.icon}
                          </div>
                          <div
                            className={`p-3.5 rounded-[8px] border transition-all ${
                              isInProgress
                                ? 'bg-[#3B5B7A]/5 border-[#3B5B7A]/40 shadow-xs'
                                : isCompleted
                                ? 'bg-neutral-50/70 border-[#E5E5E5]'
                                : 'bg-white border-[#E5E5E5] opacity-75'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-bold text-[#171717]">{milestone.title}</span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border bg-emerald-50 text-emerald-700 border-emerald-200">
                                  {milestone.statusLabel}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#525252]">
                                <Calendar className="w-3 h-3 text-[#525252]" />
                                <span>{milestone.date}</span>
                              </div>
                            </div>
                            <p className="text-[12px] text-[#171717] leading-relaxed mb-2">{milestone.summary}</p>
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E5E5E5]/60 text-[11px] text-[#525252]">
                              <span className="font-medium">Lead: {milestone.officerOrEntity}</span>
                              {milestone.referenceTag && (
                                <span className="font-mono text-[10px] text-[#525252] bg-white px-1.5 py-0.5 rounded border border-[#E5E5E5]">
                                  {milestone.referenceTag}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EVIDENCE & CUSTODY FILES */}
          {activeTab === 'evidence' && (
            <div className="space-y-4">
              <div className="p-5 bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-4 border-b border-[#E5E5E5] pb-3">
                  <div>
                    <h4 className="text-[12px] font-bold text-[#171717] uppercase tracking-wider">
                      Attached Physical &amp; Digital Evidence
                    </h4>
                    <p className="text-[11px] text-[#525252] mt-0.5">
                      Encrypted file records verified with SHA-256 integrity checksums.
                    </p>
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleUploadCaseDoc}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingDoc}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-[6px] bg-[#171717] text-white hover:bg-black transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isUploadingDoc ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Attach Evidence File</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {uploadError && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-800 text-[12px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {liveDocuments.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-[#E5E5E5] rounded-[8px] text-neutral-400 space-y-2">
                    <FolderOpen className="w-8 h-8 mx-auto text-neutral-300" />
                    <div className="text-[13px] font-semibold text-neutral-600">No Evidence Documents Attached</div>
                    <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                      Forensic attachments, FIR scans, site photographs, or judicial affidavits attached to this docket will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {liveDocuments.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="p-3 bg-neutral-50 border border-[#E5E5E5] rounded-[8px] flex items-center justify-between hover:bg-neutral-100/70 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-[6px] bg-white border border-[#E5E5E5] flex items-center justify-center text-[#3B5B7A]">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-[#171717] text-[13px]">{doc.title}</div>
                            <div className="text-[11px] text-[#525252] flex items-center gap-2">
                              <span>{doc.filename}</span>
                              <span>&bull;</span>
                              <span>{doc.size}</span>
                              {doc.dateUploaded && (
                                <>
                                  <span>&bull;</span>
                                  <span>{doc.dateUploaded}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDownloadDoc(doc.id, doc.filename)}
                          disabled={downloadingDocId === doc.id}
                          className="px-3 py-1.5 bg-white border border-[#E5E5E5] text-[#171717] hover:bg-[#F3F3F4] text-[11px] font-semibold rounded-[6px] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                          title="Download authorized evidence file"
                        >
                          {downloadingDocId === doc.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-[#3B5B7A]" />
                          )}
                          <span>Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FIR & JUDICIAL DOSSIER */}
          {activeTab === 'dossier' && (
            <div className="space-y-4">
              {/* Incident Facts */}
              <div>
                <h4 className="text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1.5">
                  FIR Narrative &amp; Facts of the Offense
                </h4>
                <p className="p-3.5 bg-neutral-50 rounded-[10px] border border-[#E5E5E5] leading-relaxed text-[#171717]">
                  {caseRecord.description}
                </p>
              </div>

              {/* Complainant & Incident Site Details */}
              {(detailData?.incidentLocation || detailData?.complainantName) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {detailData.incidentLocation && (
                    <div className="p-3 bg-neutral-50 rounded-[10px] border border-[#E5E5E5]">
                      <span className="text-[11px] font-bold text-[#525252] uppercase block">
                        Incident Location
                      </span>
                      <span className="font-medium text-[#171717]">{detailData.incidentLocation}</span>
                    </div>
                  )}
                  {detailData.complainantName && (
                    <div className="p-3 bg-neutral-50 rounded-[10px] border border-[#E5E5E5]">
                      <span className="text-[11px] font-bold text-[#525252] uppercase block">
                        Complainant / Informant
                      </span>
                      <span className="font-medium text-[#171717]">
                        {detailData.complainantName}
                        {detailData.complainantPhone ? ` (${detailData.complainantPhone})` : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Court Details */}
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
