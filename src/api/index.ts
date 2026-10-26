import { apiRequest, setAuthToken } from './client';
import { CriminalProfile, CaseStatus, Officer, ActivityItem } from '../types';

// ── Quality Metrics ──────────────────────────────────────────────────────────
export interface FaceQualityMetrics {
  quality_score?: number;
  blur_score?: number;
  brightness?: number;
  contrast?: number;
  is_frontal?: boolean;
  yaw?: number;
  pitch?: number;
  roll?: number;
  face_area_ratio?: number;
  improvement_tips?: string[];
}

// ── Face search result candidate ─────────────────────────────────────────────
export interface FaceSearchResult {
  profile: CriminalProfile;
  criminal_id: string;
  photo_id?: string;
  name: string;
  photo: string;
  confidence: number;       // 0–100, cosine similarity percentage
  similarityScore: number;  // same as confidence
  distance?: number;        // Cosine distance 0.0 - 2.0
  confidenceLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  matchStatus: 'Potential Match';
  match_type: 'potential_match';
  disclaimer: string;
}

export interface FaceSearchResponse {
  status?: string;
  success: boolean;
  face_detected?: boolean;
  match_found?: boolean;
  queryFaceDetected?: boolean;
  face_count?: number;
  faceCount?: number;
  total: number;
  query_face_quality?: number;
  quality_metrics?: FaceQualityMetrics;
  improvement_tips?: string[];
  results: FaceSearchResult[];
  matches: FaceSearchResult[];
  nearest_candidate?: {
    criminal_id: string;
    name?: string;
    similarity: number;
    distance?: number;
  };
  threshold_applied: number;
  model_name?: string;
  model_version?: string;
  embedding_dimension?: number;
  embeddings_searched?: number;
  processing_time_ms?: number;
  disclaimer?: string;
  message?: string;
  error_code?: string;
  faces?: Array<{ bbox: number[]; det_score: number; quality_score?: number }>;
}

export interface BiometricStatusResponse {
  service: string;
  status: string;
  model_name: string;
  model_version: string;
  framework: string;
  embedding_dimension: number;
  default_similarity_threshold: number;
  high_confidence_threshold: number;
  execution_providers: string[];
  indexed_templates_count: number;
  license_status: string;
  timestamp: string;
}

export interface ReindexReportResponse {
  status: string;
  total_records: number;
  processed: number;
  successful: number;
  failed: number;
  failures: Array<{ criminal_id: string; photo_id?: string; reason: string }>;
  timestamp: string;
}

export const api = {
  // Auth
  async login(badgeNumber: string): Promise<{ officer: Officer; token: string }> {
    try {
      const data = await apiRequest<{ access_token: string; officer: Officer }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ badgeNumber }),
      });
      setAuthToken(data.access_token);
      return { officer: data.officer, token: data.access_token };
    } catch (err) {
      console.warn('Backend login fallback:', err);
      return {
        token: 'demo-token-123',
        officer: {
          id: 'OFF-8829',
          badgeNumber: badgeNumber || '8829',
          name: 'Det. Alex Vance',
          rank: 'Senior Special Agent',
          department: 'Major Crimes Division // DOJ',
          clearanceLevel: 'Level 4 - High Security',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
          status: 'On Duty',
        },
      };
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
      const persisted = await apiRequest<CriminalProfile>('/criminals', {
        method: 'POST',
        body: JSON.stringify(profile),
      });
      // Cache to local storage
      try {
        const saved = localStorage.getItem('crms_criminal_profiles_v2');
        const list: CriminalProfile[] = saved ? JSON.parse(saved) : [];
        const updatedList = [persisted, ...list.filter((p) => p.id !== persisted.id)];
        localStorage.setItem('crms_criminal_profiles_v2', JSON.stringify(updatedList));
      } catch {
        // ignore localStorage quota errors
      }
      return persisted;
    } catch (err) {
      console.error('Backend save error:', err);
      throw err;
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

  /**
   * Facial Recognition Search
   * Sends image file or base64 to /search/photo (or /face-search /scan-face).
   */
  async searchFaceFile(file: File): Promise<FaceSearchResponse> {
    const formData = new FormData();
    formData.append('image', file);

    const response = await apiRequest<FaceSearchResponse>('/search/photo', {
      method: 'POST',
      body: formData,
    });

    return response;
  },

  /**
   * Status of biometric engine
   */
  async getBiometricStatus(): Promise<BiometricStatusResponse> {
    return await apiRequest<BiometricStatusResponse>('/face-recognition/status');
  },

  /**
   * Rebuild biometric index
   */
  async rebuildFaceIndex(): Promise<ReindexReportResponse> {
    return await apiRequest<ReindexReportResponse>('/face-recognition/rebuild-index', {
      method: 'POST',
    });
  },

  /**
   * @deprecated Use searchFaceFile(file) instead.
   */
  async searchFace(_photoUrl: string): Promise<FaceSearchResult[]> {
    console.warn('[DEPRECATED] api.searchFace(url) called — use api.searchFaceFile(file) instead.');
    return [];
  },

  // Audit Logs
  async getAuditLogs(): Promise<ActivityItem[]> {
    try {
      return await apiRequest<ActivityItem[]>('/audit-logs');
    } catch (err) {
      return [];
    }
  },
};
