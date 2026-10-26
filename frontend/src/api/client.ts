/// <reference types="vite/client" />

export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const BASE_URL = API_BASE_URL;

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
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized token expiration
  if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
    if (!isRefreshing && refreshToken) {
      isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setAuthTokens(refreshData.access_token);
          headers.set('Authorization', `Bearer ${refreshData.access_token}`);
          
          // Retry original request
          response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers,
          });
        } else {
          clearTokens();
          window.dispatchEvent(new Event('crms:unauthorized'));
        }
      } catch (err) {
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
}
