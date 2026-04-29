import { MantineProvider } from '@mantine/core';
import { Save, Trash2 } from 'lucide-react';
import { useCallback, useLayoutEffect, useState } from 'react';
import { knowledgeApi } from '../../../services/api';
import type { KnowledgeArticle } from '../types';
import { KnowledgeBlockNote } from './KnowledgeBlockNote';

type KnowledgeEditorProps = {
  article: KnowledgeArticle | null;
  loadingList: boolean;
  onSaved: (a: KnowledgeArticle) => void;
  onDeleted: (removedId: string) => void;
};

export function KnowledgeEditor({ article, loadingList, onSaved, onDeleted }: KnowledgeEditorProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!article) {
      setTitle('');
      setBody('');
      return;
    }
    setTitle(article.title);
    setBody(article.body);
  }, [article?.id]);

  const dirty =
    !!article &&
    (title.trim() !== article.title.trim() || body !== article.body);

  const handleSave = useCallback(async () => {
    if (!article || !dirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = (await knowledgeApi.update(article.id, {
        title: title.trim() || 'Без названия',
        body,
      })) as KnowledgeArticle;
      onSaved(updated);
      setTitle(updated.title);
      setBody(updated.body);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }, [article, body, title, dirty, onSaved]);

  const handleDelete = useCallback(async () => {
    if (!article || !confirm('Удалить эту страницу со всеми вложенными?')) return;
    const id = article.id;
    try {
      await knowledgeApi.remove(id);
      onDeleted(id);
    } catch {
      setSaveError('Не удалось удалить');
    }
  }, [article, onDeleted]);

  if (loadingList) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
        Загрузка…
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
        <div className="max-w-md text-slate-600">
          Выберите страницу слева или создайте новую через «Страница» или «Раздел».
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-8 py-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Заголовок"
          className="min-w-0 flex-1 border-0 bg-transparent text-xl font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="size-4" />
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50"
            title="Удалить"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      {saveError ? (
        <div className="mx-8 mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {saveError}
        </div>
      ) : null}
      <MantineProvider>
        <KnowledgeBlockNote articleId={article.id} markdown={body} onMarkdownChange={setBody} />
      </MantineProvider>
      <div className="shrink-0 border-t border-slate-100 px-8 py-2 text-xs text-slate-400">
        Последнее обновление:{' '}
        {article.updatedAt ? new Date(article.updatedAt).toLocaleString('ru-RU') : '—'}
        {dirty ? ' · Есть несохранённые изменения' : ''}
        {' · '}
        Текст хранится в формате Markdown (редактор BlockNote)
      </div>
    </div>
  );
}
