// Vite proxies this path during development, and Upsun routes it to the backend.
export const API_BASE_URL = '/api';

// Helper to build full API URLs
export function getApiUrl(endpoint) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
}
