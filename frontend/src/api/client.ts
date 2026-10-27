/// <reference types="vite/client" />

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('crms_api_base_url');
    if (customUrl) return customUrl.replace(/\/+$/, '');
    if ((window as any).electronAPI?.apiBaseUrl) {
      return (window as any).electronAPI.apiBaseUrl.replace(/\/+$/, '');
    }
    // Check if running inside native Capacitor on Android
    const isCapacitor = Boolean((window as any).Capacitor?.isNativePlatform?.());
    if (isCapacitor) {
      const configuredMobileUrl = (import.meta as any).env?.VITE_MOBILE_API_BASE_URL || (import.meta as any).env?.VITE_API_BASE_URL;
      if (configuredMobileUrl) return configuredMobileUrl.replace(/\/+$/, '');
      // Standard Android emulator loopback host fallback
      return 'http://10.0.2.2:8000/api/v1';
    }
  }
  return ((import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '');
}

export const API_BASE_URL = getApiBaseUrl();

let accessToken: string | null = localStorage.getItem('crms_access_token');
let refreshToken: string | null = localStorage.getItem('crms_refresh_token');

export const setAuthTokens = (access: string | null, refresh: string | null = null) => {
  accessToken = access;
  if (access) {
    localStorage.setItem('crms_access_token', access);
  } else {
    localStorage.removeItem('crms_access_token');
  }

  if (refresh !== null) {
    refreshToken = refresh;
    if (refresh) {
      localStorage.setItem('crms_refresh_token', refresh);
    } else {
      localStorage.removeItem('crms_refresh_token');
    }
  }
};

export const getAuthToken = (): string | null => accessToken;

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('crms_access_token');
  localStorage.removeItem('crms_refresh_token');
};

let isRefreshing = false;

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number; retries?: number } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs || 25000;
  const maxRetries = options.retries ?? (options.method === undefined || options.method === 'GET' ? 1 : 0);

  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt++;
    const headers = new Headers(options.headers || {});

    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const baseUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Handle 401 Unauthorized token expiration
      if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
        if (!isRefreshing && refreshToken) {
          isRefreshing = true;
          try {
            const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refreshToken }),
            });

            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              setAuthTokens(refreshData.access_token, refreshData.refresh_token || refreshToken);
              headers.set('Authorization', `Bearer ${refreshData.access_token}`);

              // Retry original request
              response = await fetch(`${baseUrl}${endpoint}`, {
                ...options,
                headers,
              });
            } else {
              clearTokens();
              window.dispatchEvent(new Event('crms:unauthorized'));
            }
          } catch {
            clearTokens();
            window.dispatchEvent(new Event('crms:unauthorized'));
          } finally {
            isRefreshing = false;
          }
        } else if (!refreshToken) {
          clearTokens();
          window.dispatchEvent(new Event('crms:unauthorized'));
        }
      }

      if (!response.ok) {
        let errorDetail = response.statusText;
        try {
          const errJson = await response.json();
          if (typeof errJson === 'object' && errJson !== null) {
            errorDetail = errJson.message || errJson.detail || (typeof errJson.error === 'string' ? `${errJson.error}: ${errJson.message || ''}` : JSON.stringify(errJson));
          } else {
            errorDetail = String(errJson);
          }
        } catch {
          errorDetail = await response.text();
        }
        throw new Error(errorDetail || `API Error [${response.status}]`);
      }

      return response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err.name === 'AbortError';
      const isNetworkError = isAbort || err.message?.includes('NetworkError') || err.message?.includes('Failed to fetch');

      if (isNetworkError && attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }

      if (isAbort) {
        throw new Error(`Network request timed out after ${timeoutMs / 1000}s. Please verify server connection.`);
      }
      throw err;
    }
  }

  throw new Error('Network request failed after maximum retries');
}
