import type { TaskRecord } from '../types';

export function filterChatMessagesByType(messages: unknown, type: string) {
  if (!Array.isArray(messages)) return [];
  return [...messages]
    .filter((m: any) => m.type === type)
    .sort(
      (a: { createdAt?: string }, b: { createdAt?: string }) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
    );
}

export function mergeChatMessage(prev: TaskRecord, created: Record<string, unknown>): TaskRecord {
  const next = [...(Array.isArray(prev?.chatMessages) ? prev.chatMessages : []), created];
  next.sort(
    (a: { createdAt?: string }, b: { createdAt?: string }) =>
      new Date((a as any).createdAt || 0).getTime() - new Date((b as any).createdAt || 0).getTime(),
  );
  return { ...prev, chatMessages: next as any };
}
