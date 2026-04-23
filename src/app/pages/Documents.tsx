import { useState } from 'react';
import { documents } from '../store/mockData';
import { useApp } from '../store/AppContext';
import { Upload, FileText, Download, Trash2, Eye, Shield } from 'lucide-react';

export function Documents() {
  const { currentWorkspace } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const workspaceDocuments = documents.filter((d) => d.workspaceId === currentWorkspace?.id);

  const filteredDocuments = workspaceDocuments.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getVisibilityLabel = (doc: typeof documents[0]) => {
    switch (doc.visibility.type) {
      case 'workspace':
        return 'Всё пространство';
      case 'department':
        return `Отделы (${doc.visibility.departmentIds?.length || 0})`;
      case 'group':
        return `Группы (${doc.visibility.groupIds?.length || 0})`;
      case 'custom':
        return 'Выборочно';
      default:
        return 'Не указано';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Документы</h1>
          <p className="text-sm text-slate-600 mt-1">
            Хранилище документов с настройкой доступа
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors">
          <Upload className="w-4 h-4" />
          Загрузить документ
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск документов..."
          className="w-full max-w-md px-4 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">
            {searchQuery ? 'Документы не найдены' : 'Нет документов'}
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            {searchQuery
              ? 'Попробуйте изменить поисковый запрос'
              : 'Загрузите первый документ для начала работы'}
          </p>
          {!searchQuery && (
            <button className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors">
              Загрузить документ
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">
                  Название
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">
                  Размер
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">
                  Видимость
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">
                  Загружено
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-700">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-brand flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-900">{doc.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{formatFileSize(doc.size)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">{getVisibilityLabel(doc)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">
                      {new Date(doc.uploadedAt).toLocaleDateString('ru-RU')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 text-slate-600 hover:text-brand hover:bg-brand-light rounded transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
