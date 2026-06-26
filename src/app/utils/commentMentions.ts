/** Markdown token stored in DB: [@Name](mention:userId) */
const MENTION_TOKEN_SOURCE = String.raw`\[@([^\]]+)\]\(mention:([^)]+)\)`;

export type MentionCandidate = {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
};

export type CommentMentionInsert = {
  userId: string;
  name: string;
};

export function formatCommentMentionToken(userId: string, name: string): string {
  const safeName = name.replace(/\]/g, '').trim() || 'Пользователь';
  return `[@${safeName}](mention:${userId})`;
}

export function commentHasMentions(content: string): boolean {
  return new RegExp(MENTION_TOKEN_SOURCE).test(content);
}

export function parseCommentMentionUserIds(content: string): string[] {
  const ids = new Set<string>();
  const re = new RegExp(MENTION_TOKEN_SOURCE, 'g');
  for (const match of content.matchAll(re)) {
    const id = match[2]?.trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Visible @Name in editor → stored mention tokens on submit. */
export function encodeCommentMentionText(
  text: string,
  inserts: ReadonlyArray<CommentMentionInsert>,
): string {
  let result = text;
  for (const ins of inserts) {
    const needle = `@${ins.name}`;
    const idx = result.indexOf(needle);
    if (idx === -1) continue;
    result =
      result.slice(0, idx) +
      formatCommentMentionToken(ins.userId, ins.name) +
      result.slice(idx + needle.length);
  }
  return result;
}

/** Active @-query at cursor while composing (not after a finished @Name). */
export function findActiveMentionQuery(
  text: string,
  cursor: number,
  completedMentions: ReadonlyArray<Pick<CommentMentionInsert, 'name'>> = [],
): { start: number; query: string } | null {
  const before = text.slice(0, cursor);

  for (
    let atIdx = before.lastIndexOf('@');
    atIdx >= 0;
    atIdx = atIdx > 0 ? before.lastIndexOf('@', atIdx - 1) : -1
  ) {
    if (atIdx > 0 && !/[\s(\n]/.test(before[atIdx - 1]!)) {
      continue;
    }

    const query = before.slice(atIdx + 1);
    if (/\n/.test(query)) {
      continue;
    }

    const isFinishedMention = completedMentions.some((m) => {
      const mentionText = `@${m.name}`;
      if (before.slice(atIdx, atIdx + mentionText.length) !== mentionText) return false;
      return cursor >= atIdx + mentionText.length;
    });
    if (isFinishedMention) {
      continue;
    }

    return { start: atIdx, query };
  }

  return null;
}

function mentionMatchScore(user: MentionCandidate, q: string): number {
  const name = user.name.toLowerCase();
  const email = user.email?.toLowerCase() ?? '';
  if (name.startsWith(q)) return 4;
  if (name.split(/\s+/).some((part) => part.startsWith(q))) return 3;
  if (name.includes(q)) return 2;
  if (email.includes(q)) return 1;
  return -1;
}

export function filterMentionCandidates(
  users: MentionCandidate[],
  query: string,
  excludeUserId?: string,
): MentionCandidate[] {
  const q = query.trim().toLowerCase();
  return users
    .filter((u) => u.id !== excludeUserId)
    .map((u) => ({ u, score: q ? mentionMatchScore(u, q) : 0 }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.u.name.localeCompare(b.u.name, 'ru');
    })
    .slice(0, 10)
    .map(({ u }) => u);
}

export function iterCommentMentionTokens(content: string): Iterable<RegExpMatchArray> {
  return content.matchAll(new RegExp(MENTION_TOKEN_SOURCE, 'g'));
}
