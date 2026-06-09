import { Calendar, Clock, Paperclip, Tag, User } from 'lucide-react';
import { t } from '../taskPage.classes';
import type { TaskMainColumnProps } from '../types';
import type { TaskField } from '../../../types';
import { filePublicUrl } from '../utils/documentPaths';
import { TaskElapsedTimeDisplay } from '../../../components/TaskElapsedTimeDisplay';
import { TaskApprovalsSection } from './TaskApprovalsSection';
import { InlineEditField } from '../../../components/inline-edit/InlineEditField';
import type { InlineFieldKey } from '../utils/validateField';

function fieldError(
  errors: TaskMainColumnProps['fieldErrors'],
  key: InlineFieldKey,
): string | null {
  return errors[key] ?? null;
}

function CustomFieldInline({
  field,
  task,
  savingField,
  fieldErrors,
  isFieldLocked,
  onSaveField,
  renderFieldValue,
  formatDate,
}: {
  field: TaskField;
  task: TaskMainColumnProps['task'];
  savingField: TaskMainColumnProps['savingField'];
  fieldErrors: TaskMainColumnProps['fieldErrors'];
  isFieldLocked: TaskMainColumnProps['isFieldLocked'];
  onSaveField: TaskMainColumnProps['onSaveField'];
  renderFieldValue: TaskMainColumnProps['renderFieldValue'];
  formatDate: TaskMainColumnProps['formatDate'];
}) {
  const key = `custom:${field.id}` as InlineFieldKey;
  const rawValue = task.customFields?.[field.id];

  const label = (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      {field.type === 'date' ? <Calendar className="w-4 h-4" /> : null}
      {field.name}
      {field.required ? <span className="text-red-500">*</span> : null}
    </div>
  );

  return (
    <InlineEditField
      fieldKey={key}
      label={label}
      layout="full"
      saving={savingField === key}
      locked={isFieldLocked(key)}
      error={fieldError(fieldErrors, key)}
      placeholder="Не заполнено"
      getValue={() => rawValue ?? ''}
      isEmpty={(v) => renderFieldValue(v) === '—'}
      onSave={(v) => onSaveField(key, v)}
      renderView={(v) => (
        <span className="text-sm text-slate-900">
          {field.type === 'date' ? formatDate(v) : renderFieldValue(v)}
        </span>
      )}
      renderEditor={({ value, onChange, onCommit, saving, inputRef }) => {
        if (field.type === 'textarea') {
          return (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              rows={3}
              value={String(value ?? '')}
              disabled={saving}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) void onCommit();
              }}
              className={t.textarea}
            />
          );
        }
        if (field.type === 'select') {
          return (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={String(value ?? '')}
              disabled={saving}
              onChange={(e) => onChange(e.target.value)}
              className={t.input}
            >
              <option value="">—</option>
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          );
        }
        if (field.type === 'date') {
          return (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="date"
              value={String(value ?? '')}
              disabled={saving}
              onChange={(e) => onChange(e.target.value)}
              className={t.input}
            />
          );
        }
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={String(value ?? '')}
            disabled={saving}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void onCommit();
              }
            }}
            className={t.input}
          />
        );
      }}
    />
  );
}

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
    savingField,
    fieldErrors,
    isFieldLocked,
    onSaveField,
    taskAttachments,
    apiBaseUrl,
    uploadingFile,
    uploadError,
    isDraggingFile,
    attachmentsEnabled,
    onDropFiles,
    onUploadInputChange,
    onDragState,
    onRemoveAttachment,
    onPreviewDoc,
    renderFieldValue,
    formatDate,
    boardTimeTrackingEnabled,
    approvalRules,
    columnApprovals,
    currentUserId,
    approvingRuleId,
    approvalError,
    onApproveRule,
    onRejectRule,
  } = p;

  return (
    <div className={`${t.card} p-6 mb-6`}>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <InlineEditField
          fieldKey="typeId"
          label={
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Tag className="w-4 h-4" />
              Тип задачи
            </div>
          }
          layout="full"
          saving={savingField === 'typeId'}
          locked={isFieldLocked('typeId')}
          error={fieldError(fieldErrors, 'typeId')}
          getValue={() => task.typeId}
          onSave={(v) => onSaveField('typeId', v)}
          commitOnChange
          renderView={() => (
            <span
              className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium text-white"
              style={{ backgroundColor: taskType?.color }}
            >
              {taskType?.name || '—'}
            </span>
          )}
          renderEditor={({ value, onChange, saving, inputRef }) => (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={String(value)}
              disabled={saving}
              onChange={(e) => onChange(e.target.value)}
              className={t.input}
            >
              {board.taskTypes.map((ty) => (
                <option key={ty.id} value={ty.id}>
                  {ty.name}
                </option>
              ))}
            </select>
          )}
        />

        <InlineEditField
          fieldKey="assigneeId"
          label={
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <User className="w-4 h-4" />
              Исполнитель
            </div>
          }
          layout="full"
          saving={savingField === 'assigneeId'}
          locked={isFieldLocked('assigneeId')}
          error={fieldError(fieldErrors, 'assigneeId')}
          placeholder="Не назначено"
          getValue={() => task.assigneeId || ''}
          isEmpty={(v) => !v}
          onSave={(v) => onSaveField('assigneeId', v)}
          commitOnChange
          renderView={() =>
            assignee ? (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-light flex items-center justify-center">
                  <span className="text-xs font-medium text-brand">{assignee.name.charAt(0)}</span>
                </div>
                <span className="text-sm text-slate-900">{assignee.name}</span>
              </div>
            ) : (
              <span className="text-sm text-slate-500">Не назначено</span>
            )
          }
          renderEditor={({ value, onChange, saving, inputRef }) => (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={String(value)}
              disabled={saving}
              onChange={(e) => onChange(e.target.value)}
              className={t.input}
            >
              <option value="">Не назначено</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        />

        <InlineEditField
          fieldKey="columnId"
          label={<div className="text-sm text-slate-600">Статус</div>}
          layout="full"
          saving={savingField === 'columnId'}
          locked={isFieldLocked('columnId')}
          error={fieldError(fieldErrors, 'columnId')}
          getValue={() => task.columnId}
          onSave={(v) => onSaveField('columnId', v)}
          commitOnChange
          renderView={() => (
            <span className="text-sm text-slate-900">{p.column?.name || '—'}</span>
          )}
          renderEditor={({ value, onChange, saving, inputRef }) => (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={String(value)}
              disabled={saving}
              onChange={(e) => onChange(e.target.value)}
              className={t.input}
            >
              {board.columns.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === task.columnId}>
                  {c.name}
                  {c.id === task.columnId ? ' (текущий)' : ''}
                </option>
              ))}
            </select>
          )}
        />

        <TaskApprovalsSection
          columnId={task.columnId}
          rules={approvalRules}
          approvals={columnApprovals}
          currentUserId={currentUserId}
          processingRuleId={approvingRuleId}
          approvalError={approvalError}
          onApprove={onApproveRule}
          onReject={onRejectRule}
        />

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
          .map((f) => (
            <CustomFieldInline
              key={f.id}
              field={f}
              task={task}
              savingField={savingField}
              fieldErrors={fieldErrors}
              isFieldLocked={isFieldLocked}
              onSaveField={onSaveField}
              renderFieldValue={renderFieldValue}
              formatDate={formatDate}
            />
          ))}
      </div>

      <InlineEditField
        fieldKey="description"
        label={<h3 className="text-sm font-medium text-slate-900">Описание</h3>}
        layout="full"
        className="border-t border-slate-200 pt-4"
        saving={savingField === 'description'}
        locked={isFieldLocked('description')}
        error={fieldError(fieldErrors, 'description')}
        placeholder="Добавить описание…"
        getValue={() => task.description || ''}
        isEmpty={(v) => !String(v).trim()}
        onSave={(v) => onSaveField('description', v)}
        renderView={(v) => (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{String(v)}</p>
        )}
        renderEditor={({ value, onChange, onCommit, saving, inputRef }) => (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            rows={5}
            value={String(value)}
            disabled={saving}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) void onCommit();
            }}
            placeholder="Описание задачи"
            className={t.textarea}
          />
        )}
      />

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
                <div className="text-sm text-slate-900">
                  Перетащите файл сюда или нажмите, чтобы выбрать
                </div>
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
