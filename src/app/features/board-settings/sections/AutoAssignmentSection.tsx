import { Plus, Trash2 } from 'lucide-react';
import type { AutoAssignTargetKind, BoardAdvancedSettings } from '../boardAdvancedSettings.types';
import { newLocalId } from '../boardAdvancedSettings.defaults';
import { LawyerPrioritySortable } from '../components/LawyerPrioritySortable';

type TaskTypeLite = { id: string; name: string };
type DeptLite = { id: string; name: string };
type GroupLite = { id: string; name: string };
type UserLite = { id: string; name: string };

export function AutoAssignmentSection({
  autoAssignment,
  taskTypes,
  departments,
  groups,
  users,
  onChange,
}: {
  autoAssignment: NonNullable<BoardAdvancedSettings['autoAssignment']>;
  taskTypes: TaskTypeLite[];
  departments: DeptLite[];
  groups: GroupLite[];
  users: UserLite[];
  onChange: (next: NonNullable<BoardAdvancedSettings['autoAssignment']>) => void;
}) {
  const rules = autoAssignment.rules;

  const updateRule = (id: string, patch: Partial<(typeof rules)[0]>) => {
    onChange({
      ...autoAssignment,
      rules: rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const removeRule = (id: string) => {
    onChange({ ...autoAssignment, rules: rules.filter((r) => r.id !== id) });
  };

  const addRule = () => {
    const firstType = taskTypes[0]?.id ?? '';
    const firstDept = departments[0]?.id ?? '';
    onChange({
      ...autoAssignment,
      rules: [
        ...rules,
        {
          id: newLocalId(),
          taskTypeId: firstType,
          targetKind: 'department' as AutoAssignTargetKind,
          targetId: firstDept || groups[0]?.id || users[0]?.id || '',
          assignmentMode: 'on_load',
          priorityUserIds: [],
        },
      ],
    });
  };

  const targetOptions = (kind: AutoAssignTargetKind) => {
    if (kind === 'department') return departments;
    if (kind === 'group') return groups;
    return users;
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Автоматическое назначение</h3>
        <p className="mt-1 text-xs text-slate-500">
          Для каждого типа задачи задайте отдел, группу или конкретного юриста и режим назначения. Добавляйте строки
          кнопкой «+».
        </p>
      </div>

      <div className="space-y-3">
        {rules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">
            Правил пока нет — при необходимости добавьте соответствие «тип задачи → получатель».
          </p>
        ) : (
          rules.map((rule) => {
            const opts = targetOptions(rule.targetKind);
            const modeGroup = `auto-assign-mode-${rule.id}`;
            return (
              <div key={rule.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[140px] flex-1">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Тип задачи</label>
                    <select
                      value={rule.taskTypeId}
                      onChange={(e) => updateRule(rule.id, { taskTypeId: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    >
                      {taskTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-[120px]">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Куда назначать</label>
                    <select
                      value={rule.targetKind}
                      onChange={(e) => {
                        const kind = e.target.value as AutoAssignTargetKind;
                        const nextOpts = targetOptions(kind);
                        updateRule(rule.id, {
                          targetKind: kind,
                          targetId: nextOpts[0]?.id ?? '',
                        });
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    >
                      <option value="department">Отдел</option>
                      <option value="group">Группа</option>
                      <option value="user">Юрист</option>
                    </select>
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      {rule.targetKind === 'department'
                        ? 'Отдел'
                        : rule.targetKind === 'group'
                          ? 'Группа'
                          : 'Юрист'}
                    </label>
                    <select
                      value={rule.targetId}
                      onChange={(e) => updateRule(rule.id, { targetId: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    >
                      {opts.length === 0 ? (
                        <option value="">Нет доступных записей</option>
                      ) : (
                        opts.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
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

                <div className="mt-3 border-t border-slate-200/80 pt-3">
                  <p className="mb-2 text-[11px] font-medium text-slate-600">Режим назначения</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-1 py-0.5 hover:bg-white/60">
                      <input
                        type="radio"
                        name={modeGroup}
                        checked={rule.assignmentMode === 'on_load'}
                        onChange={() => updateRule(rule.id, { assignmentMode: 'on_load' })}
                        className="mt-0.5 border-slate-300"
                      />
                      <span>
                        <span className="text-sm font-medium text-slate-800">
                          Назначать автоматически при загрузке
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Логика автоназначения может применяться при появлении задачи на доске (реализацию выполняет
                          бэкенд по этим правилам).
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-1 py-0.5 hover:bg-white/60">
                      <input
                        type="radio"
                        name={modeGroup}
                        checked={rule.assignmentMode === 'by_priority'}
                        onChange={() => updateRule(rule.id, { assignmentMode: 'by_priority' })}
                        className="mt-0.5 border-slate-300"
                      />
                      <span>
                        <span className="text-sm font-medium text-slate-800">Назначать по приоритету</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Очередь юристов задаётся ниже; порядок сверху вниз — от высшего приоритета к низшему.
                        </span>
                      </span>
                    </label>
                  </div>

                  {rule.assignmentMode === 'by_priority' ? (
                    <div className="mt-3 rounded-lg border border-slate-100 bg-white p-3">
                      <LawyerPrioritySortable
                        instanceId={`auto-assign-rule-${rule.id}`}
                        orderedUserIds={rule.priorityUserIds}
                        users={users}
                        onReorder={(next) => updateRule(rule.id, { priorityUserIds: next })}
                        onRemove={(uid) =>
                          updateRule(rule.id, {
                            priorityUserIds: rule.priorityUserIds.filter((x) => x !== uid),
                          })
                        }
                        onAddUserId={(uid) =>
                          updateRule(rule.id, {
                            priorityUserIds: [...rule.priorityUserIds, uid],
                          })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}

        <button
          type="button"
          onClick={addRule}
          disabled={taskTypes.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          Добавить правило
        </button>
      </div>
    </section>
  );
}
