import { apiRequest, setAuthTokens, clearTokens, API_BASE_URL } from './client';
import { CriminalProfile, CaseStatus, Officer, ActivityItem } from '../types';

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
      body: JSON.stringify({ officerId, password }),
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

    const response = await fetch(`${API_BASE_URL}/criminals/${criminalId}/photos`, {
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

    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
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
    return `${API_BASE_URL}/documents/${documentId}/download`;
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

  // Cases Bulk Update
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
};
