import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { TaskField } from '../../../types';
import { boardsApi } from '../../../services/api';
import type {
  BoardAdvancedSettings,
  BoardColumnActionRule,
  ColumnActionCheckItem,
  ColumnActionKind,
  ColumnActionTrigger,
} from '../boardAdvancedSettings.types';
import { newLocalId } from '../boardAdvancedSettings.defaults';
import { FORMS_DEFAULT_EMBEDDED_PATH } from '../../../qiankun/formsMicroAppPaths';
import { FORMS_MICROAPP_ENABLED } from '../../../qiankun/formsMicroAppFeature';

const SYSTEM_CHECK_OPTIONS: { value: ColumnActionCheckItem['type']; label: string }[] = [
  { value: 'assignee_set', label: 'Назначен исполнитель' },
  { value: 'attachment_present', label: 'Есть вложение' },
  { value: 'conclusion_set', label: 'Заполнено заключение' },
];

function checkLabel(
  check: ColumnActionCheckItem,
  taskFields: TaskField[],
): string {
  if (check.type === 'custom_field_set') {
    const field = taskFields.find((f) => f.id === check.fieldId);
    return field?.name ?? check.label ?? check.fieldId ?? 'Поле';
  }
  if (check.type === 'description_set') return 'Заполнено описание';
  return SYSTEM_CHECK_OPTIONS.find((o) => o.value === check.type)?.label ?? check.type;
}

