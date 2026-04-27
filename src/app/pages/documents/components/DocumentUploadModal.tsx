import { useEffect, useRef, useState } from 'react';
import { X, Upload } from 'lucide-react';

type VisMode = 'workspace' | 'department' | 'group' | 'custom';

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  departments: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  workspaceUsers: { id: string; name: string }[];
  onSubmit: (file: File, visibility: Record<string, unknown>) => Promise<void>;
  uploading: boolean;
  error: string | null;
};

function buildVisibility(
  mode: VisMode,
  departmentIds: string[],
  groupIds: string[],
  userIds: string[],
): Record<string, unknown> {
  switch (mode) {
    case 'workspace':
      return { type: 'workspace' };
    case 'department':
      return { type: 'department', departmentIds };
    case 'group':
      return { type: 'group', groupIds };
    case 'custom':
      return { type: 'custom', userIds };
    default:
      return { type: 'workspace' };
  }
}

function validate(
  mode: VisMode,
  departmentIds: string[],
  groupIds: string[],
  userIds: string[],
): string | null {
  if (mode === 'department' && departmentIds.length === 0) {
    return 'Выберите хотя бы один отдел';
  }
  if (mode === 'group' && groupIds.length === 0) {
    return 'Выберите хотя бы одну группу';
  }
  if (mode === 'custom' && userIds.length === 0) {
    return 'Выберите хотя бы одного участника';
  }
  return null;
}

function toggleIn(set: string[], id: string, on: boolean): string[] {
  if (on) {
    return set.includes(id) ? set : [...set, id];
  }
  return set.filter((x) => x !== id);
}

export function DocumentUploadModal(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [visMode, setVisMode] = useState<VisMode>('workspace');
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!p.open) return;
    setFile(null);
    setVisMode('workspace');
    setDeptIds([]);
    setGroupIds([]);
    setUserIds([]);
    setLocalError(null);
  }, [p.open]);

  if (!p.open) return null;

  const onPickFile = (f: File | null) => {
    setFile(f);
    setLocalError(null);
  };

  const submit = async () => {
    setLocalError(null);
    if (!file) {
      setLocalError('Выберите файл');
      return;
    }
    const vErr = validate(visMode, deptIds, groupIds, userIds);
    if (vErr) {
      setLocalError(vErr);
      return;
    }
    const vis = buildVisibility(visMode, deptIds, groupIds, userIds);
    await p.onSubmit(file, vis);
  };

  const err = p.error || localError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal
      onMouseDown={(e) => e.target === e.currentTarget && !p.uploading && p.onClose()}
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Загрузка документа</h2>
          <button
            type="button"
            onClick={p.onClose}
            disabled={p.uploading}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <div className="text-sm font-medium text-slate-800 mb-2">Файл (до 10 МБ)</div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={p.uploading}
                className="inline-flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Выбрать файл
              </button>
              {file ? (
                <span className="text-sm text-slate-600 truncate max-w-[220px]">{file.name}</span>
              ) : null}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-slate-800 mb-2">Кто видит документ</div>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="vis"
                  checked={visMode === 'workspace'}
                  onChange={() => setVisMode('workspace')}
                />
                Всё пространство
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="vis"
                  checked={visMode === 'department'}
                  onChange={() => setVisMode('department')}
                  disabled={p.departments.length === 0}
                />
                Отделы
              </label>
              {visMode === 'department' && (
                <div className="ml-6 max-h-32 overflow-y-auto rounded border border-slate-200 p-2">
                  {p.departments.length === 0 ? (
                    <span className="text-slate-500">Нет отделов в пространстве</span>
                  ) : (
                    p.departments.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 py-0.5">
                        <input
                          type="checkbox"
                          checked={deptIds.includes(d.id)}
                          onChange={(e) =>
                            setDeptIds((prev) => toggleIn(prev, d.id, e.target.checked))
                          }
                        />
                        {d.name}
                      </label>
                    ))
                  )}
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="vis"
                  checked={visMode === 'group'}
                  onChange={() => setVisMode('group')}
                  disabled={p.groups.length === 0}
                />
                Группы
              </label>
              {visMode === 'group' && (
                <div className="ml-6 max-h-32 overflow-y-auto rounded border border-slate-200 p-2">
                  {p.groups.length === 0 ? (
                    <span className="text-slate-500">Нет групп</span>
                  ) : (
                    p.groups.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 py-0.5">
                        <input
                          type="checkbox"
                          checked={groupIds.includes(g.id)}
                          onChange={(e) =>
                            setGroupIds((prev) => toggleIn(prev, g.id, e.target.checked))
                          }
                        />
                        {g.name}
                      </label>
                    ))
                  )}
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="vis"
                  checked={visMode === 'custom'}
                  onChange={() => setVisMode('custom')}
                  disabled={p.workspaceUsers.length === 0}
                />
                Выбранные участники
              </label>
              {visMode === 'custom' && (
                <div className="ml-6 max-h-32 overflow-y-auto rounded border border-slate-200 p-2">
                  {p.workspaceUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 py-0.5">
                      <input
                        type="checkbox"
                        checked={userIds.includes(u.id)}
                        onChange={(e) => setUserIds((prev) => toggleIn(prev, u.id, e.target.checked))}
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {err ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {err}
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={p.onClose}
            disabled={p.uploading}
            className="rounded border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={p.uploading}
            className="rounded bg-brand px-4 py-2 text-sm text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {p.uploading ? 'Загрузка…' : 'Загрузить'}
          </button>
        </div>
      </div>
    </div>
  );
}
