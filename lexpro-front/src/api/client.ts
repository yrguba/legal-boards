const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5004/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Auth-App': 'lexpro',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    cache: options.cache ?? 'no-store',
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: string;
      code?: string;
    };
    const base = error.error || 'Ошибка запроса';
    const msg =
      error.details && typeof error.details === 'string' ? `${base} (${error.details})` : base;
    throw new ApiError(response.status, msg, error.code);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const authApi = {
  async login(email: string, password: string) {
    const data = await fetchApi<{ token: string; user: LexUser }>('/lex/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('auth_token', data.token);
    return data;
  },

  async lexRegister(payload: {
    email: string;
    password: string;
    name: string;
    clientKind: 'individual' | 'company';
    companyName?: string;
  }) {
    const data = await fetchApi<{ token: string; user: LexUser }>('/lex/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    localStorage.setItem('auth_token', data.token);
    return data;
  },

  async verify() {
    return fetchApi<{ user: LexUser }>('/lex/auth/verify', { method: 'POST' });
  },

  async updateProfile(payload: {
    phone?: string;
    contactNotes?: string;
    name?: string;
    companyName?: string;
  }) {
    return fetchApi<{ user: LexUser }>('/lex/auth/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  logout() {
    localStorage.removeItem('auth_token');
  },
};

export interface LexUser {
  id: string;
  email: string;
  name: string;
  /** Для клиентов LEXPRO всегда `lex_client` */
  role: string;
  clientKind?: string;
  companyName?: string | null;
  phone?: string | null;
  contactNotes?: string | null;
}

export const workspacesApi = {
  async getAll() {
    return fetchApi<Array<{ id: string; name: string; description?: string }>>('/workspaces');
  },
};

export const boardsApi = {
  async getByWorkspace(workspaceId: string) {
    return fetchApi<Array<{ id: string; name: string }>>(`/boards/workspace/${workspaceId}`);
  },

  async getById(id: string) {
    return fetchApi<BoardDetail>(`/boards/${id}`);
  },
};

export interface BoardDetail {
  id: string;
  name: string;
  columns: Array<{ id: string; name: string }>;
  taskTypes: Array<{ id: string; name: string; color?: string }>;
  taskFields?: Array<{ id: string; name: string; type: string; required?: boolean }>;
}

export interface TaskListItem {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string | null;
  typeId: string;
  createdAt: string;
  updatedAt: string;
  customFields?: Record<string, unknown>;
}

export interface TaskComment {
  id: string;
  content: string;
  createdAt: string;
  user?: { id: string; name: string; avatar?: string | null };
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  name: string;
  path: string;
  size?: number;
  type?: string;
}

export interface TaskChatMessage {
  id: string;
  taskId?: string;
  type: string;
  content: string;
  sender: string;
  createdAt: string;
  /** Автор с стороны Legal Boards (юрист), если сообщение от сотрудника */
  userId?: string | null;
  /** Автор с стороны LEXPRO */
  lexClientUserId?: string | null;
  user?: { id: string; name: string; avatar?: string | null };
}

export interface TaskDetail extends TaskListItem {
  type?: { id: string; name: string; color?: string };
  assignee?: { id: string; name: string };
  creator?: { id: string; name: string };
  comments?: TaskComment[];
  chatMessages?: TaskChatMessage[];
  taskAttachments?: TaskAttachment[];
}

export const tasksApi = {
  async getByBoard(boardId: string) {
    return fetchApi<TaskListItem[]>(`/tasks/board/${boardId}`);
  },

  async getById(id: string) {
    return fetchApi<TaskDetail>(`/tasks/${id}`);
  },

  async create(data: {
    boardId: string;
    columnId: string;
    typeId: string;
    title: string;
    description?: string;
    customFields?: Record<string, unknown>;
  }) {
    return fetchApi<TaskDetail>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async addComment(taskId: string, content: string) {
    return fetchApi<TaskComment>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async addChatMessage(taskId: string, type: string, content: string, sender: string) {
    return fetchApi<TaskChatMessage>(`/tasks/${taskId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ type, content, sender }),
    });
  },

  async getStatusHistory(taskId: string) {
    return fetchApi<Array<{ message: string; createdAt: string }>>(`/tasks/${taskId}/status-history`);
  },

  async uploadAttachment(taskId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_URL}/tasks/${taskId}/attachments`, {
      method: 'POST',
      headers: token
        ? { Authorization: `Bearer ${token}`, 'X-Auth-App': 'lexpro' }
        : { 'X-Auth-App': 'lexpro' },
      body: formData,
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: 'Ошибка загрузки' }))) as {
        error?: string;
      };
      throw new ApiError(response.status, error.error || 'Ошибка загрузки');
    }
    return response.json() as Promise<TaskAttachment>;
  },

  async deleteAttachment(taskId: string, attachmentId: string) {
    return fetchApi<void>(`/tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' });
  },
};

export function getApiBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5004/api';
  return apiUrl.replace(/\/api\/?$/, '');
}
