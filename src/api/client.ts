import { useStore } from "../store";

const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}, timeoutMs = 15000) {
  const token = useStore.getState().token;

  const headers = new Headers(options.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  // L3 FIX: Apply a timeout so a stalled server response never hangs the UI.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new ApiError(response.status, `API Error: ${response.statusText}`);
  }

  // if no content return null
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  rooms: {
    create: (data: any) => fetchWithAuth('/rooms', { method: 'POST', body: JSON.stringify(data) }),
    join: (code: string, data: any) => fetchWithAuth(`/rooms/${code}/join`, { method: 'POST', body: JSON.stringify(data) }),
    close: () => fetchWithAuth(`/rooms/close`, { method: 'POST' }),
  },
  participants: {
    list: () => fetchWithAuth('/rooms/participants'),
    updateStatus: (id: string, status: string) => fetchWithAuth(`/rooms/participants/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    updateRole: (id: string, role: string) => fetchWithAuth(`/rooms/participants/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    approveAll: () => fetchWithAuth(`/rooms/participants/approve-all`, { method: 'PUT' })
  },
  resources: {
    list: () => fetchWithAuth('/rooms/resources'),
    getPresignedUrl: (fileName: string, mimeType: string, size: number) => fetchWithAuth('/rooms/files/presigned-url', { method: 'POST', body: JSON.stringify({ fileName, mimeType, size }) }),
    uploadFile: (url: string, file: File) => {
      // url is now a relative path like /api/v1/uploads/{fileId}
      const token = useStore.getState().token;
      return fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
    }
  },
  audit: {
    list: () => fetchWithAuth('/rooms/audit-logs'),
  }
};
