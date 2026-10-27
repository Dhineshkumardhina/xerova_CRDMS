export type RiskLevel = 'High Risk' | 'Medium Risk' | 'Low Risk';

export type RecordStatus = 
  | 'Active' 
  | 'Historical Record' 
  | 'Warrant Issued' 
  | 'Probation' 
  | 'Cleared' 
  | 'Incarcerated' 
  | 'Under Investigation'
  | 'Closed';

export type CaseStatus = 
  | 'Under Investigation' 
  | 'Court Pending' 
  | 'Warrant Issued' 
  | 'Closed' 
  | 'Pre-Trial';

export type CrimeCategoryType = 
  | 'Theft' 
  | 'Assault' 
  | 'Fraud' 
  | 'Narcotics' 
  | 'Fugitive' 
  | 'Vehicle' 
  | 'Cybercrime' 
  | 'Financial' 
  | 'Homicide'
  | 'Trespassing';

export interface IdentificationMark {
  id: string;
  type: 'scar' | 'tattoo' | 'burn' | 'mark' | 'other';
  description: string;
  location?: string;
  detail?: string;
}

export interface RelativeDetail {
  id: string;
  name: string;
  relation: string; // e.g. Father, Mother, Spouse, Sibling, Child, Guardian, Relative, Other
  phone?: string;
  aadhaar?: string;
  imei?: string;
  address?: string;
  photoUrl?: string;
  notes?: string;
}

export interface SocialMediaDetail {
  id: string;
  platform: string; // e.g. Instagram, Facebook, X (Twitter), Telegram, WhatsApp, TikTok, YouTube, Other
  handle: string; // e.g. @username
  profileUrl?: string;
  notes?: string;
}

export interface CaseRecord {
  id: string;
  caseNumber: string;
  description: string;
  dateFiled: string;
  status: CaseStatus;
  jurisdiction?: string;
  officerInCharge?: string;
  category: CrimeCategoryType | string;
  courtroomNotes?: string;
  penalties?: string;
  courtRoom?: string;
  presidingJudge?: string;
  penalCode?: string;
  notes?: string;
  title?: string;
  incidentDate?: string;
  incidentLocation?: string;
  complainantName?: string;
  complainantPhone?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  size: string;
  type: 'pdf' | 'doc' | 'image';
  uploadedAt?: string;
  dateUploaded?: string;
  url?: string;
  isConfidential?: boolean;
}

export interface MediaItem {
  id: string;
  title: string;
  filename: string;
  type: 'image' | 'photo';
  url: string;
  caption?: string;
  dateTaken?: string;
  dateUploaded?: string;
}

export interface CriminalProfile {
  id: string; // e.g. "CR-001245"
  name: string;
  alias?: string;
  fatherName: string;
  dob: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  identificationNumber: string; // e.g. "XXXX-XXXX-1234"
  rawIdNumber?: string;
  imei?: string;
  primaryAddress: string;
  city: string;
  state: string;
  height: string;
  weight: string;
  eyeColor: string;
  hairColor?: string;
  mugshotUrl: string;
  mugshotDate: string;
  riskLevel: RiskLevel;
  status: RecordStatus;
  isHistorical?: boolean;
  totalCases: number;
  convictions: number;
  activeCasesCount: number;
  category: CrimeCategoryType;
  identificationMarks: IdentificationMark[];
  cases: CaseRecord[];
  documents: DocumentItem[];
  media: MediaItem[];
  relatives?: RelativeDetail[];
  socialMedia?: SocialMediaDetail[];
  isArchived?: boolean;
  notes?: string;
}

export interface Officer {
  id: string;
  badgeNumber: string;
  name: string;
  rank: string;
  department: string;
  clearanceLevel: string;
  avatarUrl: string;
  status: 'On Duty' | 'Off Duty' | 'Active' | 'Suspended' | string;
  isActive?: boolean;
  role?: string;
  region?: string;
  state?: string;
  district?: string;
  policeStationId?: string;
  isSuperuser?: boolean;
  canCreateCriminals?: boolean;
  permissions?: string[];
}

export interface PermissionGrantItem {
  id: string;
  userId: string;
  username: string;
  officerName: string;
  badgeNumber: string;
  region?: string;
  permissionCode: string;
  isGranted: boolean;
  grantedById?: string;
  grantedByName?: string;
  grantedAt?: string;
  revokedById?: string;
  revokedByName?: string;
  revokedAt?: string;
  reason?: string;
}

export interface ActivityItem {
  id: string;
  subjectName: string;
  subjectId: string;
  profileId: string;
  action: 'Warrant Issued' | 'Status Updated' | 'Case Closed' | 'New Record Created' | 'Evidence Uploaded';
  time: string;
  timestamp?: string;
  mugshotUrl?: string;
  badgeType?: 'error' | 'warning' | 'neutral' | 'success';
}

export interface CategoryStat {
  category: CrimeCategoryType;
  recordsCount: number;
  iconName: string;
  badgeColorClass: string;
  textColorClass: string;
}

export type ActiveTab = 'dashboard' | 'search' | 'criminals' | 'categories' | 'cases' | 'reports' | 'settings' | 'support' | 'profile' | 'admin';
