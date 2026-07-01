import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Board, TaskField, TaskType, User } from '../types';
import { DEFAULT_TASK_PRIORITY, TASK_PRIORITY_KEYS, TASK_PRIORITY_LABELS } from '../utils/taskPriority';
import { withoutLegacyPriorityFields } from '../utils/taskFieldFilters';
import { tasksApi } from '../services/api';
import { MarkdownBlockNote, MarkdownEditorRoot } from './markdown';
import { TaskCreateAttachments } from './TaskCreateAttachments';
import { Switch } from './ui/switch';

export type TaskCreatePayload = {
  title: string;
  description?: string;
  descriptionMarkdown?: boolean;
  typeId: string;
  assigneeId?: string;
  priority: string;
  customFields: Record<string, unknown>;
};

function isEmptyValue(v: unknown) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function fieldLabel(field: TaskField) {
  return `${field.name}${field.required ? ' *' : ''}`;
}

const inputClassName =
  'w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-inset';

export function useTaskCreateForm(board: Board | null, options?: { defaultTypeId?: string }) {
  const defaultTypeId = options?.defaultTypeId;
  const [typeId, setTypeId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState(DEFAULT_TASK_PRIORITY);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [descriptionMarkdown, setDescriptionMarkdown] = useState(false);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const taskTypes: TaskType[] = useMemo(() => board?.taskTypes || [], [board?.taskTypes]);
  const taskFields: TaskField[] = useMemo(
    () =>
      withoutLegacyPriorityFields([...(board?.taskFields || [])]).sort(
        (a, b) => a.position - b.position,
      ),
    [board?.taskFields],
  );

  const titleField = useMemo(() => {
    const byName = taskFields.find((f) => f.type === 'text' && f.name.trim().toLowerCase() === 'название');
    if (byName) return byName;
    const requiredText = taskFields.find((f) => f.type === 'text' && f.required);
    if (requiredText) return requiredText;
    return taskFields.find((f) => f.type === 'text') || null;
  }, [taskFields]);

  const descriptionField = useMemo(() => {
    const byName = taskFields.find(
      (f) =>
        (f.type === 'textarea' || f.type === 'text') && f.name.trim().toLowerCase() === 'описание',
    );
    return byName || null;
  }, [taskFields]);

  const reset = useCallback(() => {
    const types = board?.taskTypes ?? [];
    const preferredTypeId =
      defaultTypeId && types.some((t) => t.id === defaultTypeId)
        ? defaultTypeId
        : types[0]?.id || '';
    setTypeId(preferredTypeId);
    setAssigneeId('');
    setPriority(DEFAULT_TASK_PRIORITY);
    setCustomFields({});
    setDescriptionMarkdown(false);
    setEditorResetKey((k) => k + 1);
    setPendingFiles([]);
  }, [board?.taskTypes, defaultTypeId]);

  const addPendingFiles = useCallback((fileList: FileList | File[] | null | undefined) => {
    if (!fileList?.length) return;
    setPendingFiles((prev) => [...prev, ...Array.from(fileList)]);
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    reset();
  }, [board?.id, defaultTypeId, reset]);

  const validate = useCallback((): string | null => {
    if (!board) return 'Выберите доску';
    if (!typeId) return 'Выберите тип задачи';
    if (!titleField) return 'В настройках доски нет текстового поля для названия задачи';

    for (const f of taskFields) {
      if (!f.required) continue;
      if (isEmptyValue(customFields[f.id])) return `Заполните поле: ${f.name}`;
    }

    return null;
  }, [board, typeId, titleField, taskFields, customFields]);

  const buildPayload = useCallback((): TaskCreatePayload => {
    if (!titleField) {
      throw new Error('В настройках доски нет текстового поля для названия задачи');
    }

    const rawTitle = customFields[titleField.id];
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : String(rawTitle ?? '').trim();
    if (!title) throw new Error(`Заполните поле: ${titleField.name}`);

    const rawDescription = descriptionField ? customFields[descriptionField.id] : undefined;
    const description =
      typeof rawDescription === 'string'
        ? rawDescription.trim()
        : rawDescription !== undefined
          ? String(rawDescription)
          : '';

    const { [titleField.id]: _t, ...restAfterTitle } = customFields;
    const { [descriptionField?.id || '']: _d, ...restAfterDescription } = restAfterTitle;

    return {
      title,
      description: description || undefined,
      descriptionMarkdown: descriptionMarkdown || undefined,
      typeId,
      assigneeId: assigneeId || undefined,
      priority,
      customFields: restAfterDescription,
    };
  }, [assigneeId, customFields, descriptionField, descriptionMarkdown, priority, titleField, typeId]);

  const canSubmit = Boolean(board && typeId && titleField && (board.taskTypes?.length ?? 0) > 0);

  return {
    typeId,
    setTypeId,
    assigneeId,
    setAssigneeId,
    priority,
    setPriority,
    customFields,
    setCustomFields,
    descriptionMarkdown,
    setDescriptionMarkdown,
    taskTypes,
    taskFields,
    titleField,
    descriptionField,
    editorResetKey,
    reset,
    validate,
    buildPayload,
    canSubmit,
    pendingFiles,
    addPendingFiles,
    removePendingFile,
  };
}

export type TaskCreateFormState = ReturnType<typeof useTaskCreateForm>;

export async function uploadPendingTaskAttachments(taskId: string, files: File[]) {
  for (const file of files) {
    await tasksApi.uploadAttachment(taskId, file);
  }
}

export function TaskCreateFormFields({
  form,
  users,
  authorName,
  board,
  hideAuthor = false,
  hideAssignee = false,
  hideTypeSelector = false,
}: {
  form: TaskCreateFormState;
  users: User[];
  authorName?: string;
  board: Board | null;
  hideAuthor?: boolean;
  hideAssignee?: boolean;
  hideTypeSelector?: boolean;
}) {
  const {
    typeId,
    setTypeId,
    assigneeId,
    setAssigneeId,
    priority,
    setPriority,
    customFields,
    setCustomFields,
    descriptionMarkdown,
    setDescriptionMarkdown,
    taskTypes,
    taskFields,
    descriptionField,
    editorResetKey,
    pendingFiles,
    addPendingFiles,
    removePendingFile,
  } = form;

  const attachmentsEnabled = board?.attachmentsEnabled !== false;

  return (
    <MarkdownEditorRoot>
      <>
      {!hideTypeSelector ? (
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Тип *</label>
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputClassName}>
          <option value="" disabled>
            Выберите тип
          </option>
          {taskTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      ) : null}

      {!hideAuthor ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Автор</label>
          <input
            readOnly
            value={authorName ?? '—'}
            className="w-full cursor-default rounded border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-inset"
          />
        </div>
      ) : null}

      {!hideAssignee ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Исполнитель</label>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputClassName}>
            <option value="">Не назначено</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Приоритет</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClassName}>
          {TASK_PRIORITY_KEYS.map((p) => (
            <option key={p} value={p}>
              {TASK_PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      {taskFields.length > 0 ? (
        <div className="w-full">
          <div className="flex w-full flex-col gap-4">
            {taskFields.map((f) => {
              const isDescription = descriptionField?.id === f.id;

              return (
              <div key={f.id} className="w-full space-y-1">
                <label className="block text-sm font-medium text-slate-700">{fieldLabel(f)}</label>

                {f.type === 'text' && !isDescription ? (
                  <input
                    value={String(customFields[f.id] ?? '')}
                    onChange={(e) => setCustomFields((p) => ({ ...p, [f.id]: e.target.value }))}
                    className={inputClassName}
                  />
                ) : null}

                {isDescription ? (
                  <div className="overflow-visible rounded border border-slate-300 bg-white">
                    <div className="flex items-center justify-end gap-2 border-b border-slate-200 px-3 py-2">
                      <span className="text-xs text-slate-500">Форматирование</span>
                      <Switch
                        checked={descriptionMarkdown}
                        onCheckedChange={setDescriptionMarkdown}
                      />
                    </div>
                    {descriptionMarkdown ? (
                      <MarkdownBlockNote
                        instanceKey={`task-create-desc-${f.id}-${editorResetKey}`}
                        markdown={String(customFields[f.id] ?? '')}
                        onMarkdownChange={(md) => setCustomFields((p) => ({ ...p, [f.id]: md }))}
                        compact
                      />
                    ) : (
                      <textarea
                        rows={4}
                        value={String(customFields[f.id] ?? '')}
                        onChange={(e) => setCustomFields((p) => ({ ...p, [f.id]: e.target.value }))}
                        className="min-h-[96px] w-full resize-y border-0 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                        placeholder="Описание.."
                      />
                    )}
                  </div>
                ) : null}

                {f.type === 'textarea' && !isDescription ? (
                  <textarea
                    rows={3}
                    value={String(customFields[f.id] ?? '')}
                    onChange={(e) => setCustomFields((p) => ({ ...p, [f.id]: e.target.value }))}
                    className={inputClassName}
                  />
                ) : null}

                {f.type === 'select' ? (
                  <select
                    value={String(customFields[f.id] ?? '')}
                    onChange={(e) => setCustomFields((p) => ({ ...p, [f.id]: e.target.value }))}
                    className={inputClassName}
                  >
                    {(f.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : null}

                {f.type === 'date' ? (
                  <input
                    type="date"
                    value={String(customFields[f.id] ?? '')}
                    onChange={(e) => setCustomFields((p) => ({ ...p, [f.id]: e.target.value }))}
                    className={inputClassName}
                  />
                ) : null}
              </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {attachmentsEnabled ? (
        <TaskCreateAttachments
          files={pendingFiles}
          onAdd={addPendingFiles}
          onRemove={removePendingFile}
        />
      ) : null}
      </>
    </MarkdownEditorRoot>
  );
}
