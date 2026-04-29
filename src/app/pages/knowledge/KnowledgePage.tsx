import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { knowledgeApi } from '../../services/api';
import { useApp } from '../../store/AppContext';
import type { KnowledgeArticle } from './types';
import { flattenArticleTree } from './utils/flattenArticleTree';
import { KnowledgeEditor } from './components/KnowledgeEditor';
import { KnowledgeSidebar } from './components/KnowledgeSidebar';

function descendantIds(rootId: string, list: KnowledgeArticle[]): Set<string> {
  const ids = new Set<string>();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    ids.add(id);
    for (const a of list) {
      if (a.parentId === id) queue.push(a.id);
    }
  }
  return ids;
}

export function KnowledgePage() {
  const { currentWorkspace } = useApp();
  const navigate = useNavigate();
  const { articleId } = useParams<{ articleId: string }>();

  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const wsId = currentWorkspace?.id;

  const refresh = useCallback(async () => {
    if (!wsId) {
      setArticles([]);
      return;
    }
    setListError(null);
    try {
      const rows = await knowledgeApi.listByWorkspace(wsId);
      setArticles(rows as KnowledgeArticle[]);
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : 'Не удалось загрузить базу знаний');
      setArticles([]);
    }
  }, [wsId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const flatRows = useMemo(() => flattenArticleTree(articles), [articles]);

  useEffect(() => {
    if (!wsId || loading || articleId || articles.length === 0) return;
    const tree = flattenArticleTree(articles);
    const first = tree[0];
    if (first) navigate(`/knowledge/${first.id}`, { replace: true });
  }, [wsId, loading, articleId, articles, navigate]);

  useEffect(() => {
    if (!articleId || !wsId || loading) return;
    if (articles.some((a) => a.id === articleId)) return;
    let cancelled = false;
    void (async () => {
      try {
        const one = await knowledgeApi.getById(articleId);
        if (cancelled || one.workspaceId !== wsId) return;
        setArticles((prev) => (prev.some((a) => a.id === one.id) ? prev : [...prev, one as KnowledgeArticle]));
      } catch {
        navigate('/knowledge', { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId, wsId, loading, articles, navigate]);

  const selected = useMemo(
    () => (articleId ? articles.find((a) => a.id === articleId) ?? null : null),
    [articles, articleId],
  );

  const onSaved = useCallback((updated: KnowledgeArticle) => {
    setArticles((prev) => prev.map((a) => (a.id === updated.id ? { ...updated } : a)));
  }, []);

  const onDeletedArticle = useCallback(
    (removedId: string) => {
      setArticles((prev) => {
        const drop = descendantIds(removedId, prev);
        const next = prev.filter((a) => !drop.has(a.id));
        const order = flattenArticleTree(next);
        const go = order[0]?.id;
        queueMicrotask(() => navigate(go ? `/knowledge/${go}` : '/knowledge', { replace: true }));
        return next;
      });
    },
    [navigate],
  );

  const onSelect = useCallback((id: string) => navigate(`/knowledge/${id}`), [navigate]);

  const handleAdd = useCallback(
    async (parentId: string | null, kind: 'section' | 'page') => {
      if (!wsId) return;
      const title = kind === 'section' ? 'Новый раздел' : 'Новая страница';
      try {
        const created = await knowledgeApi.create(wsId, { parentId, title, body: '' });
        const c = created as KnowledgeArticle;
        setArticles((prev) => [...prev, c]);
        navigate(`/knowledge/${c.id}`);
      } catch {
        /* error toast optional */
      }
    },
    [wsId, navigate],
  );

  if (!wsId || !currentWorkspace) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8 text-center text-sm text-slate-600">
        Выберите рабочее пространство в шапке, чтобы работать с базой знаний.
      </div>
    );
  }

  return (
    <div className="box-border flex min-h-0 flex-1 flex-col p-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
        {listError ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{listError}</div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <KnowledgeSidebar
            rows={flatRows}
            articles={articles}
            selectedId={articleId}
            loading={loading}
            onSelect={onSelect}
            onAddPage={(parentId) => void handleAdd(parentId, 'page')}
            onAddSection={(parentId) => void handleAdd(parentId, 'section')}
          />

          <KnowledgeEditor
            article={selected}
            loadingList={loading}
            onSaved={onSaved}
            onDeleted={onDeletedArticle}
          />
        </div>
      </div>
    </div>
  );
}
