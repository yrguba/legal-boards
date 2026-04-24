const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5004/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
    throw new ApiError(response.status, error.error || 'Ошибка запроса');
  }

  return response.json();
}

// Auth API
export const authApi = {
  async login(email: string, password: string) {
    const data = await fetchApi<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('auth_token', data.token);
    return data;
  },

  async register(email: string, password: string, name: string, role: string = 'member') {
    const data = await fetchApi<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
    });
    localStorage.setItem('auth_token', data.token);
    return data;
  },

  async verify() {
    return fetchApi<{ user: any }>('/auth/verify', { method: 'POST' });
  },

  logout() {
    localStorage.removeItem('auth_token');
  },
};

// Users API
export const usersApi = {
  async getAll() {
    return fetchApi<any[]>('/users');
  },

  async getByWorkspace(workspaceId: string) {
    return fetchApi<any[]>(`/users/workspace/${workspaceId}`);
  },

  async getById(id: string) {
    return fetchApi<any>(`/users/${id}`);
  },

  async create(data: any) {
    return fetchApi<any>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return fetchApi<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi<void>(`/users/${id}`, { method: 'DELETE' });
  },
};

// Workspaces API
export const workspacesApi = {
  async getAll() {
    return fetchApi<any[]>('/workspaces');
  },

  async getById(id: string) {
    return fetchApi<any>(`/workspaces/${id}`);
  },

  async create(data: { name: string; description?: string }) {
    return fetchApi<any>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: { name?: string; description?: string }) {
    return fetchApi<any>(`/workspaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi<void>(`/workspaces/${id}`, { method: 'DELETE' });
  },

  async addUser(workspaceId: string, userEmail: string) {
    return fetchApi<any>(`/workspaces/${workspaceId}/users`, {
      method: 'POST',
      body: JSON.stringify({ userEmail }),
    });
  },
};

// Departments API
export const departmentsApi = {
  async getByWorkspace(workspaceId: string) {
    return fetchApi<any[]>(`/departments/workspace/${workspaceId}`);
  },

  async getById(id: string) {
    return fetchApi<any>(`/departments/${id}`);
  },

  async create(data: { name: string; description?: string; workspaceId: string }) {
    return fetchApi<any>('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: { name?: string; description?: string }) {
    return fetchApi<any>(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi<void>(`/departments/${id}`, { method: 'DELETE' });
  },

  async updateMembers(departmentId: string, userIds: string[]) {
    return fetchApi<any>(`/departments/${departmentId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    });
  },
};

// Groups API
export const groupsApi = {
  async getByWorkspace(workspaceId: string) {
    return fetchApi<any[]>(`/groups/workspace/${workspaceId}`);
  },

  async getById(id: string) {
    return fetchApi<any>(`/groups/${id}`);
  },

  async create(data: { name: string; description?: string; workspaceId: string; memberIds?: string[] }) {
    return fetchApi<any>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: { name?: string; description?: string }) {
    return fetchApi<any>(`/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi<void>(`/groups/${id}`, { method: 'DELETE' });
  },

  async updateMembers(groupId: string, userIds: string[]) {
    return fetchApi<any>(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    });
  },
};

// Boards API
export const boardsApi = {
  async getByWorkspace(workspaceId: string) {
    return fetchApi<any[]>(`/boards/workspace/${workspaceId}`);
  },

  async getById(id: string) {
    return fetchApi<any>(`/boards/${id}`);
  },

  async create(data: any) {
    return fetchApi<any>('/boards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return fetchApi<any>(`/boards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi<void>(`/boards/${id}`, { method: 'DELETE' });
  },

  async moveTasks(boardId: string, fromColumnId: string, toColumnId: string) {
    return fetchApi<{ moved: number }>(`/boards/${boardId}/columns/${fromColumnId}/move-tasks`, {
      method: 'POST',
      body: JSON.stringify({ toColumnId }),
    });
  },

  async moveTasksType(boardId: string, fromTypeId: string, toTypeId: string) {
    return fetchApi<{ moved: number }>(`/boards/${boardId}/types/${fromTypeId}/move-tasks`, {
      method: 'POST',
      body: JSON.stringify({ toTypeId }),
    });
  },
};

// Tasks API
export const tasksApi = {
  async getByBoard(boardId: string) {
    return fetchApi<any[]>(`/tasks/board/${boardId}`);
  },

  async getById(id: string) {
    return fetchApi<any>(`/tasks/${id}`);
  },

  async create(data: any) {
    return fetchApi<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return fetchApi<any>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return fetchApi<void>(`/tasks/${id}`, { method: 'DELETE' });
  },

  async addComment(taskId: string, content: string) {
    return fetchApi<any>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async addChatMessage(taskId: string, type: string, content: string, sender: string) {
    return fetchApi<any>(`/tasks/${taskId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ type, content, sender }),
    });
  },
};

// Documents API
export const documentsApi = {
  async getByWorkspace(workspaceId: string, opts?: { taskId?: string }) {
    const params = new URLSearchParams();
    if (opts?.taskId) params.set('taskId', opts.taskId);
    const qs = params.toString();
    return fetchApi<any[]>(`/documents/workspace/${workspaceId}${qs ? `?${qs}` : ''}`);
  },

  async upload(file: File, workspaceId: string, visibility: any) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('workspaceId', workspaceId);
    formData.append('visibility', JSON.stringify(visibility));

    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_URL}/documents/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ошибка загрузки' }));
      throw new ApiError(response.status, error.error);
    }

    return response.json();
  },

  async delete(id: string) {
    return fetchApi<void>(`/documents/${id}`, { method: 'DELETE' });
  },
};

// Notifications API
export const notificationsApi = {
  async getAll() {
    return fetchApi<any[]>('/notifications');
  },

  async getUnreadCount() {
    return fetchApi<{ count: number }>('/notifications/unread');
  },

  async markAsRead(id: string) {
    return fetchApi<any>(`/notifications/${id}/read`, { method: 'PUT' });
  },

  async markAllAsRead() {
    return fetchApi<any>('/notifications/read-all', { method: 'PUT' });
  },

  async delete(id: string) {
    return fetchApi<void>(`/notifications/${id}`, { method: 'DELETE' });
  },
};

export { ApiError };
