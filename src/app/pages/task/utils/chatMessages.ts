import type { TaskRecord } from '../types';

/** Человеческий чат юрист↔клиент в задаче (исключаем канал ассистента). */
export function isLawyerClientChannelMessage(m: unknown): boolean {
  if (!m || typeof m !== 'object') return false;
  const r = m as Record<string, unknown>;
  const t = String(r.type ?? '').trim().toLowerCase();
  if (t === 'assistant') return false;
  if (String(r.sender ?? '').trim().toLowerCase() === 'assistant') return false;
  if (t === 'client') return true;
  const fromLex = typeof r.lexClientUserId === 'string' && r.lexClientUserId.length > 0;
  const fromStaff = typeof r.userId === 'string' && r.userId.length > 0;
  return fromLex || fromStaff;
}

export function filterChatMessagesByType(messages: unknown, type: string) {
  if (!Array.isArray(messages)) return [];
  const want = type.toLowerCase();
  return [...messages]
    .filter((m: any) =>
      want === 'client' ? isLawyerClientChannelMessage(m) : String(m?.type ?? '').trim().toLowerCase() === want,
    )
    .sort(
      (a: { createdAt?: string }, b: { createdAt?: string }) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
    );
}

export function mergeChatMessage(prev: TaskRecord, created: Record<string, unknown>): TaskRecord {
  const list = Array.isArray(prev?.chatMessages) ? [...prev.chatMessages] : [];
  const id = typeof created.id === 'string' ? created.id : null;
  if (id && list.some((x: { id?: string }) => x?.id === id)) {
    return prev;
  }
  list.push(created);
  list.sort(
    (a: { createdAt?: string }, b: { createdAt?: string }) =>
      new Date((a as any).createdAt || 0).getTime() - new Date((b as any).createdAt || 0).getTime(),
  );
  return { ...prev, chatMessages: list as any };
}
