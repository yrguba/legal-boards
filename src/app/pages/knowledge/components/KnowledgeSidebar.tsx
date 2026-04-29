import { ChevronRight, FileText, FolderOpen, Plus } from 'lucide-react';
import type { ArticleRow, KnowledgeArticle } from '../types';
import { hasChildArticles } from '../utils/flattenArticleTree';

type KnowledgeSidebarProps = {
  rows: ArticleRow[];
  articles: KnowledgeArticle[];
  selectedId: string | undefined;
  loading: boolean;
  onSelect: (id: string) => void;
  onAddPage: (parentId: string | null) => void;
  onAddSection: (parentId: string | null) => void;
};

export function KnowledgeSidebar({
  rows,
  articles,
  selectedId,
  loading,
  onSelect,
  onAddPage,
  onAddSection,
}: KnowledgeSidebarProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-3">
        <h1 className="text-sm font-semibold text-slate-900">База знаний</h1>
        <p className="mt-0.5 text-xs text-slate-500">Разделы и страницы пространства</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onAddSection(null)}
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            <FolderOpen className="size-3.5 shrink-0 text-amber-700" />
            Раздел
          </button>
          <button
            type="button"
            onClick={() => onAddPage(null)}
            className="inline-flex items-center gap-1 rounded bg-brand px-2 py-1 text-xs text-white hover:bg-brand-hover"
          >
            <Plus className="size-3.5 shrink-0" />
            Страница
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
        {loading ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">Загрузка…</p>
        ) : rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">
            Пока нет материалов. Создайте раздел или страницу.
          </p>
        ) : (
          rows.map((row) => {
            const branch = hasChildArticles(articles, row.id);
            const active = row.id === selectedId;
            return (
              <div
                key={row.id}
                className="flex min-w-0 items-stretch gap-0.5"
                style={{ paddingLeft: row.depth * 12 }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(row.id)}
                  className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    active ? 'bg-brand-light text-brand' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className="shrink-0 text-slate-400">
                    <ChevronRight className="size-3.5 opacity-60" />
                  </span>
                  {branch ? (
                    <FolderOpen className="size-4 shrink-0 text-amber-600" aria-hidden />
                  ) : (
                    <FileText className="size-4 shrink-0 text-slate-400" aria-hidden />
                  )}
                  <span className="truncate">{row.title}</span>
                </button>
                <div className="flex shrink-0 flex-col justify-center gap-0.5">
                  <button
                    type="button"
                    title="Подстраница"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddPage(row.id);
                    }}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Подраздел"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSection(row.id);
                    }}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-amber-800"
                  >
                    <FolderOpen className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
