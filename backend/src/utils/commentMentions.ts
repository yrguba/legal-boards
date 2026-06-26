/** Markdown token stored in DB: [@Name](mention:userId) */
const MENTION_TOKEN_SOURCE = String.raw`\[@([^\]]+)\]\(mention:([^)]+)\)`;

export function formatCommentMentionToken(userId: string, name: string): string {
  const safeName = name.replace(/\]/g, '').trim() || 'Пользователь';
  return `[@${safeName}](mention:${userId})`;
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
