import type { BoardAdvancedSettings } from '../boardAdvancedSettings.types';

type ColumnLite = { id: string; name: string };

export function ReportingSection({
  reporting,
  timeTracking,
  columns,
  onChange,
}: {
  reporting: NonNullable<BoardAdvancedSettings['reporting']>;
  timeTracking: NonNullable<BoardAdvancedSettings['timeTracking']>;
  columns: ColumnLite[];
  onChange: (next: NonNullable<BoardAdvancedSettings['reporting']>) => void;
}) {
  const effectiveStop = timeTracking.stopColumnId;

  return (
    <section className="space-y-3 border-t border-slate-100 pt-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Отчётность</h3>
        <p className="mt-1 text-xs text-slate-500">
          Колонка «Готово» для расчёта lead time и cycle time на странице «Аналитика». Если не
          выбрана — используется финишная колонка учёта времени
          {effectiveStop ? '' : ' (или последняя колонка доски)'}.
        </p>
      </div>
      <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
        <label className="mb-1 block text-[11px] font-medium text-slate-600">
          Колонка «Готово»
        </label>
        <select
          value={reporting.doneColumnId}
          onChange={(e) => onChange({ ...reporting, doneColumnId: e.target.value })}
          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        >
          <option value="">
            {effectiveStop ? 'Как финиш учёта времени' : 'Последняя колонка (по умолчанию)'}
          </option>
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
