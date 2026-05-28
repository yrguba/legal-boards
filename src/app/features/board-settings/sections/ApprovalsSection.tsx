import { Plus, Trash2 } from 'lucide-react';
import type { BoardAdvancedSettings } from '../boardAdvancedSettings.types';
import { newLocalId } from '../boardAdvancedSettings.defaults';
import { LawyerPrioritySortable } from '../components/LawyerPrioritySortable';

type ColumnLite = { id: string; name: string };
type UserLite = { id: string; name: string };

export function ApprovalsSection({
  approvals,
  columns,
  users,
  onChange,
}: {
  approvals: NonNullable<BoardAdvancedSettings['approvals']>;
  columns: ColumnLite[];
  users: UserLite[];
  onChange: (next: NonNullable<BoardAdvancedSettings['approvals']>) => void;
}) {
  const rules = approvals.rules;

  const updateRule = (id: string, patch: Partial<(typeof rules)[0]>) => {
    onChange({
      ...approvals,
      rules: rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const removeRule = (id: string) => {
    onChange({ ...approvals, rules: rules.filter((r) => r.id !== id) });
  };

  const addRule = () => {
    const firstColumn = columns[0]?.id ?? '';
    const firstUser = users[0]?.id ?? '';
    onChange({
      ...approvals,
      rules: [
        ...rules,
        {
          id: newLocalId(),
          name: '',
          columnId: firstColumn,
          approverUserId: firstUser,
          substituteUserIds: [],
        },
      ],
    });
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Согласования</h3>
        <p className="mt-1 text-xs text-slate-500">
          Для выбранной колонки (статуса) можно задать одно или несколько правил согласования. Пока задача
          находится в этой колонке, все указанные согласования должны быть получены, прежде чем задачу можно
          будет перевести в другой статус. Согласовать может основной согласующий или любой из замещающих.
        </p>
      </div>

      <div className="space-y-3">
        {rules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">
            Правил согласования пока нет — добавьте правило для колонки, где требуется подтверждение.
          </p>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[160px] flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Название правила</label>
                  <input
                    type="text"
                    value={rule.name}
                    onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                    placeholder="Например: Согласование руководителя"
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="min-w-[140px] flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Колонка (статус)</label>
                  <select
                    value={rule.columnId}
                    onChange={(e) => updateRule(rule.id, { columnId: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    {columns.length === 0 ? (
                      <option value="">Нет колонок</option>
                    ) : (
                      columns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="min-w-[160px] flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Согласующий</label>
                  <select
                    value={rule.approverUserId}
                    onChange={(e) => updateRule(rule.id, { approverUserId: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    {users.length === 0 ? (
                      <option value="">Нет сотрудников</option>
                    ) : (
                      users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="mb-0.5 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  aria-label="Удалить правило"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="mt-3 rounded-lg border border-slate-100 bg-white p-3">
                <p className="mb-2 text-[11px] font-medium text-slate-600">Замещающие согласующие</p>
                <LawyerPrioritySortable
                  instanceId={`approval-rule-${rule.id}`}
                  orderedUserIds={rule.substituteUserIds.filter((id) => id !== rule.approverUserId)}
                  users={users.filter((u) => u.id !== rule.approverUserId)}
                  onReorder={(next) => updateRule(rule.id, { substituteUserIds: next })}
                  onRemove={(uid) =>
                    updateRule(rule.id, {
                      substituteUserIds: rule.substituteUserIds.filter((x) => x !== uid),
                    })
                  }
                  onAddUserId={(uid) => {
                    if (uid === rule.approverUserId || rule.substituteUserIds.includes(uid)) return;
                    updateRule(rule.id, { substituteUserIds: [...rule.substituteUserIds, uid] });
                  }}
                />
              </div>
            </div>
          ))
        )}

        <button
          type="button"
          onClick={addRule}
          disabled={columns.length === 0 || users.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          Добавить правило
        </button>
      </div>
    </section>
  );
}
