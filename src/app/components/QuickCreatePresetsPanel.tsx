import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Plus, Trash2 } from 'lucide-react';
import type { Board, QuickCreateTaskPreset } from '../types';
import { boardsApi, workspacesApi } from '../services/api';
import { useApp } from '../store/AppContext';
import { useWorkspacePermissions } from '../utils/workspacePermissions';
import { FORMS_DEFAULT_EMBEDDED_PATH, FORMS_DEFAULT_TEST_FLOW_URL } from '../qiankun/formsMicroAppPaths';
import { parseFormsFullPath } from '../qiankun/formsActionParams';
import { normalizeFormsAccessToken } from '../qiankun/formsMicroAppBridge';
import { FORMS_MICROAPP_ENABLED } from '../qiankun/formsMicroAppFeature';
import { LegalFormsMicroAppModal } from './LegalFormsMicroAppModal';

type DraftPreset = {
  clientId: string;
  name: string;
  boardId: string;
  columnId: string;
  typeId: string;
  legalFormsEnabled: boolean;
  legalFormsPath: string;
  legalFormsAccessToken: string;
  enabled: boolean;
};

const inputClassName =
  'w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:ring-inset';

function newDraft(): DraftPreset {
  return {
    clientId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    boardId: '',
    columnId: '',
    typeId: '',
    legalFormsEnabled: false,
    legalFormsPath: '',
    legalFormsAccessToken: '',
    enabled: true,
  };
}

function presetToDraft(p: QuickCreateTaskPreset): DraftPreset {
  return {
    clientId: p.id,
    name: p.name,
    boardId: p.boardId,
    columnId: p.columnId,
    typeId: p.typeId ?? '',
    legalFormsEnabled: p.legalFormsEnabled,
    legalFormsPath: p.legalFormsPath ?? '',
    legalFormsAccessToken: p.legalFormsAccessToken ?? '',
    enabled: p.enabled,
  };
}

function sortColumns(board: Board | null) {
  return [...(board?.columns ?? [])].sort((a, b) => a.position - b.position);
}

