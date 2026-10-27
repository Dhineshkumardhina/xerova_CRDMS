import { apiRequest, setAuthTokens, clearTokens, getApiBaseUrl } from './client';
import { CriminalProfile, CaseStatus, Officer, ActivityItem, PermissionGrantItem } from '../types';

export interface SearchParams {
  q?: string;
  category?: string;
  status?: string;
  location?: string;
  policeStation?: string;
  gender?: string;
  minAge?: number;
  maxAge?: number;
  startDate?: string;
  endDate?: string;
  recordStatus?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface SearchResponse {
  success?: boolean;
  query: string;
  records: CriminalProfile[];
  results?: CriminalProfile[];
  total?: number;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  executionTimeMs: number;
}

export const api = {
  // Auth
  async login(officerId: string, password?: string): Promise<{ officer: Officer; token: string }> {
    const data = await apiRequest<{ access_token: string; refresh_token: string; officer: Officer }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ officerId, password: password || '' }),
    });
    setAuthTokens(data.access_token, data.refresh_token);
    return { officer: data.officer, token: data.access_token };
  },

  async logout(): Promise<void> {
    try {
      const refreshToken = localStorage.getItem('crms_refresh_token');
      if (refreshToken) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch {
      // Ignore logout backend errors
    } finally {
      clearTokens();
    }
  },

  async getMe(): Promise<Officer> {
    return await apiRequest<Officer>('/auth/me');
  },

  async getOfficers(): Promise<Officer[]> {
    try {
      return await apiRequest<Officer[]>('/users');
    } catch (err) {
      console.warn('Backend users/officers unavailable:', err);
      return [];
    }
  },

  async getCategories(): Promise<any[]> {
    try {
      return await apiRequest<any[]>('/categories');
    } catch (err) {
      console.warn('Backend categories unavailable:', err);
      return [];
    }
  },

  // Criminal Profiles
  async getProfiles(): Promise<CriminalProfile[]> {
    try {
      return await apiRequest<CriminalProfile[]>('/criminals');
    } catch (err) {
      console.warn('Backend API unavailable, using cached profiles:', err);
      const saved = localStorage.getItem('crms_criminal_profiles_v2');
      return saved ? JSON.parse(saved) : [];
    }
  },

  async saveProfile(profile: CriminalProfile): Promise<CriminalProfile> {
    try {
      return await apiRequest<CriminalProfile>('/criminals', {
        method: 'POST',
        body: JSON.stringify(profile),
      });
    } catch (err) {
      console.warn('Backend save unavailable, persisting to localStorage:', err);
      return profile;
    }
  },

  async toggleArchive(profileId: string): Promise<boolean> {
    try {
      const res = await apiRequest<{ isArchived: boolean }>(`/criminals/${profileId}/archive`, {
        method: 'PUT',
      });
      return res.isArchived;
    } catch (err) {
      return false;
    }
  },

  // Photo Upload Storage API
  async uploadCriminalPhoto(criminalId: string, file: File, isPrimary: boolean = false): Promise<any> {
    const token = localStorage.getItem('crms_access_token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('is_primary', isPrimary ? 'true' : 'false');

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/criminals/${criminalId}/photos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(errorData.detail || 'Photo upload failed');
    }

    const resData = await response.json();
    return resData.photo;
  },

  async deleteCriminalPhoto(criminalId: string, photoId: string): Promise<void> {
    await apiRequest(`/criminals/${criminalId}/photos/${photoId}`, {
      method: 'DELETE',
    });
  },

  // Document Management API
  async uploadDocument(
    file: File,
    title?: string,
    documentType?: string,
    criminalId?: string,
    caseId?: string
  ): Promise<any> {
    const token = localStorage.getItem('crms_access_token');
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (documentType) formData.append('document_type', documentType);
    if (criminalId) formData.append('criminal_id', criminalId);
    if (caseId) formData.append('case_id', caseId);

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/documents/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Document upload failed' }));
      throw new Error(errorData.detail || 'Document upload failed');
    }

    return await response.json();
  },

  async getDocuments(criminalId?: string, caseId?: string): Promise<any[]> {
    const params: string[] = [];
    if (criminalId) params.push(`criminal_id=${encodeURIComponent(criminalId)}`);
    if (caseId) params.push(`case_id=${encodeURIComponent(caseId)}`);
    const queryStr = params.length > 0 ? `?${params.join('&')}` : '';
    return await apiRequest<any[]>(`/documents${queryStr}`);
  },

  async downloadDocumentUrl(documentId: string): Promise<string> {
    return `${getApiBaseUrl()}/documents/${documentId}/download`;
  },

  async deleteDocument(documentId: string): Promise<void> {
    await apiRequest(`/documents/${documentId}`, {
      method: 'DELETE',
    });
  },

  // Server-Side Advanced Search Engine
  async searchRecords(params: SearchParams): Promise<SearchResponse> {
    const queryParts: string[] = [];
    if (params.q) queryParts.push(`q=${encodeURIComponent(params.q)}`);
    if (params.category) queryParts.push(`category=${encodeURIComponent(params.category)}`);
    if (params.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);
    if (params.location) queryParts.push(`location=${encodeURIComponent(params.location)}`);
    if (params.policeStation) queryParts.push(`policeStation=${encodeURIComponent(params.policeStation)}`);
    if (params.gender) queryParts.push(`gender=${encodeURIComponent(params.gender)}`);
    if (params.minAge !== undefined) queryParts.push(`minAge=${params.minAge}`);
    if (params.maxAge !== undefined) queryParts.push(`maxAge=${params.maxAge}`);
    if (params.startDate) queryParts.push(`startDate=${encodeURIComponent(params.startDate)}`);
    if (params.endDate) queryParts.push(`endDate=${encodeURIComponent(params.endDate)}`);
    if (params.recordStatus) queryParts.push(`recordStatus=${encodeURIComponent(params.recordStatus)}`);
    if (params.page) queryParts.push(`page=${params.page}`);
    if (params.pageSize) queryParts.push(`pageSize=${params.pageSize}`);
    if (params.sortBy) queryParts.push(`sortBy=${params.sortBy}`);
    if (params.sortOrder) queryParts.push(`sortOrder=${params.sortOrder}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return await apiRequest<SearchResponse>(`/search${queryString}`);
  },

  // Cases & FIR Management API
  async getCases(status?: string, category?: string): Promise<any[]> {
    const params: string[] = [];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    const q = params.length > 0 ? `?${params.join('&')}` : '';
    return await apiRequest<any[]>(`/cases${q}`);
  },

  async createCase(caseData: {
    caseNumber?: string;
    title?: string;
    description: string;
    category?: string;
    status?: string;
    dateFiled?: string;
    incidentDate?: string;
    incidentLocation?: string;
    complainantName?: string;
    complainantPhone?: string;
    penalCode?: string;
    courtRoom?: string;
    presidingJudge?: string;
    courtroomNotes?: string;
    notes?: string;
    penalties?: string;
    suspectIds?: string[];
  }): Promise<any> {
    return await apiRequest('/cases', {
      method: 'POST',
      body: JSON.stringify(caseData),
    });
  },

  async getCaseDetail(caseId: string): Promise<any> {
    return await apiRequest(`/cases/${caseId}/detail`);
  },

  async updateCase(caseId: string, updateData: {
    title?: string;
    description?: string;
    category?: string;
    status?: string;
    incidentDate?: string;
    incidentLocation?: string;
    complainantName?: string;
    complainantPhone?: string;
    penalCode?: string;
    courtRoom?: string;
    presidingJudge?: string;
    courtroomNotes?: string;
    notes?: string;
    penalties?: string;
  }): Promise<any> {
    return await apiRequest(`/cases/${caseId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  async addCaseActivity(
    caseId: string,
    titleOrObj: string | { title?: string; description?: string; activityType?: string },
    description?: string,
    activityType: string = 'Investigation Note'
  ): Promise<any> {
    let payload: { title: string; description: string; activityType: string };
    if (typeof titleOrObj === 'object' && titleOrObj !== null) {
      payload = {
        title: titleOrObj.title || 'Investigation Update',
        description: titleOrObj.description || '',
        activityType: titleOrObj.activityType || 'Investigation Note',
      };
    } else {
      payload = {
        title: typeof titleOrObj === 'string' ? titleOrObj : 'Investigation Update',
        description: description || '',
        activityType: activityType || 'Investigation Note',
      };
    }
    return await apiRequest(`/cases/${caseId}/activities`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async linkPersonToCase(caseId: string, criminalId: string, roleInCase: string = 'Primary Suspect'): Promise<any> {
    return await apiRequest(`/cases/${caseId}/link-person`, {
      method: 'POST',
      body: JSON.stringify({ criminalId, roleInCase }),
    });
  },

  async assignCaseOfficer(caseId: string, leadOfficerId: string): Promise<any> {
    return await apiRequest(`/cases/${caseId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ leadOfficerId }),
    });
  },

  async bulkUpdateCaseStatus(caseIds: string[], newStatus: CaseStatus): Promise<void> {
    try {
      await apiRequest('/cases/bulk-status', {
        method: 'POST',
        body: JSON.stringify({ caseIds, newStatus }),
      });
    } catch (err) {
      console.warn('Backend bulk case update failed:', err);
    }
  },

  async downloadDocument(documentId: string, filename?: string): Promise<void> {
    const token = localStorage.getItem('crms_access_token');
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/documents/${documentId}/download`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Failed to download document' }));
      throw new Error(err.detail || 'Download failed');
    }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || `document_${documentId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },

  // Facial Recognition Search
  async searchFace(photoUrl: string): Promise<Array<{ profile: CriminalProfile; confidence: number }>> {
    try {
      const res = await apiRequest<{ matches?: Array<{ profile: CriminalProfile; confidence: number }>; results?: Array<{ profile: CriminalProfile; confidence: number }> }>(
        '/search/photo',
        {
          method: 'POST',
          body: JSON.stringify({ photoUrl }),
        }
      );
      return res.matches || res.results || [];
    } catch (err) {
      console.warn('Backend face search error:', err);
      return [];
    }
  },

  // Audit Logs
  async getAuditLogs(): Promise<ActivityItem[]> {
    try {
      return await apiRequest<ActivityItem[]>('/audit-logs');
    } catch (err) {
      return [];
    }
  },

  // Reports & Descriptive Analytics
  async getReportsAnalytics(): Promise<{
    totalCriminals: number;
    activeCases: number;
    totalCases: number;
    categoryCounts: Array<{ category: string; count: number }>;
    statusCounts: Array<{ status: string; count: number }>;
    stationCounts: Array<{ station: string; count: number }>;
    dailyTrends: Array<{
      date: string;
      fullDate: string;
      dayIndex: number;
      cases: number;
      warrants: number;
      isSpike: boolean;
      spikeLabel?: string;
    }>;
    recentRecords: Array<{
      id: string;
      name: string;
      category: string;
      status: string;
      createdAt: string;
    }>;
  }> {
    return await apiRequest('/analytics/summary');
  },

  // Hierarchical RBAC & User Management
  async createUser(userData: {
    username: string;
    password?: string;
    fullName: string;
    badgeNumber: string;
    rank?: string;
    department?: string;
    clearanceLevel?: string;
    roleName?: string;
    roleId?: string;
    region?: string;
    district?: string;
    state?: string;
    policeStationId?: string;
  }): Promise<Officer> {
    return await apiRequest<Officer>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async updateUser(userId: string, updateData: Partial<Officer> & { isActive?: boolean; roleName?: string; roleId?: string }): Promise<Officer> {
    return await apiRequest<Officer>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  async grantCriminalRecordPermission(userId: string, granted: boolean, reason?: string): Promise<{ isGranted: boolean; message: string }> {
    return await apiRequest<{ isGranted: boolean; message: string }>(`/users/${userId}/permissions/criminal-create`, {
      method: 'POST',
      body: JSON.stringify({ granted, reason }),
    });
  },

  async getCriminalPermissionGrants(): Promise<PermissionGrantItem[]> {
    try {
      return await apiRequest<PermissionGrantItem[]>('/permissions/criminal-create-grants');
    } catch (err) {
      console.warn('Unable to fetch criminal create grants:', err);
      return [];
    }
  },
};

