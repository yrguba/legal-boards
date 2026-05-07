import type { BoardAdvancedSettings } from '../boardAdvancedSettings.types';

type ColumnLite = { id: string; name: string };

function ColumnRadioGroup({
  title,
  description,
  name,
  selectedId,
  columns,
  onSelect,
}: {
  title: string;
  description: string;
  name: string;
  selectedId: string;
  columns: ColumnLite[];
  onSelect: (columnId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="mb-1 text-sm font-medium text-slate-800">{title}</div>
      <p className="mb-2 text-[11px] text-slate-500">{description}</p>
      <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
        {columns.length === 0 ? (
          <p className="text-xs text-slate-400">На доске нет колонок</p>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-white">
              <input
                type="radio"
                name={name}
                checked={selectedId === ''}
                onChange={() => onSelect('')}
                className="border-slate-300"
              />
              <span className="text-slate-500">Не выбрано</span>
            </label>
            {columns.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-white"
              >
                <input
                  type="radio"
                  name={name}
                  checked={selectedId === c.id}
                  onChange={() => onSelect(c.id)}
                  className="border-slate-300"
                />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ColumnMultiList({
  title,
  description,
  columnIds,
  columns,
  onToggle,
}: {
  title: string;
  description: string;
  columnIds: string[];
  columns: ColumnLite[];
  onToggle: (columnId: string, checked: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="mb-1 text-sm font-medium text-slate-800">{title}</div>
      <p className="mb-2 text-[11px] text-slate-500">{description}</p>
      <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
        {columns.length === 0 ? (
          <p className="text-xs text-slate-400">На доске нет колонок</p>
        ) : (
          columns.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-white"
            >
              <input
                type="checkbox"
                checked={columnIds.includes(c.id)}
                onChange={(e) => onToggle(c.id, e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="truncate">{c.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export function TimeTrackingSection({
  timeTracking,
  columns,
  onChange,
}: {
  timeTracking: NonNullable<BoardAdvancedSettings['timeTracking']>;
  columns: ColumnLite[];
  onChange: (next: NonNullable<BoardAdvancedSettings['timeTracking']>) => void;
}) {
  const toggleIgnore = (columnId: string, checked: boolean) => {
    const cur = new Set(timeTracking.ignoreColumnIds);
    if (checked) cur.add(columnId);
    else cur.delete(columnId);
    onChange({ ...timeTracking, ignoreColumnIds: [...cur] });
  };

  const radioGroupStart = 'board-time-tracking-start';
  const radioGroupStop = 'board-time-tracking-stop';

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Автоматический контроль времени</h3>
        <p className="mt-1 text-xs text-slate-500">
          Выберите по одному статусу (колонке), с которого начинать учёт и на котором его останавливать. Пока задача
          проходит цикл от стартовой колонки до финишной, на карточке отображается нарастающий таймер; по достижении
          финишной колонки накапливается затраченное время.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-3">
        <ColumnRadioGroup
          title="Начинать с"
          description="Один статус: при первом попадании задачи в эту колонку открывается цикл учёта времени."
          name={radioGroupStart}
          selectedId={timeTracking.startColumnId}
          columns={columns}
          onSelect={(startColumnId) => onChange({ ...timeTracking, startColumnId })}
        />
        <ColumnRadioGroup
          title="Останавливать при"
          description="Один статус: при входе в эту колонку цикл закрывается, секунды сохраняются в задаче."
          name={radioGroupStop}
          selectedId={timeTracking.stopColumnId}
          columns={columns}
          onSelect={(stopColumnId) => onChange({ ...timeTracking, stopColumnId })}
        />
        <ColumnMultiList
          title="Не учитывать"
          description="Время в этих статусах в активном цикле не суммируется (пауза)."
          columnIds={timeTracking.ignoreColumnIds}
          columns={columns}
          onToggle={toggleIgnore}
        />
      </div>
    </section>
  );
}
