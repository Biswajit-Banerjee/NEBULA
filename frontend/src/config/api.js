// Environment-aware API configuration
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// Dev: proxied by Vite to localhost:8000
// Production: direct calls to production server
export const API_BASE_URL = isDevelopment
  ? '/api'
  : 'https://apollo2.chemistry.gatech.edu/NEBULA/api';

// Helper to build full API URLs
export function getApiUrl(endpoint) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
}
