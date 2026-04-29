import type { ArticleRow, KnowledgeArticle } from '../types';

/** Строит упорядоченный список с глубиной вложенности (как дерево в сайдбаре). */
export function flattenArticleTree(articles: KnowledgeArticle[]): ArticleRow[] {
  const byParent = new Map<string | null, KnowledgeArticle[]>();
  for (const a of articles) {
    const k = a.parentId ?? null;
    const list = byParent.get(k) ?? [];
    list.push(a);
    byParent.set(k, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  }
  const out: ArticleRow[] = [];

  function walk(parentId: string | null, depth: number) {
    for (const a of byParent.get(parentId) ?? []) {
      out.push({ ...a, depth });
      walk(a.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}

export function hasChildArticles(articles: KnowledgeArticle[], parentId: string): boolean {
  return articles.some((a) => a.parentId === parentId);
}
