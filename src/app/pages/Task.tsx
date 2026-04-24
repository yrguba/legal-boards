import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { boardsApi, documentsApi, tasksApi, usersApi } from '../services/api';
import type { Board as BoardType, Task as TaskType, User as UserType } from '../types';
import {
  ArrowLeft,
  MessageSquare,
  Bot,
  FileText,
  Paperclip,
  Send,
  Calendar,
  User,
  Tag,
} from 'lucide-react';

type PanelType = 'client' | 'assistant' | 'comments' | 'documents';

export function Task() {
  const { taskId } = useParams();
  const [task, setTask] = useState<any | null>(null);
  const [board, setBoard] = useState<BoardType | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColumnId, setEditColumnId] = useState('');
  const [editTypeId, setEditTypeId] = useState('');
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelType>('comments');
  const [message, setMessage] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  useEffect(() => {
    const id = taskId;
    if (!id) return;

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loadedTask = await tasksApi.getById(id);
        if (cancelled) return;
        setTask(loadedTask);

        const [loadedBoard, allUsers] = await Promise.all([
          boardsApi.getById(loadedTask.boardId),
          usersApi.getAll(),
        ]);
        if (cancelled) return;
        setBoard(loadedBoard);
        setUsers(allUsers);

        setIsEditing(false);
        setEditTitle(loadedTask.title || '');
        setEditDescription(loadedTask.description || '');
        setEditColumnId(loadedTask.columnId);
        setEditTypeId(loadedTask.typeId);
        setEditAssigneeId(loadedTask.assigneeId || '');
        setEditCustomFields(loadedTask.customFields || {});
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Не удалось загрузить задачу');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const apiBaseUrl = useMemo(() => {
    const apiUrl: string = import.meta.env.VITE_API_URL || 'http://localhost:5004/api';
    return apiUrl.replace(/\/api\/?$/, '');
  }, []);

  const documentsById = useMemo(() => {
    const map = new Map<string, any>();
    for (const d of documents) map.set(d.id, d);
    return map;
  }, [documents]);

  const attachmentIds: string[] = useMemo(() => {
    const arr = Array.isArray(task?.attachments) ? task.attachments : [];
    return arr.filter((x: any) => typeof x === 'string');
  }, [task?.attachments]);

  useEffect(() => {
    if (!board?.workspaceId) return;
    if (activePanel !== 'documents' && attachmentIds.length === 0) return;

    let cancelled = false;
    const loadDocs = async () => {
      setDocsLoading(true);
      setDocsError(null);
      try {
        const docs = await documentsApi.getByWorkspace(board.workspaceId, taskId ? { taskId } : undefined);
        if (!cancelled) setDocuments(docs);
      } catch (e: any) {
        if (!cancelled) setDocsError(e?.message || 'Не удалось загрузить документы');
      } finally {
        if (!cancelled) setDocsLoading(false);
      }
    };

    loadDocs();
    return () => {
      cancelled = true;
    };
  }, [activePanel, attachmentIds.length, board?.workspaceId, taskId]);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const taskType = task?.type || board?.taskTypes?.find((t) => t.id === task?.typeId);
  const assignee = task?.assignee || (task?.assigneeId ? usersById.get(task.assigneeId) : null);
  const creator = task?.creator || (task?.createdBy ? usersById.get(task.createdBy) : null);
  const column = board?.columns?.find((c) => c.id === task?.columnId);
  const taskFields = useMemo(
    () => [...(board?.taskFields || [])].sort((a, b) => a.position - b.position),
    [board?.taskFields]
  );

  const titleFieldId = useMemo(() => {
    const fields = taskFields;
    const byName = fields.find(
      (f: any) => f.type === 'text' && String(f.name || '').trim().toLowerCase() === 'название'
    );
    if (byName) return byName.id as string;
    const requiredText = fields.find((f: any) => f.type === 'text' && f.required);
    return (requiredText?.id as string) || '';
  }, [taskFields]);

  const descriptionFieldId = useMemo(() => {
    const fields = taskFields;
    const byName = fields.find(
      (f: any) =>
        (f.type === 'textarea' || f.type === 'text') &&
        String(f.name || '').trim().toLowerCase() === 'описание'
    );
    return (byName?.id as string) || '';
  }, [taskFields]);

  const handleSendMessage = () => {
    if (message.trim()) {
      console.log(`Sending ${activePanel} message:`, message);
      setMessage('');
    }
  };

  const postComment = async () => {
    if (!taskId) return;
    const content = commentText.trim();
    if (!content) return;
    setIsPostingComment(true);
    try {
      const created = await tasksApi.addComment(taskId, content);
      setTask((prev: any) => ({
        ...prev,
        comments: [created, ...(prev?.comments || [])],
      }));
      setCommentText('');
      setActivePanel('comments');
    } finally {
      setIsPostingComment(false);
    }
  };

  const attachDocumentToTask = async (docId: string) => {
    if (!taskId) return;
    const next = Array.from(new Set([...(attachmentIds || []), docId]));
    const updated = await tasksApi.update(taskId, { attachments: next });
    setTask((prev: any) => ({ ...prev, ...updated, attachments: updated?.attachments ?? next }));
  };

  const removeAttachmentFromTask = async (docId: string) => {
    if (!taskId) return;
    const next = (attachmentIds || []).filter((id) => id !== docId);
    const updated = await tasksApi.update(taskId, { attachments: next });
    setTask((prev: any) => ({ ...prev, ...updated, attachments: updated?.attachments ?? next }));
  };

  const handleUploadAttachment = async (file: File) => {
    if (!board?.workspaceId || !taskId) return;
    setUploadingFile(true);
    setUploadError(null);
    try {
      const doc = await documentsApi.upload(file, board.workspaceId, { type: 'task', taskId });
      setDocuments((prev) => [doc, ...prev]);
      await attachDocumentToTask(doc.id);
    } catch (e: any) {
      setUploadError(e?.message || 'Не удалось загрузить файл');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDropFiles = async (files: FileList | File[]) => {
    const file = Array.isArray(files) ? files[0] : files.item(0);
    if (!file) return;
    await handleUploadAttachment(file);
  };

  const renderCustomFieldValue = (value: any) => {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
  };

  const formatDate = (value: any) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('ru-RU');
  };

  const isEmptyValue = (v: unknown) => {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (Array.isArray(v)) return v.length === 0;
    return false;
  };

  const validateEdits = () => {
    if (!editTitle.trim()) return 'Введите название задачи';
    if (!editColumnId) return 'Выберите статус';
    if (!editTypeId) return 'Выберите тип задачи';

    for (const f of taskFields) {
      if (!f.required) continue;
      if (isEmptyValue(editCustomFields[f.id])) return `Заполните поле: ${f.name}`;
    }
    return null;
  };

  const cancelEditing = () => {
    if (!task) return;
    setSaveError(null);
    setIsEditing(false);
    setEditTitle(task.title || '');
    setEditDescription(task.description || '');
    setEditColumnId(task.columnId);
    setEditTypeId(task.typeId);
    setEditAssigneeId(task.assigneeId || '');
    setEditCustomFields(task.customFields || {});
  };

  const saveEdits = async () => {
    if (!taskId) return;
    setSaveError(null);

    const validationError = validateEdits();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const updated = await tasksApi.update(taskId, {
        columnId: editColumnId,
        typeId: editTypeId,
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        assigneeId: editAssigneeId || null,
        customFields: editCustomFields,
      });
      setTask((prev: any) => ({ ...prev, ...updated }));
      setIsEditing(false);
    } catch (e: any) {
      setSaveError(e?.message || 'Не удалось сохранить изменения');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <div className="text-sm text-slate-600">Загрузка задачи…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Задача не найдена</h2>
        </div>
      </div>
    );
  }

  if (!task || !board) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Задача не найдена</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <Link
          to={`/board/${(board as any).code || board.id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к доске
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-base font-semibold focus:outline-none focus:ring-2 focus:ring-brand"
              />
            ) : (
              <h1 className="text-xl font-semibold text-slate-900">{task.title}</h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => {
                  setSaveError(null);
                  setIsEditing(true);
                }}
                className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded transition-colors"
              >
                Редактировать
              </button>
            ) : (
              <>
                <button
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Отмена
                </button>
                <button
                  onClick={saveEdits}
                  disabled={isSaving}
                  className="px-3 py-2 text-sm bg-brand text-white rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Сохранить
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl">
            <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
              {saveError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {saveError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                    <Tag className="w-4 h-4" />
                    Тип задачи
                  </div>
                  {isEditing ? (
                    <select
                      value={editTypeId}
                      onChange={(e) => setEditTypeId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value="" disabled>
                        Выберите тип
                      </option>
                      {board.taskTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
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
                      onChange={(e) => setEditAssigneeId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
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
                        <span className="text-xs font-medium text-brand">
                          {assignee.name.charAt(0)}
                        </span>
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
                    <select
                      value={editColumnId}
                      onChange={(e) => setEditColumnId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    >
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
                    <span className="text-sm text-slate-900">{column?.name || '—'}</span>
                  )}
                </div>

                {taskFields
                  .filter((f) => f.id !== titleFieldId && f.id !== descriptionFieldId)
                  .map((f) => {
                  const rawValue = task.customFields?.[f.id];
                  const displayValue =
                    f.type === 'date' ? formatDate(rawValue) : renderCustomFieldValue(rawValue);

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
                          value={val ?? ''}
                          onChange={(e) =>
                            setEditCustomFields((p) => ({ ...p, [f.id]: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      )}

                      {f.type === 'textarea' && (
                        <textarea
                          rows={3}
                          value={val ?? ''}
                          onChange={(e) =>
                            setEditCustomFields((p) => ({ ...p, [f.id]: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      )}

                      {f.type === 'select' && (
                        <select
                          value={val ?? ''}
                          onChange={(e) => {
                            setEditCustomFields((p) => ({ ...p, [f.id]: e.target.value }));
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
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
                          value={val ?? ''}
                          onChange={(e) =>
                            setEditCustomFields((p) => ({ ...p, [f.id]: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
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
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Описание задачи"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              ) : task.description ? (
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-medium text-slate-900 mb-2">Описание</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.description}</p>
                </div>
              ) : null}

              {board.attachmentsEnabled !== false && (
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="text-sm font-medium text-slate-900">Вложения</h3>
                    {uploadingFile ? (
                      <span className="text-xs text-slate-500">Загрузка…</span>
                    ) : null}
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
                      if (!uploadingFile) setIsDraggingFile(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!uploadingFile) setIsDraggingFile(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingFile(false);
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingFile(false);
                      if (uploadingFile) return;
                      const files = e.dataTransfer.files;
                      await handleDropFiles(files);
                    }}
                  >
                    <input
                      type="file"
                      disabled={uploadingFile}
                      className="hidden"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (files) await handleDropFiles(files);
                        e.currentTarget.value = '';
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

                  {attachmentIds.length === 0 ? (
                    <div className="mt-3 text-sm text-slate-500">Пока нет вложений</div>
                  ) : (
                    <div className="space-y-2 mt-3">
                      {attachmentIds.map((id) => {
                        const doc = documentsById.get(id);
                        const name = doc?.name || id;
                        const rawPath = doc?.path as string | undefined;
                        const normalizedPath = rawPath
                          ? `/${String(rawPath).replace(/^[./]+/, '')}`
                          : undefined;
                        const href = normalizedPath ? `${apiBaseUrl}${normalizedPath}` : undefined;
                        const canPreview =
                          !!href &&
                          (String(doc?.type || '').startsWith('image/') || doc?.type === 'application/pdf');

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
                              {canPreview && doc ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc({ ...doc, href })}
                                  className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-white transition-colors"
                                >
                                  Просмотр
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => removeAttachmentFromTask(id)}
                                className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-white transition-colors"
                              >
                                Отвязать
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

            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="text-xs text-slate-500">
                Создано {creator?.name} •{' '}
                {new Date(task.createdAt).toLocaleString('ru-RU')}
              </div>
              {task.updatedAt !== task.createdAt && (
                <div className="text-xs text-slate-500 mt-1">
                  Обновлено {new Date(task.updatedAt).toLocaleString('ru-RU')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-96 bg-white border-l border-slate-200 flex flex-col">
          <div className="border-b border-slate-200">
            <div className="flex">
              <button
                onClick={() => setActivePanel('client')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors ${
                  activePanel === 'client'
                    ? 'text-brand border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Клиент
              </button>
              <button
                onClick={() => setActivePanel('assistant')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors ${
                  activePanel === 'assistant'
                    ? 'text-brand border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bot className="w-4 h-4" />
                Ассистент
              </button>
            </div>
            <div className="flex border-t border-slate-200">
              <button
                onClick={() => setActivePanel('comments')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors ${
                  activePanel === 'comments'
                    ? 'text-brand border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Комментарии
              </button>
              <button
                onClick={() => setActivePanel('documents')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors ${
                  activePanel === 'documents'
                    ? 'text-brand border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                Документы
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activePanel === 'documents' ? (
              <div className="space-y-4">
                {board.attachmentsEnabled !== false && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-sm font-medium text-slate-900 mb-2">Загрузить файл</div>
                    {uploadError && (
                      <div className="mb-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                        {uploadError}
                      </div>
                    )}
                    <input
                      type="file"
                      disabled={uploadingFile}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadAttachment(file);
                        e.currentTarget.value = '';
                      }}
                      className="block w-full text-sm text-slate-700"
                    />
                    <div className="text-xs text-slate-500 mt-2">
                      Загруженный файл появится во вложениях задачи и в документах workspace.
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-sm font-medium text-slate-900 mb-2">Документы workspace</div>
                  {docsError && (
                    <div className="mb-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                      {docsError}
                    </div>
                  )}
                  {docsLoading ? (
                    <div className="text-sm text-slate-500 py-4">Загрузка…</div>
                  ) : documents.length === 0 ? (
                    <div className="text-sm text-slate-500 py-4">Нет документов</div>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => {
                        const isAttached = attachmentIds.includes(doc.id);
                        const normalizedPath = doc.path ? `/${String(doc.path).replace(/^[./]+/, '')}` : '';
                        const href = doc.path ? `${apiBaseUrl}${normalizedPath}` : undefined;
                        const canPreview =
                          !!href &&
                          (String(doc.type || '').startsWith('image/') || doc.type === 'application/pdf');
                        return (
                          <div key={doc.id} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-slate-700 truncate hover:text-brand block"
                                >
                                  {doc.name}
                                </a>
                              ) : (
                                <div className="text-sm text-slate-700 truncate">{doc.name}</div>
                              )}
                              <div className="text-xs text-slate-500">
                                {Math.round((doc.size || 0) / 1024)} KB
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {canPreview ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc({ ...doc, href })}
                                  className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                  Просмотр
                                </button>
                              ) : null}
                              {board.attachmentsEnabled !== false && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    isAttached ? removeAttachmentFromTask(doc.id) : attachDocumentToTask(doc.id)
                                  }
                                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                                    isAttached
                                      ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                      : 'border-brand text-brand hover:bg-brand-light'
                                  }`}
                                >
                                  {isAttached ? 'Отвязать' : 'Прикрепить'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm('Удалить документ? Он исчезнет из всех задач, где прикреплён.'))
                                    return;
                                  await documentsApi.delete(doc.id);
                                  setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
                                  setTask((prev: any) => ({
                                    ...prev,
                                    attachments: (Array.isArray(prev?.attachments) ? prev.attachments : []).filter(
                                      (x: any) => x !== doc.id,
                                    ),
                                  }));
                                }}
                                className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
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
              </div>
            ) : activePanel === 'comments' ? (
              <div className="space-y-3">
                {(task.comments || []).length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Пока нет комментариев</p>
                  </div>
                ) : (
                  (task.comments || []).map((c: any) => (
                    <div key={c.id} className="rounded-lg border border-slate-200 p-3 bg-white">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-brand-light flex items-center justify-center">
                          <span className="text-xs font-medium text-brand">
                            {c.user?.name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {c.user?.name || 'Пользователь'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {c.createdAt ? new Date(c.createdAt).toLocaleString('ru-RU') : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap">{c.content}</div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Нет сообщений</p>
              </div>
            )}
          </div>

          {activePanel !== 'documents' && (
            <div className="border-t border-slate-200 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={activePanel === 'comments' ? commentText : message}
                  onChange={(e) =>
                    activePanel === 'comments' ? setCommentText(e.target.value) : setMessage(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    if (activePanel === 'comments') postComment();
                    else handleSendMessage();
                  }}
                  placeholder={activePanel === 'comments' ? 'Написать комментарий…' : 'Введите сообщение...'}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                />
                <button
                  onClick={activePanel === 'comments' ? postComment : handleSendMessage}
                  disabled={activePanel === 'comments' ? !commentText.trim() || isPostingComment : !message.trim()}
                  className="px-3 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {previewDoc ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[85vh] bg-white rounded-lg overflow-hidden border border-slate-200 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{previewDoc.name}</div>
                <div className="text-xs text-slate-500">{previewDoc.type}</div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand hover:text-brand-hover"
                >
                  Открыть
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="text-sm px-2 py-1 rounded hover:bg-slate-100"
                >
                  Закрыть
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(85vh-56px)] bg-slate-50">
              {String(previewDoc.type || '').startsWith('image/') ? (
                <img src={previewDoc.href} alt={previewDoc.name} className="max-w-full h-auto mx-auto rounded" />
              ) : previewDoc.type === 'application/pdf' ? (
                <iframe title={previewDoc.name} src={previewDoc.href} className="w-full h-[70vh] rounded" />
              ) : (
                <div className="text-sm text-slate-600">
                  Для этого типа файла доступно только открытие в новой вкладке.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
