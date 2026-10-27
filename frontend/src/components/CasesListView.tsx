import React, { useState, useEffect } from 'react';
import { CriminalProfile, CaseRecord, CaseStatus } from '../types';
import {
  Search,
  Gavel,
  FileText,
  ChevronRight,
  Download,
  CheckSquare,
  Square,
  MinusSquare,
  CheckCircle2,
  X,
  Layers,
  AlertCircle,
  Edit3,
  Check,
  Plus,
  Calendar,
  MapPin,
  Phone,
  User,
  ShieldAlert,
  Loader2,
  FilePlus
} from 'lucide-react';
import { api } from '../api';

interface CasesListViewProps {
  allProfiles: CriminalProfile[];
  onOpenCaseModal: (caseRecord: CaseRecord) => void;
  onSelectProfile: (profile: CriminalProfile) => void;
  onBulkUpdateStatus?: (caseIds: string[], newStatus: CaseStatus) => void;
  onCaseCreated?: (newCase: any) => void;
}

const AVAILABLE_STATUSES: { status: CaseStatus; label: string; desc: string; badgeClass: string }[] = [
  {
    status: 'Under Investigation',
    label: 'Under Investigation',
    desc: 'Active detective inquiries, forensics, and evidence gathering.',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    status: 'Court Pending',
    label: 'Court Pending',
    desc: 'Scheduled for judicial hearings or trial calendar.',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    status: 'Warrant Issued',
    label: 'Warrant Issued',
    desc: 'Active judicial warrant issued for subject arrest.',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    status: 'Pre-Trial',
    label: 'Pre-Trial',
    desc: 'Pre-trial discovery, depositions, and plea conferences.',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    status: 'Closed',
    label: 'Closed',
    desc: 'Adjudicated, dismissed, or final disposition reached.',
    badgeClass: 'bg-neutral-100 text-[#171717] border-[#E5E5E5]',
  },
];

