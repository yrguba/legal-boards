import { FileText, Eye, Download, Trash2, Shield } from 'lucide-react';
import type { Document } from '../../../types';
import { filePublicUrl } from '../../task/utils/documentPaths';
import { formatFileSize } from '../utils/formatFileSize';
import { getVisibilityLabel } from '../utils/visibilityLabel';

type Props = {
  documents: Document[];
  apiBaseUrl: string;
  onDelete: (doc: Document) => void;
  canDelete: (doc: Document) => boolean;
  /** Когда в списке были документы, но поиск ничего не нашёл */
  noSearchMatch?: boolean;
};

export function DocumentsTable(p: Props) {
  if (p.documents.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-slate-900 mb-1">
          {p.noSearchMatch ? 'Совпадений нет' : 'Нет документов'}
        </h3>
        <p className="text-sm text-slate-600">
          {p.noSearchMatch
            ? 'Попробуйте другой запрос'
            : 'Документы, доступные вам в этом пространстве, появятся здесь'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Название</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Размер</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Доступ</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Загружено</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-700 w-[140px]">Действия</th>
          </tr>
        </thead>
        <tbody>
          {p.documents.map((doc) => {
            const href = filePublicUrl(p.apiBaseUrl, doc.path);
            return (
              <tr
                key={doc.id}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-5 h-5 text-brand flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-900 truncate" title={doc.name}>
                      {doc.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                  {formatFileSize(doc.size)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
                    <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{getVisibilityLabel(doc)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                  {new Date(doc.uploadedAt).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {href ? (
                      <>
                        <button
                          type="button"
                          onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
                          className="p-1.5 text-slate-600 hover:text-brand hover:bg-brand-light rounded transition-colors"
                          title="Просмотр"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <a
                          href={href}
                          download={doc.name}
                          className="p-1.5 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Скачать"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </>
                    ) : null}
                    {p.canDelete(doc) ? (
                      <button
                        type="button"
                        onClick={() => p.onDelete(doc)}
                        className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
