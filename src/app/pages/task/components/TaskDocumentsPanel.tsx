import { ExternalLink, Eye, FileText } from 'lucide-react';
import { Link } from 'react-router';
import type { Document } from '../../../types';
import { formatFileSize } from '../../documents/utils/formatFileSize';
import { getVisibilityLabel } from '../../documents/utils/visibilityLabel';
import { filePublicUrl } from '../utils/documentPaths';
import type { DocumentPreviewState } from '../types';
import { t } from '../taskPage.classes';

type Props = {
  documents: Document[];
  loading: boolean;
  error: string | null;
  apiBaseUrl: string;
  onPreviewDoc: (doc: DocumentPreviewState) => void;
};

export function TaskDocumentsPanel(p: Props) {
  return (
    <div className="space-y-4">
      <div className={`${t.card} p-3 text-sm text-slate-600`}>
        <p className="mb-2">
          Здесь — <strong>общие документы пространства</strong> (по правам доступа). Файлы только для этой задачи
          загружаются в блоке <strong>«Вложения»</strong> в карточке слева.
        </p>
        <Link to="/documents" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
          <ExternalLink className="h-3.5 w-3.5" />
          Все функции: загрузка, права, удаление
        </Link>
      </div>

      {p.error ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{p.error}</div>
      ) : null}

      {p.loading ? (
        <div className="text-sm text-slate-500 py-6 text-center">Загрузка списка…</div>
      ) : p.documents.length === 0 ? (
        <div className="text-sm text-slate-500 py-6 text-center rounded border border-dashed border-slate-200">
          Нет доступных вам документов в пространстве
        </div>
      ) : (
        <div className="space-y-2">
          {p.documents.map((doc) => {
            const href = filePublicUrl(p.apiBaseUrl, doc.path);
            const canPreview =
              !!href &&
              (String(doc.type || '').startsWith('image/') || doc.type === 'application/pdf');
            return (
              <div
                key={doc.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-brand shrink-0" />
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-slate-900 truncate hover:text-brand"
                        title={doc.name}
                      >
                        {doc.name}
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-slate-900 truncate">{doc.name}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 pl-6">
                    {formatFileSize(doc.size)} · {getVisibilityLabel(doc)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canPreview && href ? (
                    <button
                      type="button"
                      onClick={() => p.onPreviewDoc({ ...doc, href } as DocumentPreviewState)}
                      className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      <Eye className="h-3.5 w-3.5 inline-block mr-0.5" />
                      Просмотр
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
