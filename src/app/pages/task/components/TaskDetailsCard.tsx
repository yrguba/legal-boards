import { Calendar, Clock, Paperclip, Tag, User } from 'lucide-react';
import { t } from '../taskPage.classes';
import type { TaskMainColumnProps } from '../types';
import { filePublicUrl } from '../utils/documentPaths';
import { TaskElapsedTimeDisplay } from '../../../components/TaskElapsedTimeDisplay';

export function TaskDetailsCard(p: TaskMainColumnProps) {
  const {
    task,
    board,
    users,
    taskFields,
    titleFieldId,
    descriptionFieldId,
    taskType,
    assignee,
    isEditing,
    editTitle,
    editDescription,
    editColumnId,
    editTypeId,
    editAssigneeId,
    editCustomFields,
    saveError,
    taskAttachments,
    apiBaseUrl,
    uploadingFile,
    uploadError,
    isDraggingFile,
    attachmentsEnabled,
    onEditTitle,
    onEditDescription,
    onEditColumnId,
    onEditTypeId,
    onEditAssigneeId,
    onEditCustomField,
    onDropFiles,
    onUploadInputChange,
    onDragState,
    onRemoveAttachment,
    onPreviewDoc,
    renderFieldValue,
    formatDate,
    boardTimeTrackingEnabled,
  } = p;

  return (
    <div className={`${t.card} p-6 mb-6`}>
      {saveError ? <div className={`mb-4 ${t.errBanner}`}>{saveError}</div> : null}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
            <Tag className="w-4 h-4" />
            Тип задачи
          </div>
          {isEditing ? (
            <select
              value={editTypeId}
              onChange={(e) => onEditTypeId(e.target.value)}
              className={t.input}
            >
              <option value="" disabled>
                Выберите тип
              </option>
              {board.taskTypes.map((ty) => (
                <option key={ty.id} value={ty.id}>
                  {ty.name}
                </option>
              ))}
            </select>
          ) : (
            <span
              className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium text-white"
              style={{ backgroundColor: taskType?.color }}
            >
              {taskType?.name || '—'}
            </span>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
            <User className="w-4 h-4" />
            Исполнитель
          </div>
          {isEditing ? (
            <select
              value={editAssigneeId}
              onChange={(e) => onEditAssigneeId(e.target.value)}
              className={t.input}
            >
              <option value="">Не назначено</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          ) : assignee ? (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-brand-light flex items-center justify-center">
                <span className="text-xs font-medium text-brand">{assignee.name.charAt(0)}</span>
              </div>
              <span className="text-sm text-slate-900">{assignee.name}</span>
            </div>
          ) : (
            <span className="text-sm text-slate-500">Не назначено</span>
          )}
        </div>

        <div>
          <div className="text-sm text-slate-600 mb-1">Статус</div>
          {isEditing ? (
            <select value={editColumnId} onChange={(e) => onEditColumnId(e.target.value)} className={t.input}>
              <option value="" disabled>
                Выберите статус
              </option>
              {board.columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-slate-900">{p.column?.name || '—'}</span>
          )}
        </div>

        {boardTimeTrackingEnabled &&
        ((task.trackedTimeSeconds ?? 0) > 0 || task.timeTrackingActiveSince) ? (
          <div className="col-span-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
              <Clock className="w-4 h-4" />
              Затраченное время
            </div>
            <TaskElapsedTimeDisplay
              trackedSeconds={task.trackedTimeSeconds ?? 0}
              activeSinceIso={task.timeTrackingActiveSince}
            />
          </div>
        ) : null}

        {taskFields
          .filter((f) => f.id !== titleFieldId && f.id !== descriptionFieldId)
          .map((f) => {
            const rawValue = task.customFields?.[f.id];
            const displayValue = f.type === 'date' ? formatDate(rawValue) : renderFieldValue(rawValue);

            if (!isEditing) {
              if (displayValue === '—') return null;
              return (
                <div key={f.id}>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                    {f.type === 'date' ? <Calendar className="w-4 h-4" /> : null}
                    {f.name}
                  </div>
                  <span className="text-sm text-slate-900">{displayValue}</span>
                </div>
              );
            }

            const val = editCustomFields[f.id];
            return (
              <div key={f.id}>
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                  {f.type === 'date' ? <Calendar className="w-4 h-4" /> : null}
                  {f.name}
                  {f.required ? <span className="text-red-500">*</span> : null}
                </div>

                {f.type === 'text' && (
                  <input
                    value={(val as string) ?? ''}
                    onChange={(e) => onEditCustomField(f.id, e.target.value)}
                    className={t.input}
                  />
                )}

                {f.type === 'textarea' && (
                  <textarea
                    rows={3}
                    value={(val as string) ?? ''}
                    onChange={(e) => onEditCustomField(f.id, e.target.value)}
                    className={t.textarea}
                  />
                )}

                {f.type === 'select' && (
                  <select
                    value={(val as string) ?? ''}
                    onChange={(e) => onEditCustomField(f.id, e.target.value)}
                    className={t.input}
                  >
                    {(f.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}

                {f.type === 'date' && (
                  <input
                    type="date"
                    value={(val as string) ?? ''}
                    onChange={(e) => onEditCustomField(f.id, e.target.value)}
                    className={t.input}
                  />
                )}
              </div>
            );
          })}
      </div>

      {isEditing ? (
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-medium text-slate-900 mb-2">Описание</h3>
          <textarea
            rows={5}
            value={editDescription}
            onChange={(e) => onEditDescription(e.target.value)}
            placeholder="Описание задачи"
            className={t.textarea}
          />
        </div>
      ) : task.description ? (
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-medium text-slate-900 mb-2">Описание</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.description}</p>
        </div>
      ) : null}

      {attachmentsEnabled && (
        <div className="border-t border-slate-200 pt-4 mt-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="text-sm font-medium text-slate-900">Вложения</h3>
            {uploadingFile ? <span className="text-xs text-slate-500">Загрузка…</span> : null}
          </div>

          {uploadError ? (
            <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {uploadError}
            </div>
          ) : null}

          <label
            className={`block rounded-lg border border-dashed px-4 py-4 cursor-pointer transition-colors ${
              isDraggingFile
                ? 'border-brand bg-brand-light'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50'
            } ${uploadingFile ? 'opacity-60 cursor-not-allowed' : ''}`}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!uploadingFile) onDragState(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!uploadingFile) onDragState(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDragState(false);
            }}
            onDrop={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              onDragState(false);
              if (uploadingFile) return;
              await onDropFiles(e.dataTransfer.files);
            }}
          >
            <input
              type="file"
              disabled={uploadingFile}
              className="hidden"
              onChange={async (e) => {
                const input = e.currentTarget;
                const { files } = e.target;
                try {
                  await onUploadInputChange(files);
                } finally {
                  if (input) input.value = '';
                }
              }}
            />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                <Paperclip className="w-4 h-4 text-slate-600" />
              </div>
              <div className="min-w-0">
                <div className="text-sm text-slate-900">Перетащите файл сюда или нажмите, чтобы выбрать</div>
                <div className="text-xs text-slate-500">Максимум 10MB</div>
              </div>
            </div>
          </label>

          {taskAttachments.length === 0 ? (
            <div className="mt-3 text-sm text-slate-500">Пока нет вложений</div>
          ) : (
            <div className="space-y-2 mt-3">
              {taskAttachments.map((att) => {
                const id = att.id as string;
                const name = (att.name as string) || id;
                const href = filePublicUrl(apiBaseUrl, att.path as string | undefined);
                const canPreview =
                  !!href &&
                  (String(att.type || '').startsWith('image/') || att.type === 'application/pdf');

                return (
                  <div key={id} className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-slate-700 truncate hover:text-brand"
                        >
                          {name}
                        </a>
                      ) : (
                        <span className="text-sm text-slate-700 truncate">{name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {canPreview && att ? (
                        <button
                          type="button"
                          onClick={() => onPreviewDoc({ ...att, href } as any)}
                          className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-white transition-colors"
                        >
                          Просмотр
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onRemoveAttachment(id)}
                        className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-white transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
