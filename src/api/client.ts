const BASE_URL = 'http://localhost:8000/api/v1';

let authToken: string | null = localStorage.getItem('crms_jwt_token');

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('crms_jwt_token', token);
  } else {
    localStorage.removeItem('crms_jwt_token');
  }
};

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  // Do NOT set Content-Type for FormData — browser sets it with the multipart boundary
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Try to parse a structured error body from the backend
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const errorBody = await response.json();
        // For face-search endpoints, return the error body AS the result
        // so the caller can inspect error_code / success: false
        if (
          errorBody &&
          typeof errorBody === 'object' &&
          'success' in errorBody &&
          errorBody.success === false
        ) {
          // Return error body as if it were the result — caller checks response.success
          return errorBody as T;
        }
        // Otherwise throw with detail message
        const detail = errorBody?.detail || errorBody?.message || JSON.stringify(errorBody);
        throw new Error(`API Error [${response.status}]: ${detail}`);
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message.startsWith('API Error')) {
          throw parseErr;
        }
      }
    }
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`API Error [${response.status}]: ${errorText || response.statusText}`);
  }

  return response.json();
}