export function ColumnActionsSection({
  columnActions,
  columns,
  taskFields,
  currentBoardId,
  workspaceId,
  onChange,
}: {
  columnActions: NonNullable<BoardAdvancedSettings['columnActions']>;
  columns: { id: string; name: string }[];
  taskFields: TaskField[];
  currentBoardId: string;
  workspaceId: string;
  onChange: (next: NonNullable<BoardAdvancedSettings['columnActions']>) => void;
}) {
  const rules = columnActions.rules;
  const [workspaceBoards, setWorkspaceBoards] = useState<
    { id: string; name: string; kind?: string; columns?: { id: string; name: string }[] }[]
  >([]);
  const [targetColumnsByBoard, setTargetColumnsByBoard] = useState<
    Record<string, { id: string; name: string }[]>
  >({});

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void boardsApi.getByWorkspace(workspaceId).then((rows) => {
      if (!cancelled) {
        setWorkspaceBoards(
          (rows as { id: string; name: string; kind?: string }[]).filter(
            (b) => b.id !== currentBoardId && b.kind !== 'aggregated',
          ),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, currentBoardId]);

  const loadTargetColumns = async (boardId: string) => {
    if (!boardId || targetColumnsByBoard[boardId]) return;
    const board = await boardsApi.getById(boardId);
    const cols = (board.columns ?? []).map((c: { id: string; name: string }) => ({
      id: c.id,
      name: c.name,
    }));
    setTargetColumnsByBoard((prev) => ({ ...prev, [boardId]: cols }));
  };
  useEffect(() => {
    for (const rule of rules) {
      if (rule.actionKind === 'forward_to_board' && rule.config.targetBoardId) {
        void loadTargetColumns(rule.config.targetBoardId);
      }
    }
  }, [rules]);

  const sortedTaskFields = useMemo(
    () => [...taskFields].sort((a, b) => a.position - b.position),
    [taskFields],
  );

  const updateRule = (id: string, patch: Partial<BoardColumnActionRule>) => {
    onChange({
      ...columnActions,
      rules: rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const updateConfig = (id: string, patch: Partial<BoardColumnActionRule['config']>) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    updateRule(id, { config: { ...rule.config, ...patch } });
  };

  const removeRule = (id: string) => {
    onChange({ ...columnActions, rules: rules.filter((r) => r.id !== id) });
  };

  const addRule = () => {
    onChange({
      ...columnActions,
      rules: [
        ...rules,
        {
          id: newLocalId(),
          name: '',
          columnId: columns[0]?.id ?? '',
          trigger: 'on_enter',
          blocking: true,
          actionKind: 'confirm',
          config: {
            message: '',
            requireCheckbox: false,
            checkboxLabel: '',
            fields: [],
            checks: [],
          },
        },
      ],
    });
  };

  const setActionKind = (id: string, actionKind: ColumnActionKind) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    const config = { ...rule.config };
    if (actionKind === 'form' && (config.fields?.length ?? 0) === 0) {
      config.fields = [{ key: 'comment', label: 'Комментарий', type: 'textarea', required: true }];
    }
    if (actionKind === 'check_task' && (config.checks?.length ?? 0) === 0) {
      config.checks = [{ type: 'assignee_set' }];
    }
    if (actionKind === 'forward_to_board') {
      config.targetBoardId = config.targetBoardId ?? workspaceBoards[0]?.id ?? '';
      config.targetColumnId = config.targetColumnId ?? '';
      config.skipIfAlreadyOnBoard = config.skipIfAlreadyOnBoard !== false;
      if (config.targetBoardId) void loadTargetColumns(config.targetBoardId);
    }
    if (actionKind === 'legal_forms') {
      config.formsPath =
        config.formsPath?.trim() ||
        `https://legal-forms.ru/expertises/v/436/expertise/18fb19e8-d0ce-4e6d-8e45-0a9d716b8998/flows/82KDS2T9/${encodeURIComponent('АМ')}/1907`;
      config.formsAccessTokenFieldId = config.formsAccessTokenFieldId ?? '';
    }
    updateRule(id, { actionKind, config });
  };

  const addFormField = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;
    const fields = [...(rule.config.fields ?? [])];
    fields.push({ key: `field_${fields.length + 1}`, label: 'Поле', type: 'text', required: true });
    updateConfig(ruleId, { fields });
  };

  const addCheck = (ruleId: string, type: ColumnActionCheckItem['type']) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;
    const checks = [...(rule.config.checks ?? [])];
    if (checks.some((c) => c.type === type)) return;
    checks.push({ type });
    updateConfig(ruleId, { checks });
  };

  const addFieldCheck = (ruleId: string, field: TaskField) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;
    const checks = [...(rule.config.checks ?? [])];
    if (checks.some((c) => c.type === 'custom_field_set' && c.fieldId === field.id)) return;
    checks.push({ type: 'custom_field_set', fieldId: field.id, label: field.name });
    updateConfig(ruleId, { checks });
  };

  const isFieldCheckAdded = (checks: ColumnActionCheckItem[], fieldId: string) =>
    checks.some((c) => c.type === 'custom_field_set' && c.fieldId === fieldId);

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Действия при смене статуса</h3>
        <p className="mt-1 text-xs text-slate-500">
          Обязательные действия при входе в колонку или выходе из неё: подтверждение, форма,
          проверка полей. Передача на другую доску предлагается после смены статуса и необязательна.
        </p>
      </div>

      <div className="space-y-3">
        {rules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">
            Правил пока нет — добавьте действие для нужной колонки.
          </p>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[140px] flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Название</label>
                  <input
                    value={rule.name}
                    onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="min-w-[120px]">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Колонка</label>
                  <select
                    value={rule.columnId}
                    onChange={(e) => updateRule(rule.id, { columnId: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[110px]">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Момент</label>
                  <select
                    value={rule.trigger}
                    onChange={(e) =>
                      updateRule(rule.id, { trigger: e.target.value as ColumnActionTrigger })
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value="on_enter">При входе</option>
                    <option value="on_exit">При выходе</option>
                  </select>
                </div>
                <div className="min-w-[130px]">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Тип</label>
                  <select
                    value={rule.actionKind}
                    onChange={(e) => setActionKind(rule.id, e.target.value as ColumnActionKind)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value="confirm">Подтверждение</option>
                    <option value="form">Форма</option>
                    <option value="check_task">Проверка задачи</option>
                    <option value="forward_to_board">Передать на доску</option>
                    {FORMS_MICROAPP_ENABLED ? (
                      <option value="legal_forms">Legal Forms (qiankun)</option>
                    ) : null}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="mb-0.5 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {rule.actionKind === 'confirm' ? (
                <div className="space-y-2 rounded-lg border border-slate-100 bg-white p-3">
                  <label className="block text-[11px] font-medium text-slate-600">Текст подтверждения</label>
                  <textarea
                    rows={3}
                    value={rule.config.message ?? ''}
                    onChange={(e) => updateConfig(rule.id, { message: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rule.config.requireCheckbox === true}
                      onChange={(e) => updateConfig(rule.id, { requireCheckbox: e.target.checked })}
                    />
                    Требовать отметку checkbox
                  </label>
                  {rule.config.requireCheckbox ? (
                    <input
                      value={rule.config.checkboxLabel ?? ''}
                      onChange={(e) => updateConfig(rule.id, { checkboxLabel: e.target.value })}
                      placeholder="Текст checkbox"
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    />
                  ) : null}
                </div>
              ) : null}

              {rule.actionKind === 'form' ? (
                <div className="space-y-2 rounded-lg border border-slate-100 bg-white p-3">
                  {(rule.config.fields ?? []).map((field, idx) => (
                    <div key={`${rule.id}-f-${idx}`} className="grid grid-cols-2 gap-2">
                      <input
                        value={field.key}
                        onChange={(e) => {
                          const fields = [...(rule.config.fields ?? [])];
                          fields[idx] = { ...fields[idx], key: e.target.value };
                          updateConfig(rule.id, { fields });
                        }}
                        placeholder="key"
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                      />
                      <input
                        value={field.label}
                        onChange={(e) => {
                          const fields = [...(rule.config.fields ?? [])];
                          fields[idx] = { ...fields[idx], label: e.target.value };
                          updateConfig(rule.id, { fields });
                        }}
                        placeholder="Подпись"
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addFormField(rule.id)}
                    className="text-xs text-brand hover:underline"
                  >
                    + Поле формы
                  </button>
                </div>
              ) : null}

              {rule.actionKind === 'forward_to_board' ? (
                <div className="space-y-2 rounded-lg border border-slate-100 bg-white p-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Целевая доска
                    </label>
                    <select
                      value={rule.config.targetBoardId ?? ''}
                      onChange={(e) => {
                        const targetBoardId = e.target.value;
                        const board = workspaceBoards.find((b) => b.id === targetBoardId);
                        updateConfig(rule.id, {
                          targetBoardId,
                          targetBoardName: board?.name ?? '',
                          targetColumnId: '',
                          targetColumnName: '',
                        });
                        if (targetBoardId) void loadTargetColumns(targetBoardId);
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    >
                      <option value="">Выберите доску…</option>
                      {workspaceBoards.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Колонка на целевой доске
                    </label>
                    <select
                      value={rule.config.targetColumnId ?? ''}
                      onChange={(e) => {
                        const targetColumnId = e.target.value;
                        const col = (targetColumnsByBoard[rule.config.targetBoardId ?? ''] ?? []).find(
                          (c) => c.id === targetColumnId,
                        );
                        updateConfig(rule.id, {
                          targetColumnId,
                          targetColumnName: col?.name ?? '',
                        });
                      }}
                      disabled={!rule.config.targetBoardId}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-50"
                    >
                      <option value="">Первая колонка (по умолчанию)</option>
                      {(targetColumnsByBoard[rule.config.targetBoardId ?? ''] ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rule.config.skipIfAlreadyOnBoard !== false}
                      onChange={(e) =>
                        updateConfig(rule.id, { skipIfAlreadyOnBoard: e.target.checked })
                      }
                    />
                    Не дублировать, если задача уже на целевой доске
                  </label>
                </div>
              ) : null}

              {rule.actionKind === 'legal_forms' ? (
                <div className="space-y-2 rounded-lg border border-slate-100 bg-white p-3">
                  <p className="text-[11px] text-slate-500">
                    Полный путь к форме LF — URL с legal-forms.ru или встроенный /forms/….
                    Хост для qiankun entry берётся из URL автоматически. Статично или {'{field:ID}'}.
                  </p>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Полный путь
                    </label>
                    <textarea
                      value={rule.config.formsPath ?? ''}
                      onChange={(e) => updateConfig(rule.id, { formsPath: e.target.value })}
                      placeholder={`https://legal-forms.ru/expertises/v/436/expertise/…/flows/…/АМ/1907\nили ${FORMS_DEFAULT_EMBEDDED_PATH}`}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      LF access_token — поле задачи (опционально)
                    </label>
                    <select
                      value={rule.config.formsAccessTokenFieldId ?? ''}
                      onChange={(e) =>
                        updateConfig(rule.id, { formsAccessTokenFieldId: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    >
                      <option value="">Из localStorage / URL (?access_token=)</option>
                      {sortedTaskFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-slate-600">Вставить поле задачи</p>
                    <div className="flex flex-wrap gap-1">
                      {sortedTaskFields.map((field) => (
                        <button
                          key={field.id}
                          type="button"
                          onClick={() =>
                            updateConfig(rule.id, {
                              formsPath: `{field:${field.id}}`,
                            })
                          }
                          className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50"
                        >
                          путь ← {field.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {rule.actionKind === 'check_task' ? (
                <div className="rounded-lg border border-slate-100 bg-white p-3 space-y-3">
                  <div>
                    <p className="mb-2 text-[11px] font-medium text-slate-600">Условия (все обязательны)</p>
                    {(rule.config.checks ?? []).length === 0 ? (
                      <p className="text-xs text-slate-500">Добавьте условия ниже.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(rule.config.checks ?? []).map((check, idx) => (
                          <span
                            key={`${rule.id}-c-${idx}`}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs"
                          >
                            {checkLabel(check, sortedTaskFields)}
                            <button
                              type="button"
                              onClick={() => {
                                const checks = (rule.config.checks ?? []).filter((_, i) => i !== idx);
                                updateConfig(rule.id, { checks });
                              }}
                              className="text-slate-400 hover:text-red-600"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-slate-600">Поля доски</p>
                    {sortedTaskFields.length === 0 ? (
                      <p className="text-xs text-slate-500">На доске нет настраиваемых полей.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {sortedTaskFields.map((field) => {
                          const added = isFieldCheckAdded(rule.config.checks ?? [], field.id);
                          return (
                            <button
                              key={field.id}
                              type="button"
                              disabled={added}
                              onClick={() => addFieldCheck(rule.id, field)}
                              className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              + {field.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-slate-600">Системные проверки</p>
                    <div className="flex flex-wrap gap-1">
                      {SYSTEM_CHECK_OPTIONS.map((opt) => {
                        const added = (rule.config.checks ?? []).some((c) => c.type === opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={added}
                            onClick={() => addCheck(rule.id, opt.value)}
                            className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            + {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}

        <button
          type="button"
          onClick={addRule}
          disabled={columns.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          Добавить правило
        </button>
      </div>
    </section>
  );
}