function sortTaskTypes(board: Board | null) {
  return [...(board?.taskTypes ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function QuickCreatePresetsPanel() {
  const { currentWorkspace } = useApp();
  const { canManageWorkspace } = useWorkspacePermissions();
  const workspaceId = currentWorkspace?.id ?? '';

  const [drafts, setDrafts] = useState<DraftPreset[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardDetails, setBoardDetails] = useState<Record<string, Board>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);

  const creatableBoards = useMemo(
    () => boards.filter((b) => b.kind !== 'aggregated'),
    [boards],
  );

  const previewDraft = useMemo(
    () => drafts.find((d) => d.clientId === previewClientId) ?? null,
    [drafts, previewClientId],
  );

  const previewMount = useMemo(() => {
    if (!previewDraft?.legalFormsPath?.trim()) return null;
    return parseFormsFullPath(previewDraft.legalFormsPath.trim());
  }, [previewDraft?.legalFormsPath]);

  const previewAccessToken = useMemo(() => {
    if (!previewDraft) return null;
    return normalizeFormsAccessToken(previewDraft.legalFormsAccessToken);
  }, [previewDraft]);

  const loadBoardDetails = useCallback(async (boardId: string) => {
    if (!boardId) return null;
    let cached: Board | null = null;
    setBoardDetails((prev) => {
      if (prev[boardId]) cached = prev[boardId];
      return prev;
    });
    if (cached) return cached;

    const board = (await boardsApi.getById(boardId)) as Board;
    setBoardDetails((prev) => ({ ...prev, [boardId]: board }));
    return board;
  }, []);

  useEffect(() => {
    if (!workspaceId || !canManageWorkspace) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      workspacesApi.getQuickCreatePresets(workspaceId),
      boardsApi.getByWorkspace(workspaceId),
    ])
      .then(([presets, boardList]) => {
        if (cancelled) return;
        const list = (Array.isArray(boardList) ? boardList : []) as Board[];
        setBoards(list);
        setDrafts(
          (Array.isArray(presets) ? presets : []).map((p) =>
            presetToDraft(p as QuickCreateTaskPreset),
          ),
        );

        const ids = new Set<string>();
        for (const p of presets as QuickCreateTaskPreset[]) {
          if (p.boardId) ids.add(p.boardId);
        }
        return Promise.all([...ids].map((id) => boardsApi.getById(id)));
      })
      .then((details) => {
        if (cancelled || !details) return;
        const map: Record<string, Board> = {};
        for (const b of details as Board[]) {
          if (b?.id) map[b.id] = b;
        }
        setBoardDetails((prev) => ({ ...prev, ...map }));
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить настройки');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, canManageWorkspace]);

  const updateDraft = (clientId: string, patch: Partial<DraftPreset>) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.clientId !== clientId) return d;
        const next = { ...d, ...patch };
        if (patch.boardId && patch.boardId !== d.boardId) {
          next.columnId = '';
          next.typeId = '';
          void loadBoardDetails(patch.boardId);
        }
        return next;
      }),
    );
  };

  const applyBoardColumnDefault = (clientId: string, board: Board) => {
    const cols = sortColumns(board);
    setDrafts((prev) =>
      prev.map((d) =>
        d.clientId === clientId ? { ...d, columnId: cols[0]?.id ?? '' } : d,
      ),
    );
  };

  const save = async () => {
    if (!workspaceId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await workspacesApi.saveQuickCreatePresets(
        workspaceId,
        drafts.map((d, idx) => ({
          name: d.name.trim(),
          boardId: d.boardId,
          columnId: d.columnId,
          typeId: d.typeId || null,
          legalFormsEnabled: d.legalFormsEnabled,
          legalFormsPath: d.legalFormsEnabled ? d.legalFormsPath.trim() || null : null,
          legalFormsAccessToken: d.legalFormsEnabled
            ? normalizeFormsAccessToken(d.legalFormsAccessToken) ||
              d.legalFormsAccessToken.trim() ||
              null
            : null,
          position: idx,
          enabled: d.enabled,
        })),
      );
      setDrafts(saved.map(presetToDraft));
      setSuccess('Настройки сохранены');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (!canManageWorkspace) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Настройка быстрого создания доступна администратору или менеджеру пространства.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <Loader2 className="size-4 animate-spin" />
        Загрузка…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Быстрое создание задачи</h2>
      <p className="mt-1 text-sm text-slate-600">
        Пресеты отображаются в модальном окне «+» в шапке. Можно задать доску, колонку, тип задачи
        и опционально Legal Forms после создания.
      </p>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {drafts.length === 0 ? (
          <p className="text-sm text-slate-500">Пресеты не настроены.</p>
        ) : null}

        {drafts.map((draft) => {
          const board = draft.boardId ? boardDetails[draft.boardId] : null;
          const columns = sortColumns(board);
          const taskTypes = sortTaskTypes(board);

          return (
            <div
              key={draft.clientId}
              className="space-y-3 rounded-lg border border-slate-200 p-4"
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="xl:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Название</label>
                  <input
                    value={draft.name}
                    onChange={(e) => updateDraft(draft.clientId, { name: e.target.value })}
                    placeholder="Например: Обращение"
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Доска</label>
                  <select
                    value={draft.boardId}
                    onChange={(e) => {
                      const boardId = e.target.value;
                      updateDraft(draft.clientId, { boardId, columnId: '', typeId: '' });
                      if (boardId) {
                        void loadBoardDetails(boardId).then((b) => {
                          if (b) applyBoardColumnDefault(draft.clientId, b as Board);
                        });
                      }
                    }}
                    className={inputClassName}
                  >
                    <option value="">Выберите доску</option>
                    {creatableBoards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Колонка</label>
                  <select
                    value={draft.columnId}
                    onChange={(e) => updateDraft(draft.clientId, { columnId: e.target.value })}
                    className={inputClassName}
                    disabled={!draft.boardId || columns.length === 0}
                  >
                    <option value="">—</option>
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end justify-between gap-2">
                  <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={(e) => updateDraft(draft.clientId, { enabled: e.target.checked })}
                    />
                    Вкл.
                  </label>
                  <button
                    type="button"
                    onClick={() => setDrafts((prev) => prev.filter((d) => d.clientId !== draft.clientId))}
                    className="rounded border border-slate-200 p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                    aria-label="Удалить пресет"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Тип задачи (необязательно)
                  </label>
                  <select
                    value={draft.typeId}
                    onChange={(e) => updateDraft(draft.clientId, { typeId: e.target.value })}
                    className={inputClassName}
                    disabled={!draft.boardId || taskTypes.length === 0}
                  >
                    <option value="">Пользователь выберет в модалке</option>
                    {taskTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <label className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={draft.legalFormsEnabled}
                    onChange={(e) =>
                      updateDraft(draft.clientId, {
                        legalFormsEnabled: e.target.checked,
                        legalFormsPath: e.target.checked
                          ? draft.legalFormsPath || FORMS_DEFAULT_EMBEDDED_PATH
                          : draft.legalFormsPath,
                      })
                    }
                  />
                  Legal Forms после создания задачи
                </label>

                {draft.legalFormsEnabled ? (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">
                        Путь к форме
                      </label>
                      <textarea
                        value={draft.legalFormsPath}
                        onChange={(e) =>
                          updateDraft(draft.clientId, { legalFormsPath: e.target.value })
                        }
                        placeholder={`${FORMS_DEFAULT_TEST_FLOW_URL}\nили ${FORMS_DEFAULT_EMBEDDED_PATH}`}
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        URL legal-forms.ru или /forms/… — без access_token (токен ниже).
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">
                        LF access_token
                      </label>
                      <textarea
                        value={draft.legalFormsAccessToken}
                        onChange={(e) =>
                          updateDraft(draft.clientId, { legalFormsAccessToken: e.target.value })
                        }
                        placeholder="Скопируйте ?access_token=.eJx… из legal-forms.ru"
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs"
                      />
                    </div>
                    {FORMS_MICROAPP_ENABLED ? (
                      <button
                        type="button"
                        disabled={
                          !draft.legalFormsPath.trim() ||
                          !normalizeFormsAccessToken(draft.legalFormsAccessToken)
                        }
                        onClick={() => setPreviewClientId(draft.clientId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Eye className="size-3.5" />
                        Проверить форму
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDrafts((prev) => [...prev, newDraft()])}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Plus className="size-4" />
          Добавить пресет
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Сохранить
        </button>
      </div>

      {FORMS_MICROAPP_ENABLED && previewDraft && previewMount ? (
        <LegalFormsMicroAppModal
          open={Boolean(previewClientId)}
          title="Предпросмотр Legal Forms"
          description={`Пресет «${previewDraft.name || 'без названия'}»`}
          formsPath={previewMount.embeddedPath}
          formsEntry={previewMount.entry}
          pathError={previewMount.error}
          accessToken={previewAccessToken}
          onClose={() => setPreviewClientId(null)}
          onComplete={() => setPreviewClientId(null)}
        />
      ) : null}
    </div>
  );
}