export const CasesListView: React.FC<CasesListViewProps> = ({
  allProfiles,
  onOpenCaseModal,
  onSelectProfile,
  onBulkUpdateStatus,
  onCaseCreated,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [targetStatus, setTargetStatus] = useState<CaseStatus>('Under Investigation');
  const [auditNote, setAuditNote] = useState<string>('');
  const [successToast, setSuccessToast] = useState<{ message?: string; count?: number; status?: CaseStatus } | null>(null);

  // FIR Registration Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isSubmittingFir, setIsSubmittingFir] = useState(false);
  const [firError, setFirError] = useState<string | null>(null);
  const [firForm, setFirForm] = useState({
    title: '',
    category: 'Theft',
    caseNumber: '',
    incidentDate: '',
    incidentLocation: '',
    complainantName: '',
    complainantPhone: '',
    penalCode: '',
    description: '',
    status: 'Under Investigation' as CaseStatus,
    suspectId: '',
  });

  const [registeredCases, setRegisteredCases] = useState<Array<CaseRecord & { profile: CriminalProfile }>>([]);
  const [backendCases, setBackendCases] = useState<Array<CaseRecord & { profile: CriminalProfile }>>([]);
  const [isLoadingCases, setIsLoadingCases] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const loadCases = async () => {
      try {
        setIsLoadingCases(true);
        const data = await api.getCases();
        if (isMounted && Array.isArray(data)) {
          const mapped = data.map((c: any) => {
            const linkedProfile = allProfiles.find(
              (p) => p.id === c.criminalId || (c.linkedPersons && c.linkedPersons.some((lp: any) => lp.id === p.id))
            );
            const fallbackProfile: CriminalProfile = linkedProfile || {
              id: c.criminalId || 'REF-' + (c.caseNumber || 'CASE'),
              name: c.subjectName || (c.linkedPersons && c.linkedPersons[0]?.name) || 'Under Investigation / Identity Pending',
              aliases: [],
              riskLevel: 'Medium Risk',
              status: c.status || 'Under Investigation',
              category: c.category || 'General',
              mugshotUrl: c.mugshotUrl || (c.linkedPersons && c.linkedPersons[0]?.mugshotUrl) || '',
              dateOfBirth: '',
              gender: 'Unknown',
              nationality: '',
              height: '',
              weight: '',
              bloodType: '',
              eyeColor: '',
              hairColor: '',
              identificationMarks: [],
              lastKnownAddress: '',
              fingerprintId: '',
              dnaProfileId: '',
              aadhaarNumber: '',
              primaryPhone: '',
              cases: [],
              media: [],
              documents: [],
              relatives: [],
              socialMedia: [],
              associatedGangs: [],
            };
            return {
              ...c,
              profile: fallbackProfile,
            };
          });
          setBackendCases(mapped);
        }
      } catch (err) {
        console.warn('Could not load cases from backend, falling back to local profiles', err);
      } finally {
        if (isMounted) setIsLoadingCases(false);
      }
    };
    loadCases();
    return () => {
      isMounted = false;
    };
  }, [allProfiles]);

  const handleDownloadCSV = () => {
    if (filteredCases.length === 0) return;
    const headers = [
      'Case Number',
      'Filed Date',
      'Title',
      'Category',
      'Status',
      'Subject Name',
      'Jurisdiction',
      'Officer In Charge',
      'Penal Code',
      'Description'
    ];
    const rows = filteredCases.map((c) => [
      `"${c.caseNumber || ''}"`,
      `"${c.dateFiled || ''}"`,
      `"${(c.title || '').replace(/"/g, '""')}"`,
      `"${c.category || ''}"`,
      `"${c.status || ''}"`,
      `"${(c.profile?.name || '').replace(/"/g, '""')}"`,
      `"${(c.jurisdiction || '').replace(/"/g, '""')}"`,
      `"${(c.officerInCharge || '').replace(/"/g, '""')}"`,
      `"${c.penalCode || ''}"`,
      `"${(c.description || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `crms_cases_dockets_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Combine backend cases, locally registered cases, and profile-embedded cases (deduplicating by id or caseNumber)
  const caseMap = new Map<string, CaseRecord & { profile: CriminalProfile }>();
  allProfiles.forEach((profile) => {
    profile.cases.forEach((cs) => {
      caseMap.set(cs.id || cs.caseNumber, { ...cs, profile });
    });
  });
  backendCases.forEach((cs) => {
    caseMap.set(cs.id || cs.caseNumber, cs);
  });
  registeredCases.forEach((cs) => {
    caseMap.set(cs.id || cs.caseNumber, cs);
  });
  const allCasesWithProfile = Array.from(caseMap.values());

  const filteredCases = allCasesWithProfile.filter((c) => {
    const matchesSearch =
      c.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.title && c.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.profile?.name && c.profile.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'All' || c.status === filterStatus;
    const matchesCategory = filterCategory === 'All' || c.category === filterCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Checkbox toggle handlers
  const handleToggleSelectCase = (caseId: string) => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  };

  const isAllFilteredSelected =
    filteredCases.length > 0 && filteredCases.every((c) => selectedCaseIds.has(c.id));
  const isSomeFilteredSelected =
    filteredCases.some((c) => selectedCaseIds.has(c.id)) && !isAllFilteredSelected;

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedCaseIds((prev) => {
        const next = new Set(prev);
        filteredCases.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedCaseIds((prev) => {
        const next = new Set(prev);
        filteredCases.forEach((c) => next.add(c.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedCaseIds(new Set());
  };

  const handleOpenBulkModal = () => {
    if (selectedCaseIds.size === 0) return;
    setIsBulkModalOpen(true);
  };

  const handleConfirmBulkUpdate = () => {
    const ids = Array.from(selectedCaseIds);
    if (ids.length === 0) return;

    if (onBulkUpdateStatus) {
      onBulkUpdateStatus(ids, targetStatus);
    }

    setSuccessToast({
      count: ids.length,
      status: targetStatus,
    });

    setIsBulkModalOpen(false);
    setSelectedCaseIds(new Set());
    setAuditNote('');

    setTimeout(() => {
      setSuccessToast(null);
    }, 4500);
  };

  const handleRegisterFirSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firForm.description.trim()) {
      setFirError('Detailed incident facts and narrative are required for FIR registration.');
      return;
    }
    setIsSubmittingFir(true);
    setFirError(null);
    try {
      const payload: any = {
        title: firForm.title.trim() || undefined,
        description: firForm.description.trim(),
        category: firForm.category,
        status: firForm.status,
        incidentDate: firForm.incidentDate || undefined,
        incidentLocation: firForm.incidentLocation.trim() || undefined,
        complainantName: firForm.complainantName.trim() || undefined,
        complainantPhone: firForm.complainantPhone.trim() || undefined,
        penalCode: firForm.penalCode.trim() || undefined,
        suspectIds: firForm.suspectId ? [firForm.suspectId] : undefined,
      };
      if (firForm.caseNumber.trim()) {
        payload.caseNumber = firForm.caseNumber.trim();
      }

      const res = await api.createCase(payload);
      
      const linkedSuspect = allProfiles.find((p) => p.id === firForm.suspectId);
      const fallbackProfile: CriminalProfile = linkedSuspect || {
        id: 'UNASSIGNED',
        name: 'Under Investigation / Identity Pending',
        aliases: [],
        riskLevel: 'Medium Risk',
        status: 'Under Investigation',
        category: firForm.category,
        mugshotUrl: '',
        dateOfBirth: '',
        gender: 'Unknown',
        nationality: '',
        height: '',
        weight: '',
        bloodType: '',
        eyeColor: '',
        hairColor: '',
        identificationMarks: [],
        lastKnownAddress: '',
        fingerprintId: '',
        dnaProfileId: '',
        aadhaarNumber: '',
        primaryPhone: '',
        cases: [],
        media: [],
        documents: [],
        relatives: [],
        socialMedia: [],
        associatedGangs: [],
      };

      const newCaseRecord: CaseRecord & { profile: CriminalProfile } = {
        id: res.id,
        caseNumber: res.caseNumber || res.case_number,
        title: res.title,
        description: res.description,
        dateFiled: res.dateFiled || 'Today',
        status: res.status,
        category: res.category,
        jurisdiction: res.jurisdiction,
        officerInCharge: res.officerInCharge,
        courtRoom: res.courtRoom,
        presidingJudge: res.presidingJudge,
        courtroomNotes: res.courtroomNotes,
        notes: res.notes,
        penalties: res.penalties,
        penalCode: res.penalCode,
        incidentDate: res.incidentDate,
        incidentLocation: res.incidentLocation,
        complainantName: res.complainantName,
        complainantPhone: res.complainantPhone,
        profile: fallbackProfile,
      };

      setRegisteredCases((prev) => [newCaseRecord, ...prev]);

      if (onCaseCreated) {
        onCaseCreated(newCaseRecord);
      }

      setSuccessToast({
        message: `FIR ${newCaseRecord.caseNumber} registered successfully and entered into the state case repository.`,
      });

      setIsRegisterModalOpen(false);
      setFirForm({
        title: '',
        category: 'Theft',
        caseNumber: '',
        incidentDate: '',
        incidentLocation: '',
        complainantName: '',
        complainantPhone: '',
        penalCode: '',
        description: '',
        status: 'Under Investigation',
        suspectId: '',
      });

      setTimeout(() => {
        setSuccessToast(null);
      }, 5000);
    } catch (err: any) {
      console.error('FIR registration failed:', err);
      setFirError(err.message || 'Failed to register FIR. Please check fields and permissions.');
    } finally {
      setIsSubmittingFir(false);
    }
  };

  const selectedCasesList = allCasesWithProfile.filter((c) => selectedCaseIds.has(c.id));

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto w-full">
      {/* Header */}
      <div className="border-b border-[#E5E5E5] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] md:text-[30px] font-bold text-[#171717] tracking-tight">
            Active Case Dockets &amp; FIR Registry
          </h1>
          <p className="text-[14px] md:text-[16px] text-[#525252] mt-1">
            Complete repository of first information reports, judicial trials, and active warrants.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              setFirError(null);
              setIsRegisterModalOpen(true);
            }}
            id="register-fir-button"
            className="bg-[#171717] hover:bg-black text-white text-[12px] font-semibold px-3.5 py-2 rounded-[8px] transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            title="Register a new First Information Report"
          >
            <Plus className="w-4 h-4" />
            <span>Register FIR</span>
          </button>
          <button
            onClick={handleDownloadCSV}
            id="cases-download-csv-button"
            className="bg-transparent text-[#3B5B7A] hover:bg-[#3B5B7A]/10 text-[12px] font-semibold px-3.5 py-2 rounded-[8px] transition-colors flex items-center gap-2 cursor-pointer"
            title="Download cases registry CSV"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successToast && (
        <div className="bg-[#3B5B7A]/10 border border-[#3B5B7A]/30 rounded-[8px] p-3.5 px-4 flex items-center justify-between gap-3 text-[13px] text-[#171717] animate-stat-fade-in shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#3B5B7A] shrink-0" />
            <span>
              {successToast.message ? (
                successToast.message
              ) : (
                <>
                  Updated <strong className="font-bold">{successToast.count} case record{successToast.count && successToast.count > 1 ? 's' : ''}</strong> to status{' '}
                  <span className="font-semibold px-2 py-0.5 rounded-[4px] bg-white border border-[#E5E5E5] text-[#3B5B7A]">
                    {successToast.status}
                  </span>
                  .
                </>
              )}
            </span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-[#525252] hover:text-[#171717] p-1 rounded-md transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Controls & Bulk Selection Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#525252] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by FIR #, title, subject name, or description..."
              className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#E5E5E5] rounded-[8px] text-[13px] text-[#171717] placeholder:text-[#525252]/60 focus:border-[#171717] focus:ring-1 focus:ring-[#171717] outline-none shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-white border border-[#E5E5E5] rounded-[8px] px-3.5 py-2.5 text-[13px] text-[#171717] outline-none font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.04)] focus:border-[#171717] cursor-pointer"
          >
            <option value="All">All Categories</option>
            <option value="Theft">Theft</option>
            <option value="Assault">Assault</option>
            <option value="Fraud">Fraud</option>
            <option value="Narcotics">Narcotics</option>
            <option value="Cybercrime">Cybercrime</option>
            <option value="Fugitive">Fugitive</option>
            <option value="Financial">Financial Fraud</option>
            <option value="Homicide">Homicide</option>
            <option value="Vehicle">Vehicle Crime</option>
            <option value="Trespassing">Trespassing</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-[#E5E5E5] rounded-[8px] px-3.5 py-2.5 text-[13px] text-[#171717] outline-none font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.04)] focus:border-[#171717] cursor-pointer"
          >
            <option value="All">All Statuses ({allCasesWithProfile.length})</option>
            <option value="Under Investigation">Under Investigation</option>
            <option value="Court Pending">Court Pending</option>
            <option value="Warrant Issued">Warrant Issued</option>
            <option value="Pre-Trial">Pre-Trial</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        {/* Persistent Bulk Actions Bar when items are selected */}
        {selectedCaseIds.size > 0 && (
          <div className="bg-[#171717] text-white rounded-[8px] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md animate-stat-fade-in">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#3B5B7A] text-white text-[12px] font-bold">
                {selectedCaseIds.size}
              </span>
              <span className="text-[13px] font-medium text-neutral-200">
                {selectedCaseIds.size} case {selectedCaseIds.size === 1 ? 'docket' : 'dockets'} selected
              </span>
              <button
                onClick={handleClearSelection}
                className="text-[12px] text-neutral-400 hover:text-white underline cursor-pointer transition-colors ml-1"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenBulkModal}
                id="bulk-update-status-button"
                className="bg-[#3B5B7A] hover:bg-[#2C4863] text-white text-[12px] font-semibold px-4 py-1.5 rounded-[6px] transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Update Status ({selectedCaseIds.size})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table of cases */}
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] divide-y divide-[#E5E5E5]">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 bg-[#F8F9FA] px-5 py-3 text-[10.5px] font-semibold text-[#525252] uppercase tracking-wider border-b border-[#E5E5E5] items-center">
          <div className="col-span-1 flex items-center">
            <button
              onClick={handleToggleSelectAll}
              id="select-all-cases-checkbox"
              className="flex items-center gap-1.5 text-[#525252] hover:text-[#171717] cursor-pointer"
              title={isAllFilteredSelected ? 'Deselect all' : 'Select all visible'}
            >
              {isAllFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-[#3B5B7A]" />
              ) : isSomeFilteredSelected ? (
                <MinusSquare className="w-4 h-4 text-[#3B5B7A]" />
              ) : (
                <Square className="w-4 h-4 text-[#A3A3A3]" />
              )}
            </button>
          </div>
          <div className="col-span-3">Case ID &amp; Date</div>
          <div className="col-span-3">Primary Subject</div>
          <div className="col-span-2">Incident &amp; Penal Code</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {isLoadingCases && filteredCases.length === 0 ? (
          <div className="p-12 text-center text-[#525252] flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#3B5B7A]" />
            <span className="text-[13px] font-medium">Querying authoritative cases repository...</span>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="p-10 text-center text-[#525252] font-medium">No matching case records found.</div>
        ) : (
          filteredCases.map((cs, idx) => {
            const isOdd = idx % 2 === 1;
            const isSelected = selectedCaseIds.has(cs.id);
            return (
              <div
                key={cs.id}
                className={`grid grid-cols-1 md:grid-cols-12 gap-3 p-4 md:px-5 transition-colors items-center text-[13px] ${
                  isSelected
                    ? 'bg-[#3B5B7A]/5 border-l-4 border-l-[#3B5B7A]'
                    : isOdd
                    ? 'bg-[#FAFAFA]'
                    : 'bg-white'
                } hover:bg-[#F3F3F4]`}
              >
                {/* Checkbox column */}
                <div className="col-span-1 md:col-span-1 flex items-center justify-between md:justify-start gap-2">
                  <button
                    onClick={() => handleToggleSelectCase(cs.id)}
                    id={`select-case-${cs.id}`}
                    className="p-1 text-[#525252] hover:text-[#171717] cursor-pointer rounded transition-colors flex items-center"
                    aria-label={`Select case ${cs.caseNumber}`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#3B5B7A]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#A3A3A3]" />
                    )}
                  </button>
                  <span className="md:hidden font-mono text-[11px] text-[#525252]">Select</span>
                </div>

                {/* Case ID & Date */}
                <div className="col-span-1 md:col-span-3">
                  <div className="font-mono font-bold text-[#171717]">{cs.caseNumber}</div>
                  <div className="text-[11px] text-[#525252] mt-0.5">Filed: {cs.dateFiled}</div>
                </div>

                {/* Subject */}
                <div className="col-span-1 md:col-span-3 flex items-center gap-3">
                  {cs.profile.mugshotUrl ? (
                    <img
                      src={cs.profile.mugshotUrl}
                      alt={cs.profile.name}
                      className="w-10 h-10 rounded-[8px] object-cover border border-[#E5E5E5] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-[8px] bg-neutral-100 border border-[#E5E5E5] flex items-center justify-center text-neutral-400 shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <button
                      onClick={() => onSelectProfile(cs.profile)}
                      className="font-bold text-[#171717] hover:text-[#3B5B7A] hover:underline truncate block text-left cursor-pointer transition-colors"
                    >
                      {cs.profile.name}
                    </button>
                    <div className="font-mono text-[11px] text-[#525252]">{cs.profile.id}</div>
                  </div>
                </div>

                {/* Description & Code */}
                <div className="col-span-1 md:col-span-2">
                  <div className="text-[#171717] truncate font-medium" title={cs.description}>
                    {cs.description}
                  </div>
                  {cs.penalCode && (
                    <div className="text-[11px] font-mono text-[#525252] mt-0.5 truncate">{cs.penalCode}</div>
                  )}
                </div>

                {/* Status */}
                <div className="col-span-1 md:col-span-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-[6px] text-[11px] font-semibold border ${
                      cs.status === 'Warrant Issued'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : cs.status === 'Under Investigation'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : cs.status === 'Court Pending'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : cs.status === 'Pre-Trial'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-neutral-100 text-[#171717] border-[#E5E5E5]'
                    }`}
                  >
                    {cs.status}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-1 md:col-span-1 flex md:justify-end">
                  <button
                    onClick={() => onOpenCaseModal(cs)}
                    className="px-3.5 py-1.5 bg-[#171717] text-white text-[12px] font-semibold rounded-[8px] hover:bg-black cursor-pointer shadow-xs transition-colors"
                  >
                    Docket
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal for Bulk Status Update */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs select-none animate-backdrop-enter">
          <div className="bg-white border border-[#E5E5E5] rounded-[10px] max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-modal-enter">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[8px] bg-[#3B5B7A]/10 border border-[#3B5B7A]/20 flex items-center justify-center text-[#3B5B7A]">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#171717]">Bulk Status Modification</h3>
                  <div className="text-[11px] text-[#525252]">
                    Updating status for {selectedCaseIds.size} selected case dockets
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-[#525252] hover:text-[#171717] p-1.5 rounded-lg hover:bg-neutral-200/50 transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-[13px]">
              {/* Target Status Selector */}
              <div>
                <label className="block text-[12px] font-semibold text-[#171717] uppercase tracking-wider mb-2">
                  Select New Target Status
                </label>
                <div className="space-y-2">
                  {AVAILABLE_STATUSES.map((item) => {
                    const isSelected = targetStatus === item.status;
                    return (
                      <div
                        key={item.status}
                        onClick={() => setTargetStatus(item.status)}
                        className={`p-3 rounded-[8px] border transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected
                            ? 'border-[#3B5B7A] bg-[#3B5B7A]/5 shadow-xs'
                            : 'border-[#E5E5E5] hover:border-neutral-400 bg-white'
                        }`}
                      >
                        <div className="mt-0.5">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-[#3B5B7A] bg-[#3B5B7A] text-white'
                                : 'border-[#A3A3A3] bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5" />}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#171717]">{item.label}</span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border ${item.badgeClass}`}
                            >
                              Target
                            </span>
                          </div>
                          <p className="text-[11.5px] text-[#525252] mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Records Preview */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-semibold text-[#171717] uppercase tracking-wider">
                    Affected Dockets ({selectedCasesList.length})
                  </label>
                </div>
                <div className="border border-[#E5E5E5] rounded-[8px] max-h-36 overflow-y-auto divide-y divide-[#E5E5E5] bg-[#F8F9FA]">
                  {selectedCasesList.map((cs) => (
                    <div key={cs.id} className="p-2.5 px-3 flex items-center justify-between text-[12px]">
                      <div>
                        <span className="font-mono font-bold text-[#171717] mr-2">{cs.caseNumber}</span>
                        <span className="text-[#525252]">{cs.profile.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#525252] font-mono">{cs.status}</span>
                        <ChevronRight className="w-3 h-3 text-[#A3A3A3]" />
                        <span className="text-[11px] font-semibold text-[#3B5B7A]">{targetStatus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Officer Audit Note */}
              <div>
                <label className="block text-[12px] font-semibold text-[#171717] uppercase tracking-wider mb-1">
                  Departmental Modification Note <span className="font-normal text-[#525252]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  placeholder="e.g. Court ordered reclassification per hearing docket #2026-B..."
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-[8px] text-[12px] text-[#171717] placeholder:text-[#525252]/60 focus:border-[#171717] outline-none"
                />
              </div>

              {/* Audit Warning */}
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-[8px] text-amber-900 text-[11.5px]">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  This action will immediately update the status of all {selectedCaseIds.size} selected case records in the live judicial database and log an entry into the departmental activity ledger.
                </span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-[#E5E5E5] bg-[#F8F9FA] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 bg-white border border-[#E5E5E5] text-[#171717] text-[12px] font-semibold rounded-[8px] hover:bg-[#F3F3F4] transition-colors cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkUpdate}
                id="confirm-bulk-update-button"
                className="px-4 py-2 bg-[#171717] text-white text-[12px] font-semibold rounded-[8px] hover:bg-black transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4 text-white" />
                <span>Apply Status Update ({selectedCaseIds.size})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register New FIR Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-backdrop-enter">
          <div className="bg-white border border-[#E5E5E5] rounded-[12px] max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-modal-enter">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-[#171717] text-white flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#171717]">Register First Information Report (FIR)</h3>
                  <p className="text-[12px] text-[#525252]">
                    Formal intake and judicial docketing into state central crime records repository.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-[#525252] hover:text-[#171717] p-1.5 rounded-[8px] hover:bg-neutral-200/60 transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleRegisterFirSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4 text-[13px] text-[#171717]">
                {firError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-800 text-[12px] flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{firError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1">
                      Offense / Incident Title
                    </label>
                    <input
                      type="text"
                      value={firForm.title}
                      onChange={(e) => setFirForm({ ...firForm, title: e.target.value })}
                      placeholder="e.g. Commercial Burglary at Sector 4"
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-[8px] text-[13px] outline-none focus:border-[#171717]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1">
                      FIR Docket # <span className="font-normal text-[#525252]">(Blank for auto-generation)</span>
                    </label>
                    <input
                      type="text"
                      value={firForm.caseNumber}
                      onChange={(e) => setFirForm({ ...firForm, caseNumber: e.target.value })}
                      placeholder="e.g. FIR-2026-004521"
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-[8px] text-[13px] font-mono outline-none focus:border-[#171717]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1">
                      Crime Category
                    </label>
                    <select
                      value={firForm.category}
                      onChange={(e) => setFirForm({ ...firForm, category: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-[8px] text-[13px] outline-none focus:border-[#171717] cursor-pointer"
                    >
                      <option value="Theft">Theft</option>
                      <option value="Assault">Assault</option>
                      <option value="Fraud">Fraud</option>
                      <option value="Narcotics">Narcotics</option>
                      <option value="Cybercrime">Cybercrime</option>
                      <option value="Fugitive">Fugitive</option>
                      <option value="Financial">Financial Fraud</option>
                      <option value="Homicide">Homicide</option>
                      <option value="Vehicle">Vehicle Crime</option>
                      <option value="Trespassing">Trespassing</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1">
                      Initial Status
                    </label>
                    <select
                      value={firForm.status}
                      onChange={(e) => setFirForm({ ...firForm, status: e.target.value as CaseStatus })}
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-[8px] text-[13px] outline-none focus:border-[#171717] cursor-pointer font-semibold"
                    >
                      <option value="Under Investigation">Under Investigation</option>
                      <option value="Court Pending">Court Pending</option>
                      <option value="Warrant Issued">Warrant Issued</option>
                      <option value="Pre-Trial">Pre-Trial</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1">
                      Incident Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      value={firForm.incidentDate}
                      onChange={(e) => setFirForm({ ...firForm, incidentDate: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-[8px] text-[13px] outline-none focus:border-[#171717]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1">
                      Incident Location / Jurisdiction
                    </label>
                    <input
                      type="text"
                      value={firForm.incidentLocation}
                      onChange={(e) => setFirForm({ ...firForm, incidentLocation: e.target.value })}
                      placeholder="e.g. Cross Road 4, Sector 7, Chennai"
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-[8px] text-[13px] outline-none focus:border-[#171717]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1">
                      Complainant / Informant Name
                    </label>
                    <input
                      type="text"
                      value={firForm.complainantName}
                      onChange={(e) => setFirForm({ ...firForm, complainantName: e.target.value })}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-[8px] text-[13px] outline-none focus:border-[#171717]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1">
                      Complainant Phone / Contact
                    </label>
                    <input
                      type="tel"
                      value={firForm.complainantPhone}
                      onChange={(e) => setFirForm({ ...firForm, complainantPhone: e.target.value })}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-[8px] text-[13px] outline-none focus:border-[#171717]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1">
                      Penal Code Sections
                    </label>
                    <input
                      type="text"
                      value={firForm.penalCode}
                      onChange={(e) => setFirForm({ ...firForm, penalCode: e.target.value })}
                      placeholder="e.g. IPC 379, 411 / BNS 303"
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-[8px] text-[13px] font-mono outline-none focus:border-[#171717]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1">
                      Link Known Subject / Accused <span className="font-normal text-[#525252]">(Optional)</span>
                    </label>
                    <select
                      value={firForm.suspectId}
                      onChange={(e) => setFirForm({ ...firForm, suspectId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-[8px] text-[13px] outline-none focus:border-[#171717] cursor-pointer"
                    >
                      <option value="">No identified suspect yet (Unknown / Pending)</option>
                      {allProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.id}) - {p.category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#525252] uppercase tracking-wider mb-1">
                    FIR Narrative &amp; Facts of the Offense <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={firForm.description}
                    onChange={(e) => setFirForm({ ...firForm, description: e.target.value })}
                    placeholder="Enter comprehensive narrative of the complaint, sequence of events, witness observations, and initial police action taken..."
                    required
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-[8px] text-[13px] outline-none focus:border-[#171717] leading-relaxed resize-y"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[#E5E5E5] bg-[#F8F9FA] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#E5E5E5] text-[#171717] text-[12px] font-semibold rounded-[8px] hover:bg-[#F3F3F4] transition-colors cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFir}
                  id="submit-fir-registration"
                  className="px-5 py-2 bg-[#171717] text-white text-[12px] font-semibold rounded-[8px] hover:bg-black transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmittingFir ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Registering FIR...</span>
                    </>
                  ) : (
                    <>
                      <FilePlus className="w-4 h-4" />
                      <span>Register FIR</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
