import { Plus, Trash2 } from 'lucide-react';
import type { BoardIframeService } from '../boardAdvancedSettings.types';
import { newLocalId } from '../boardAdvancedSettings.defaults';

export function IframeServicesSection({
  services,
  onChange,
}: {
  services: BoardIframeService[];
  onChange: (next: BoardIframeService[]) => void;
}) {
  const update = (id: string, patch: Partial<BoardIframeService>) => {
    onChange(services.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const remove = (id: string) => {
    onChange(services.filter((s) => s.id !== id));
  };

  const add = () => {
    onChange([
      ...services,
      {
        id: newLocalId(),
        name: '',
        url: '',
        extraFields: [],
      },
    ]);
  };

  const updateExtra = (
    serviceId: string,
    idx: number,
    patch: Partial<{ key: string; value: string }>,
  ) => {
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;
    const fields = [...(s.extraFields ?? [])];
    fields[idx] = { ...fields[idx], ...patch };
    update(serviceId, { extraFields: fields });
  };

  const addExtraRow = (serviceId: string) => {
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;
    update(serviceId, { extraFields: [...(s.extraFields ?? []), { key: '', value: '' }] });
  };

  const removeExtraRow = (serviceId: string, idx: number) => {
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;
    const fields = [...(s.extraFields ?? [])];
    fields.splice(idx, 1);
    update(serviceId, { extraFields: fields });
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Подключение сервисов</h3>
        <p className="mt-1 text-xs text-slate-500">
          Встраивание через iframe: задайте название, URL и при необходимости дополнительные параметры (например,
          высота, разрешённые домены).
        </p>
      </div>

      {services.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
          Сервисов пока нет
        </p>
      ) : (
        <div className="space-y-4">
          {services.map((svc) => (
            <div key={svc.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">iframe</span>
                <button
                  type="button"
                  onClick={() => remove(svc.id)}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Удалить сервис"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Название</label>
                  <input
                    value={svc.name}
                    onChange={(e) => update(svc.id, { name: e.target.value })}
                    placeholder="Например: Контур"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Ссылка (URL iframe)</label>
                  <input
                    value={svc.url}
                    onChange={(e) => update(svc.id, { url: e.target.value })}
                    placeholder="https://…"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Дополнительные настройки</span>
                  <button
                    type="button"
                    onClick={() => addExtraRow(svc.id)}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    + Параметр
                  </button>
                </div>
                {(svc.extraFields ?? []).length === 0 ? (
                  <p className="text-[11px] text-slate-400">Нет параметров</p>
                ) : (
                  <div className="space-y-2">
                    {(svc.extraFields ?? []).map((row, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <input
                          value={row.key}
                          onChange={(e) => updateExtra(svc.id, idx, { key: e.target.value })}
                          placeholder="Ключ"
                          className="min-w-[100px] flex-1 rounded border border-slate-200 px-2 py-1.5 text-xs"
                        />
                        <input
                          value={row.value}
                          onChange={(e) => updateExtra(svc.id, idx, { value: e.target.value })}
                          placeholder="Значение"
                          className="min-w-[120px] flex-[2] rounded border border-slate-200 px-2 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => removeExtraRow(svc.id, idx)}
                          className="rounded p-1 text-slate-400 hover:text-red-600"
                          aria-label="Удалить параметр"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <Plus className="size-3.5" />
        Добавить iframe-сервис
      </button>
    </section>
  );
}
