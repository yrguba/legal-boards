import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';
import type { Board, QuickCreateTaskPreset } from '../types';
import { useApp } from '../store/AppContext';
import { boardsApi, tasksApi, workspacesApi } from '../services/api';
import { useWorkspacePermissions } from '../utils/workspacePermissions';
import type { TaskForColumnChecks } from '../utils/boardColumnActions';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { richEditorDialogHandlers } from './markdown';
import { TaskCreateFormFields, useTaskCreateForm, uploadPendingTaskAttachments } from './TaskCreateFormFields';
import { LegalFormsTaskModal } from './LegalFormsTaskModal';

const selectClassName =
  'w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-inset';

export type QuickCreateSuccess = {
  key?: string;
  title: string;
  documentAttached?: boolean;
};

interface QuickCreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (task: QuickCreateSuccess) => void;
}

type FlowStep = 'form' | 'lf' | 'success';

export function QuickCreateTaskModal({ open, onOpenChange, onSuccess }: QuickCreateTaskModalProps) {
  const { currentWorkspace } = useApp();
  const { canManageWorkspace } = useWorkspacePermissions();
  const workspaceId = currentWorkspace?.id ?? '';

  const [presets, setPresets] = useState<QuickCreateTaskPreset[]>([]);
  const [presetId, setPresetId] = useState('');
  const [board, setBoard] = useState<Board | null>(null);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<FlowStep>('form');
  const [createdTask, setCreatedTask] = useState<QuickCreateSuccess | null>(null);
  const [pendingSuccess, setPendingSuccess] = useState<QuickCreateSuccess | null>(null);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [taskForForms, setTaskForForms] = useState<TaskForColumnChecks | null>(null);

  const selectedPreset = useMemo(
    () => presets.find((p) => p.id === presetId) ?? null,
    [presets, presetId],
  );

  const form = useTaskCreateForm(board, { defaultTypeId: selectedPreset?.typeId });

  const legalFormsConfig = useMemo(
    () =>
      selectedPreset?.legalFormsEnabled
        ? {
            formsPath: selectedPreset.legalFormsPath ?? '',
            formsAccessToken: selectedPreset.legalFormsAccessToken ?? '',
          }
        : null,
    [selectedPreset],
  );

  const resetState = () => {
    setPresetId('');
    setBoard(null);
    setPresets([]);
    setLoadError(null);
    setError(null);
    setCreatedTask(null);
    setPendingSuccess(null);
    setCreatedTaskId(null);
    setTaskForForms(null);
    setStep('form');
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const finishSuccess = (success: QuickCreateSuccess) => {
    setCreatedTask(success);
    setStep('success');
    onSuccess?.(success);
  };

  useEffect(() => {
    if (!open || !workspaceId) return;

    let cancelled = false;
    setLoadingPresets(true);
    setLoadError(null);
    resetState();

    workspacesApi
      .getQuickCreatePresets(workspaceId, true)
      .then((list) => {
        if (cancelled) return;
        const items = Array.isArray(list) ? (list as QuickCreateTaskPreset[]) : [];
        setPresets(items);
        if (items.length === 1) {
          setPresetId(items[0].id);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить пресеты');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPresets(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, workspaceId]);

  useEffect(() => {
    if (!open || !selectedPreset) {
      setBoard(null);
      return;
    }

    let cancelled = false;
    setLoadingBoard(true);
    setLoadError(null);

    boardsApi
      .getById(selectedPreset.boardId)
      .then((b) => {
        if (!cancelled) setBoard(b as Board);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить доску');
          setBoard(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBoard(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedPreset?.id, selectedPreset?.boardId]);

  const hideTypeSelector = Boolean(selectedPreset?.typeId);

  const boardReady = Boolean(
    selectedPreset &&
      board &&
      (board.taskTypes?.length ?? 0) > 0 &&
      selectedPreset.columnId &&
      (hideTypeSelector ? Boolean(form.typeId) : form.typeId),
  );

  const submit = async () => {
    if (!selectedPreset || !board) return;

    setError(null);
    const validationError = form.validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = form.buildPayload();
      const created = await tasksApi.create({
        boardId: board.id,
        columnId: selectedPreset.columnId,
        ...payload,
      });

      const taskId = typeof created?.id === 'string' ? created.id : null;

      if (form.pendingFiles.length > 0 && taskId) {
        await uploadPendingTaskAttachments(taskId, form.pendingFiles);
      }

      const success: QuickCreateSuccess = {
        key: typeof created?.key === 'string' ? created.key : undefined,
        title: payload.title,
      };

      if (selectedPreset.legalFormsEnabled && legalFormsConfig && taskId) {
        setPendingSuccess(success);
        setCreatedTaskId(taskId);
        setTaskForForms({
          title: payload.title,
          description: payload.description,
          customFields: payload.customFields,
        });
        setStep('lf');
        return;
      }

      finishSuccess(success);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось создать задачу');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <Dialog
        open={open && step !== 'lf'}
        onOpenChange={(next) => {
          if (!next) handleClose();
        }}
      >
        <DialogContent
          className="flex max-h-[min(90vh,calc(100dvh-2rem))] flex-col gap-4 overflow-hidden sm:max-w-2xl"
          {...richEditorDialogHandlers}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Быстрое создание задачи</DialogTitle>
          </DialogHeader>

          {createdTask && step === 'success' ? (
            <div className="space-y-4 px-2 py-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Задача «{createdTask.title}» создана
                {createdTask.key ? ` (${createdTask.key})` : ''}.
                {createdTask.documentAttached
                  ? ' Документ Legal Forms прикреплён к задаче.'
                  : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {createdTask.key ? (
                  <Link
                    to={`/task/${createdTask.key}`}
                    onClick={handleClose}
                    className="rounded bg-brand px-4 py-2 text-sm text-white hover:bg-brand-hover"
                  >
                    Открыть задачу
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Закрыть
                </button>
              </div>
            </div>
          ) : (
            <>
              {(error || loadError) && (
                <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error || loadError}
                </div>
              )}

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto overscroll-contain px-2 py-2 pb-4 [-webkit-overflow-scrolling:touch]">
                {!workspaceId ? (
                  <p className="text-sm text-slate-600">Выберите рабочее пространство.</p>
                ) : loadingPresets ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 className="size-4 animate-spin" />
                    Загрузка пресетов…
                  </div>
                ) : presets.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p>Быстрое создание не настроено для этого пространства.</p>
                    {canManageWorkspace ? (
                      <Link
                        to="/settings"
                        onClick={handleClose}
                        className="mt-2 inline-block text-brand hover:underline"
                      >
                        Настроить в параметрах →
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Категория *
                      </label>
                      <select
                        value={presetId}
                        onChange={(e) => setPresetId(e.target.value)}
                        className={selectClassName}
                      >
                        <option value="" disabled>
                          Выберите категорию
                        </option>
                        {presets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {selectedPreset ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Доска: {selectedPreset.boardName} · колонка: {selectedPreset.columnName}
                          {selectedPreset.typeName ? ` · тип: ${selectedPreset.typeName}` : ''}
                          {selectedPreset.legalFormsEnabled ? ' · Legal Forms' : ''}
                        </p>
                      ) : null}
                    </div>

                    {loadingBoard ? (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Loader2 className="size-4 animate-spin" />
                        Загрузка полей доски…
                      </div>
                    ) : null}

                    {board && (board.taskTypes?.length ?? 0) === 0 ? (
                      <p className="text-sm text-amber-700">На доске нет типов задач.</p>
                    ) : null}

                    {boardReady && board ? (
                      <TaskCreateFormFields
                        form={form}
                        users={[]}
                        board={board}
                        hideAuthor
                        hideAssignee
                        hideTypeSelector={hideTypeSelector}
                        key={`${board.id}-${selectedPreset!.id}`}
                      />
                    ) : null}
                  </>
                )}
              </div>

              <DialogFooter className="shrink-0 gap-2 border-t border-slate-100 pt-4 sm:gap-0">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded px-4 py-2 text-slate-700 transition-colors hover:bg-slate-100"
                  disabled={isSubmitting}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => void submit()}
                  className="rounded bg-brand px-4 py-2 text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    isSubmitting ||
                    !boardReady ||
                    !form.canSubmit ||
                    loadingPresets ||
                    loadingBoard ||
                    presets.length === 0
                  }
                >
                  {isSubmitting ? 'Создание…' : 'Создать'}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {step === 'lf' && selectedPreset && legalFormsConfig && createdTaskId && taskForForms && board ? (
        <LegalFormsTaskModal
          open
          title={selectedPreset.name.trim() || 'Legal Forms'}
          description="Заполните форму и нажмите «Сформировать документ» — файл будет прикреплён к задаче."
          config={legalFormsConfig}
          task={taskForForms}
          taskFields={board.taskFields ?? []}
          attachDocumentToTaskId={createdTaskId}
          onClose={() => {
            finishSuccess(pendingSuccess ?? { title: String(taskForForms.title ?? 'Задача') });
          }}
          onComplete={async () => {
            finishSuccess({
              ...(pendingSuccess ?? { title: String(taskForForms.title ?? 'Задача') }),
              documentAttached: true,
            });
          }}
        />
      ) : null}
    </>
  );
}
