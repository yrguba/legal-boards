export function getApiBaseUrl(): string {
  const apiUrl: string = import.meta.env.VITE_API_URL || 'http://localhost:5004/api';
  return apiUrl.replace(/\/api\/?$/, '');
}
