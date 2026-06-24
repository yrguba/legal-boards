const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5004/api' : '/api');

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

  return response.json();
}

// Auth API
export const authApi = {
  async getRegistrationConfig() {
    return fetchApi<{ enabled: boolean }>('/auth/registration-config');
  },

  async login(email: string, password: string) {
    const data = await fetchApi<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('auth_token', data.token);
    return data;
  },

  async register(email: string, password: string, name: string) {
    return fetchApi<{
      message: string;
      email: string;
      requiresVerification: boolean;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  async resendVerification(email: string) {
    return fetchApi<{ message: string }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async acceptInvite(token: string) {
    const data = await fetchApi<{
      message: string;
      token?: string;
      user?: any;
    }>(`/auth/invite?token=${encodeURIComponent(token)}`);
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
    }
    return data;
  },

  async verifyEmail(token: string) {
    const data = await fetchApi<{
      message: string;
      token?: string;
      user?: any;
      alreadyVerified?: boolean;
    }>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
    }
    return data;
  },

  async verify() {
    return fetchApi<{ user: any }>('/auth/verify', { method: 'POST' });
  },

  async changePassword(data: { currentPassword?: string; newPassword: string }) {
    return fetchApi<{ user: any; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout() {
    localStorage.removeItem('auth_token');
  },
};

// Users API
export const usersApi = {
  async getLexClientsConfig() {
    return fetchApi<{ enabled: boolean }>('/users/lex-clients/config');
  },

  async getAll() {
    return fetchApi<any[]>('/users');
  },

  async getByWorkspace(workspaceId: string) {
    return fetchApi<any[]>(`/users/workspace/${workspaceId}`);
  },

  async getLexClientsByWorkspace(workspaceId: string) {
    return fetchApi<any[]>(`/users/workspace/${workspaceId}/clients`);
  },

  async getLexClientsDirectory(
    workspaceId: string,
    params?: { q?: string; minTasks?: string; maxTasks?: string; typeId?: string },
  ) {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.minTasks !== undefined && params.minTasks !== '') sp.set('minTasks', params.minTasks);
    if (params?.maxTasks !== undefined && params.maxTasks !== '') sp.set('maxTasks', params.maxTasks);
    if (params?.typeId) sp.set('typeId', params.typeId);
    const qs = sp.toString();
    return fetchApi<{
      serviceTypes: { id: string; name: string }[];
      clients: Array<{
        id: string;
        email: string;
        name: string;
        clientKind: string | null;
        companyName: string | null;
        createdAt: string;
        workspaceLinkedAt: string;
        taskCount: number;
        tasks: Array<{
          id: string;
          title: string;
          boardId: string;
          boardName: string;
          typeId: string;
          typeName: string;
          createdAt: string;
        }>;
        interactions: Array<{
          id: string;
          taskId: string;
          taskTitle: string;
          boardId: string;
          boardName: string;
          kind: string;
          title: string;
          details: string | null;
          occurredAt: string;
          createdAt: string;
          user: { id: string; name: string; avatar: string | null };
          taskTypeId: string;
          taskTypeName: string;
        }>;
      }>;
    }>(`/users/workspace/${workspaceId}/lex-directory${qs ? `?${qs}` : ''}`);
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

  async resetPassword(id: string, workspaceId: string) {
    return fetchApi<{
      message: string;
      inviteSent: boolean;
      loginEmail?: string;
      initialPassword?: string;
    }>(
      `/users/${id}/reset-password`,
      {
        method: 'POST',
        body: JSON.stringify({ workspaceId }),
      },
    );
  },

  async delete(id: string) {
    return fetchApi<void>(`/users/${id}`, { method: 'DELETE' });
  },

  async getCatalog(workspaceId: string, params?: Record<string, string | undefined>) {
    const q = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '') q.set(k, v);
      }
    }
    const qs = q.toString();
    return fetchApi<any[]>(
      `/users/workspace/${workspaceId}/catalog${qs ? `?${qs}` : ''}`,
    );
  },

  async updateProfile(
    userId: string,
    workspaceId: string,
    profileFields: Record<string, unknown>,
  ) {
    return fetchApi<any>(`/users/${userId}/profile`, {
      method: 'PUT',
      body: JSON.stringify({ workspaceId, profileFields }),
    });
  },

  async lookupInWorkspace(workspaceId: string, email: string) {
    const q = new URLSearchParams({ email });
    return fetchApi<{
      exists: boolean;
      userId?: string;
      name?: string;
      email?: string;
      alreadyMember?: boolean;
      pendingInviteId?: string | null;
    }>(`/workspaces/${workspaceId}/users/lookup?${q}`);
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

  async getEmployeeProfileFields(workspaceId: string) {
    return fetchApi<any[]>(`/workspaces/${workspaceId}/employee-profile-fields`);
  },

  async listInvites(workspaceId: string, status = 'pending') {
    const q = new URLSearchParams({ status });
    return fetchApi<any[]>(`/workspaces/${workspaceId}/invites?${q}`);
  },

  async createInvite(
    workspaceId: string,
    data: { email: string; role?: string; departmentId?: string; groupIds?: string[] },
  ) {
    return fetchApi<{ id: string; status: string; emailSent: boolean; user?: { name: string; email: string } }>(
      `/workspaces/${workspaceId}/invites`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  async cancelInvite(workspaceId: string, inviteId: string) {
    return fetchApi<{ message: string }>(`/workspaces/${workspaceId}/invites/${inviteId}`, {
      method: 'DELETE',
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

  async create(data: {
    name: string;
    description?: string;
    workspaceId: string;
    departmentId: string;
    memberIds?: string[];
    leaderId?: string | null;
  }) {
    return fetchApi<any>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(
    id: string,
    data: { name?: string; description?: string; leaderId?: string | null },
  ) {
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

  async createAggregated(data: {
    name: string;
    code: string;
    description?: string;
    workspaceId: string;
    visibility?: Record<string, unknown>;
    sourceBoardIds: string[];
  }) {
    return fetchApi<any>('/boards/aggregated', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAggregated(
    id: string,
    data: {
      name?: string;
      code?: string;
      description?: string;
      visibility?: Record<string, unknown>;
      sourceBoardIds?: string[];
    },
  ) {
    return fetchApi<any>(`/boards/${id}/aggregated`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return fetchApi<any>(`/boards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async patchAdvancedSettings(id: string, advancedSettings: Record<string, unknown>) {
    return fetchApi<any>(`/boards/${id}/advanced-settings`, {
      method: 'POST',
      body: JSON.stringify({ advancedSettings }),
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

  async transferTasks(
    sourceBoardId: string,
    data: {
      targetBoardId: string;
      targetColumnId?: string;
      taskIds: string[];
      typeMapping?: Record<string, string>;
      defaultTargetTypeId?: string;
      force?: boolean;
    },
  ) {
    return fetchApi<{
      moved: { taskId: string; oldKey: string; newKey: string; assigneeCleared?: boolean }[];
      skipped: { taskId: string; reason: string; code?: string }[];
      warnings: { taskId: string; code: string; message: string }[];
    }>(`/boards/${sourceBoardId}/transfer-tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
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

  async reorderInColumn(boardId: string, columnId: string, taskIds: string[]) {
    return fetchApi<{ ok: boolean }>('/tasks/reorder', {
      method: 'POST',
      body: JSON.stringify({ boardId, columnId, taskIds }),
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

  /** Сообщение в чат ассистента: сохраняется запись пользователя, ответ генерируется через Groq. */
  async postAssistantChat(taskId: string, content: string) {
    return fetchApi<{ userMessage: unknown; assistantMessage: unknown }>(`/tasks/${taskId}/chat/assistant`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async addClientInteraction(
    taskId: string,
    data: { kind: string; title: string; details?: string; occurredAt?: string },
  ) {
    return fetchApi<any>(`/tasks/${taskId}/client-interactions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async uploadAttachment(taskId: string, file: File, opts?: { purpose?: 'general' | 'conclusion' }) {
    const formData = new FormData();
    formData.append('file', file);
    if (opts?.purpose === 'conclusion') {
      formData.append('purpose', 'conclusion');
    }
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_URL}/tasks/${taskId}/attachments`, {
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

  async patchTaskConclusion(taskId: string, conclusionText: string | null) {
    return fetchApi<{ conclusionText: string | null }>(`/tasks/${taskId}/conclusion`, {
      method: 'PATCH',
      body: JSON.stringify({ conclusionText }),
    });
  },

  async deleteAttachment(taskId: string, attachmentId: string) {
    return fetchApi<void>(`/tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' });
  },

  async submitApproval(
    taskId: string,
    ruleId: string,
    opts?: { action?: 'approve' | 'reject'; reason?: string },
  ) {
    return fetchApi<any>(`/tasks/${taskId}/approvals`, {
      method: 'POST',
      body: JSON.stringify({
        ruleId,
        action: opts?.action ?? 'approve',
        reason: opts?.reason,
      }),
    });
  },

  async completeColumnAction(
    taskId: string,
    ruleId: string,
    payload: Record<string, unknown>,
    forColumnId: string,
  ) {
    return fetchApi<any>(`/tasks/${taskId}/column-actions`, {
      method: 'POST',
      body: JSON.stringify({ ruleId, payload, forColumnId }),
    });
  },

  async getActivity(taskId: string) {
    return fetchApi<{ items: import('../utils/activityLog').TaskActivityItem[] }>(
      `/tasks/${taskId}/activity`,
    );
  },
};

// Чаты пространства / отдела / группы
export const workspaceChatsApi = {
  async listChannels(workspaceId: string) {
    return fetchApi<
      {
        id: string;
        channelKey: string;
        scope: string;
        title: string;
        departmentId: string | null;
        groupId: string | null;
        directUserIds?: string[];
        peerUser?: { id: string; name: string; avatar: string | null; email: string } | null;
        createdAt: string;
      }[]
    >(`/workspace-chats/workspace/${workspaceId}/channels`);
  },

  async openDirectChat(workspaceId: string, participantUserId: string) {
    return fetchApi<{
      id: string;
      channelKey: string;
      scope: string;
      title: string;
      departmentId: string | null;
      groupId: string | null;
      directUserIds: string[];
      peerUser: { id: string; name: string; avatar: string | null; email: string } | null;
      createdAt: string;
    }>(`/workspace-chats/workspace/${workspaceId}/direct`, {
      method: 'POST',
      body: JSON.stringify({ participantUserId }),
    });
  },

  async getMessages(channelId: string, before?: string) {
    const q = before ? `?before=${encodeURIComponent(before)}` : '';
    return fetchApi<{
      messages: {
        id: string;
        content: string;
        createdAt: string;
        user: { id: string; name: string; avatar: string | null; email: string };
        attachments?: {
          id: string;
          name: string;
          type: string;
          size: number;
          path: string;
          createdAt: string;
        }[];
      }[];
      hasMore: boolean;
    }>(`/workspace-chats/channels/${channelId}/messages${q}`);
  },

  async postMessage(channelId: string, content: string, files?: File[]) {
    const formData = new FormData();
    formData.append('content', content);
    for (const file of files ?? []) {
      formData.append('files', file);
    }
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_URL}/workspace-chats/channels/${channelId}/messages`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ошибка отправки сообщения' }));
      throw new ApiError(response.status, error.error || 'Ошибка отправки сообщения');
    }
    const data = await response.json();
    return {
      ...data,
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
    } as {
      id: string;
      content: string;
      createdAt: string;
      user: { id: string; name: string; avatar: string | null; email: string };
      attachments: {
        id: string;
        name: string;
        type: string;
        size: number;
        path: string;
        createdAt: string;
      }[];
    };
  },
};

export type CalendarEventDto = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string; email: string; avatar: string | null };
  attendeeUserIds: string[];
  attendees: { id: string; name: string; email: string; avatar: string | null }[];
  conferenceId?: string;
  conferenceStatus?: string;
};

// События календаря пространства
export const calendarEventsApi = {
  async listByWorkspace(workspaceId: string, fromIso: string, toIso: string) {
    const q = `?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`;
    return fetchApi<CalendarEventDto[]>(`/calendar-events/workspace/${workspaceId}${q}`);
  },

  async create(data: {
    workspaceId: string;
    title: string;
    description?: string | null;
    startAt: string;
    endAt: string;
    attendeeIds: string[];
  }) {
    return fetchApi<CalendarEventDto>('/calendar-events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      startAt?: string;
      endAt?: string;
      attendeeIds?: string[];
    },
  ) {
    return fetchApi<CalendarEventDto>(`/calendar-events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async remove(id: string) {
    return fetchApi<{ ok: boolean }>(`/calendar-events/${id}`, { method: 'DELETE' });
  },
};

// Conferences API
export const conferencesApi = {
  async getConfig() {
    return fetchApi<{ enabled: boolean; jitsiDomain: string }>('/conferences/config');
  },

  async getPublic(shareToken: string) {
    return fetchApi<{
      title: string;
      roomName: string;
      jitsiDomain: string;
      status: string;
    }>(`/conferences/public/${shareToken}`);
  },

  async listByWorkspace(workspaceId: string) {
    return fetchApi<any[]>(`/conferences/workspace/${workspaceId}`);
  },

  async getById(id: string) {
    return fetchApi<any>(`/conferences/${id}`);
  },

  async createInstant(workspaceId: string, title?: string) {
    return fetchApi<any>('/conferences/instant', {
      method: 'POST',
      body: JSON.stringify({ workspaceId, title }),
    });
  },

  async createScheduled(data: {
    workspaceId: string;
    title: string;
    description?: string | null;
    startAt: string;
    endAt: string;
    attendeeIds: string[];
  }) {
    return fetchApi<any>('/conferences/scheduled', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async end(id: string) {
    return fetchApi<any>(`/conferences/${id}/end`, { method: 'POST' });
  },

  async update(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      startAt?: string;
      endAt?: string;
      attendeeIds?: string[];
    },
  ) {
    return fetchApi<any>(`/conferences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async cancel(id: string) {
    return fetchApi<{ message: string; notifyStats?: { notifications: number; emails: number } }>(
      `/conferences/${id}/cancel`,
      { method: 'POST' },
    );
  },

  async delete(id: string) {
    return fetchApi<{ message: string }>(`/conferences/${id}`, { method: 'DELETE' });
  },

  async shareToChat(id: string) {
    return fetchApi<{ message: string; channelsCount: number }>(`/conferences/${id}/share-chat`, {
      method: 'POST',
    });
  },
};

// Documents API (глобальная библиотека пространства, не вложения задач)
export const documentsApi = {
  async getByWorkspace(workspaceId: string) {
    return fetchApi<any[]>(`/documents/workspace/${workspaceId}`);
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

/** База знаний (страницы в дереве разделов). */
export const knowledgeApi = {
  async listByWorkspace(workspaceId: string) {
    return fetchApi<
      Array<{
        id: string;
        workspaceId: string;
        parentId: string | null;
        title: string;
        body: string;
        position: number;
        createdById: string;
        createdAt: string;
        updatedAt: string;
      }>
    >(`/knowledge/workspaces/${workspaceId}/knowledge-articles`);
  },

  async getById(id: string) {
    return fetchApi<{
      id: string;
      workspaceId: string;
      parentId: string | null;
      title: string;
      body: string;
      position: number;
      createdById: string;
      createdAt: string;
      updatedAt: string;
    }>(`/knowledge/knowledge-articles/${id}`);
  },

  async create(workspaceId: string, data: { title?: string; body?: string; parentId?: string | null }) {
    return fetchApi<{
      id: string;
      workspaceId: string;
      parentId: string | null;
      title: string;
      body: string;
      position: number;
      createdById: string;
      createdAt: string;
      updatedAt: string;
    }>(`/knowledge/workspaces/${workspaceId}/knowledge-articles`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    });
  },

  async update(id: string, data: { title?: string; body?: string; parentId?: string | null }) {
    return fetchApi<{
      id: string;
      workspaceId: string;
      parentId: string | null;
      title: string;
      body: string;
      position: number;
      createdById: string;
      createdAt: string;
      updatedAt: string;
    }>(`/knowledge/knowledge-articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async remove(id: string) {
    return fetchApi<{ ok: boolean }>(`/knowledge/knowledge-articles/${id}`, { method: 'DELETE' });
  },
};

export type AppPublicConfig = {
  documents: boolean;
  knowledge: boolean;
  chat: boolean;
  calendar: boolean;
  workspaceInviteEmail: boolean;
};

export const configApi = {
  async getFeatureTabs() {
    return fetchApi<AppPublicConfig>('/config/tabs');
  },
};

export type NotificationSettingGroup = { id: string; label: string };

export type NotificationSettingItem = {
  key: string;
  label: string;
  description: string;
  group: string;
  defaultEnabled: boolean;
  enabled: boolean;
};

export type NotificationSettingsResponse = {
  groups: NotificationSettingGroup[];
  settings: NotificationSettingItem[];
};

// Invites API
export const invitesApi = {
  async getMine(status = 'pending') {
    const q = new URLSearchParams({ status });
    return fetchApi<
      Array<{
        id: string;
        workspaceId: string;
        role: string;
        departmentId?: string | null;
        groupIds: string[];
        status: string;
        expiresAt: string;
        workspace?: { id: string; name: string };
        invitedBy?: { id: string; name: string; email: string };
      }>
    >(`/invites/mine?${q}`);
  },

  async getByToken(token: string) {
    const q = new URLSearchParams({ token });
    return fetchApi<{
      id: string;
      workspaceId: string;
      role: string;
      status: string;
      workspace?: { id: string; name: string };
      invitedBy?: { id: string; name: string; email: string };
    }>(`/invites/by-token?${q}`);
  },

  async accept(id: string) {
    return fetchApi<{ workspaceId: string; workspaceName: string; alreadyMember?: boolean }>(
      `/invites/${id}/accept`,
      { method: 'POST' },
    );
  },

  async decline(id: string) {
    return fetchApi<{ message: string }>(`/invites/${id}/decline`, { method: 'POST' });
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

  async getSettings() {
    return fetchApi<NotificationSettingsResponse>('/notifications/settings');
  },

  async updateSettings(settings: Record<string, boolean>) {
    return fetchApi<NotificationSettingsResponse>('/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
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

export const reportsApi = {
  async getBoardDashboard(
    boardId: string,
    opts?: { agingDays?: number; assigneeId?: string; periodDays?: number },
  ) {
    const params = new URLSearchParams();
    if (opts?.agingDays != null) params.set('agingDays', String(opts.agingDays));
    if (opts?.assigneeId) params.set('assigneeId', opts.assigneeId);
    if (opts?.periodDays != null) params.set('periodDays', String(opts.periodDays));
    const q = params.toString();
    return fetchApi<import('../utils/boardReports').BoardDashboardReport>(
      `/reports/boards/${encodeURIComponent(boardId)}/dashboard${q ? `?${q}` : ''}`,
    );
  },
};
