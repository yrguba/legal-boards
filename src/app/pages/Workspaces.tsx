import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useApp } from '../store/AppContext';
import { workspacesApi } from '../services/api';
import { Building2, Check, Pencil, Plus, Trash2 } from 'lucide-react';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function Workspaces() {
  const { workspaces, currentWorkspace, refreshWorkspaces, switchWorkspace } = useApp();
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const startEdit = (ws: { id: string; name: string; description?: string | null }) => {
    setEditingId(ws.id);
    setEditName(ws.name);
    setEditDesc(ws.description || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = createName.trim();
    if (!name) {
      setCreateError('Введите название');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const w = await workspacesApi.create({
        name,
        description: createDesc.trim() || undefined,
      });
      setCreateName('');
      setCreateDesc('');
      await refreshWorkspaces(w.id);
    } catch (err: any) {
      setCreateError(err?.message || 'Не удалось создать');
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    setSavingId(id);
    try {
      await workspacesApi.update(id, {
        name,
        description: editDesc.trim() || undefined,
      });
      await refreshWorkspaces();
      cancelEdit();
    } catch (err: any) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        'Удалить это рабочее пространство? Доски и данные, связанные с ним, будут безвозвратно удалены.',
      )
    ) {
      return;
    }
    setDeleteId(id);
    try {
      await workspacesApi.delete(id);
      await refreshWorkspaces();
    } catch (err: any) {
      alert(err?.message || 'Не удалось удалить');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Пространства</h1>
        <p className="text-sm text-slate-600 mt-1">
          Создавайте отдельные пространства для разных направлений и переключайтесь между ними в шапке
          страницы.
        </p>
        <p className="text-sm mt-2">
          <Link to="/settings" className="text-brand hover:text-brand-hover">
            Настройки профиля и уведомлений
          </Link>
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h2 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
          <Plus className="size-4 text-slate-500" />
          Новое пространство
        </h2>
        <form onSubmit={handleCreate} className="space-y-3">
          {createError ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {createError}
            </div>
          ) : null}
          <div>
            <label className="block text-sm text-slate-600 mb-1">Название</label>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Например, Арбитраж 2025"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Описание (необязательно)</label>
            <textarea
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              rows={2}
              placeholder="Кратко, для чего это пространство"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-y min-h-[72px]"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !createName.trim()}
            className="px-4 py-2 text-sm font-medium bg-brand text-white rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Создание…' : 'Создать пространство'}
          </button>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Ваши пространства</h2>
        {workspaces.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-lg">
            Пока нет пространств — создайте первое выше
          </div>
        ) : (
          workspaces.map((ws) => {
            const isCurrent = currentWorkspace?.id === ws.id;
            const isEditing = editingId === ws.id;
            return (
              <div
                key={ws.id}
                className={`bg-white rounded-lg border p-4 ${
                  isCurrent ? 'border-brand ring-1 ring-brand/20' : 'border-slate-200'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">Название</label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">Описание</label>
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-y"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSave(ws.id)}
                        disabled={savingId === ws.id || !editName.trim()}
                        className="px-3 py-1.5 text-sm bg-brand text-white rounded hover:bg-brand-hover disabled:opacity-50"
                      >
                        {savingId === ws.id ? 'Сохранение…' : 'Сохранить'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-3 py-1.5 text-sm text-slate-700 border border-slate-300 rounded hover:bg-slate-50"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center flex-shrink-0">
                        <Building2 className="size-5 text-brand" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-slate-900">{ws.name}</h3>
                          {isCurrent ? (
                            <span className="text-xs font-medium text-brand bg-brand-light px-2 py-0.5 rounded">
                              Текущее
                            </span>
                          ) : null}
                          {ws.isOwner ? (
                            <span className="text-xs text-slate-500">Владелец</span>
                          ) : (
                            <span className="text-xs text-slate-500">Участник</span>
                          )}
                        </div>
                        {ws.description ? (
                          <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{ws.description}</p>
                        ) : null}
                        <p className="text-xs text-slate-400 mt-2">Создано {formatDate(ws.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end sm:flex-shrink-0">
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => {
                            switchWorkspace(ws.id);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50"
                        >
                          <Check className="size-3.5" />
                          Сделать текущим
                        </button>
                      )}
                      {ws.isOwner && (
                        <button
                          type="button"
                          onClick={() => startEdit(ws)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50"
                        >
                          <Pencil className="size-3.5" />
                          Изменить
                        </button>
                      )}
                      {ws.isOwner && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(ws.id)}
                          disabled={deleteId === ws.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-700 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" />
                          {deleteId === ws.id ? 'Удаление…' : 'Удалить'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
