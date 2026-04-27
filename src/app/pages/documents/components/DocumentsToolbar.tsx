import { Search, Upload } from 'lucide-react';

type Props = {
  searchQuery: string;
  onSearch: (q: string) => void;
  onOpenUpload: () => void;
  uploadDisabled: boolean;
};

export function DocumentsToolbar(p: Props) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Документы</h1>
        <p className="text-sm text-slate-600 mt-1">Хранилище с настройкой доступа по пространству, отделам и группам</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={p.searchQuery}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder="Поиск документов…"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
        <button
          type="button"
          onClick={p.onOpenUpload}
          disabled={p.uploadDisabled}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded hover:bg-brand-hover transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          Загрузить документ
        </button>
      </div>
    </div>
  );
}
