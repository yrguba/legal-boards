import { useCallback, useState } from 'react';
import { tasksApi } from '../../../services/api';
import {
  formatPendingApprovalsMessage,
  type TaskColumnApprovalRow,
} from '../../../utils/boardApprovals';
import {
  buildColumnTransitionPlan,
  formatColumnTransitionCheckErrors,
  type ColumnTransitionInteractiveStep,
  type TaskColumnActionCompletionRow,
} from '../../../utils/boardColumnActions';
import type { Board, TaskField } from '../../../types';
import type { TaskRecord } from '../types';
import type { InlineFieldKey } from '../utils/validateField';
import { validateField } from '../utils/validateField';
import type { BoardApprovalRule } from '../../../features/board-settings/boardAdvancedSettings.types';

export type TaskSnapshot = {
  columnId: string;
  typeId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  customFields: Record<string, unknown>;
};

export type TaskUpdatePatch = Partial<{
  title: string;
  description: string | null;
  columnId: string;
  typeId: string;
  assigneeId: string | null;
  customFields: Record<string, unknown>;
}>;

export function getTaskSnapshot(task: TaskRecord): TaskSnapshot {
  return {
    columnId: task.columnId,
    typeId: task.typeId,
    title: (task.title || '').trim(),
    description: task.description?.trim() || null,
    assigneeId: task.assigneeId || null,
    customFields: { ...(task.customFields as Record<string, unknown>) },
  };
}

type ColumnTransitionState = {
  fromColumnId: string;
  toColumnId: string;
  steps: ColumnTransitionInteractiveStep[];
  pendingUpdate: TaskSnapshot;
};

type Args = {
  task: TaskRecord | null;
  board: Board | null;
  taskFields: TaskField[];
  titleFieldId: string;
  descriptionFieldId: string;
  taskAttachments: Record<string, unknown>[];
  conclusionDraft: string;
  approvalRules: BoardApprovalRule[];
  columnApprovals: TaskColumnApprovalRow[];
  activeTaskId: string | undefined;
  setTask: React.Dispatch<React.SetStateAction<TaskRecord | null>>;
  setColumnTransition: React.Dispatch<React.SetStateAction<ColumnTransitionState | null>>;
  loadActivity: () => void;
};

function buildPatchForField(
  key: InlineFieldKey,
  value: unknown,
  task: TaskRecord,
  titleFieldId: string,
  descriptionFieldId: string,
): TaskUpdatePatch {
  if (key === 'title') {
    const title = String(value).trim();
    const patch: TaskUpdatePatch = { title };
    if (titleFieldId) {
      patch.customFields = { ...(task.customFields as Record<string, unknown>), [titleFieldId]: title };
    }
    return patch;
  }
  if (key === 'description') {
    const description = String(value).trim() || null;
    const patch: TaskUpdatePatch = { description };
    if (descriptionFieldId) {
      patch.customFields = {
        ...(task.customFields as Record<string, unknown>),
        [descriptionFieldId]: description ?? '',
      };
    }
    return patch;
  }
  if (key === 'columnId') return { columnId: String(value) };
  if (key === 'typeId') return { typeId: String(value) };
  if (key === 'assigneeId') return { assigneeId: (value as string) || null };
  if (key.startsWith('custom:')) {
    const fieldId = key.slice('custom:'.length);
    return {
      customFields: { ...(task.customFields as Record<string, unknown>), [fieldId]: value },
    };
  }
  return {};
}

export function useTaskFieldUpdate({
  task,
  board,
  taskFields,
  titleFieldId,
  descriptionFieldId,
  taskAttachments,
  conclusionDraft,
  approvalRules,
  columnApprovals,
  activeTaskId,
  setTask,
  setColumnTransition,
  loadActivity,
}: Args) {
  const [savingField, setSavingField] = useState<InlineFieldKey | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<InlineFieldKey, string>>>({});

  const clearFieldError = useCallback((key: InlineFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const isFieldLocked = useCallback(
    (key: InlineFieldKey) => savingField !== null && savingField !== key,
    [savingField],
  );

  const applyUpdate = useCallback(
    async (patch: TaskUpdatePatch) => {
      if (!activeTaskId) throw new Error('Задача не загружена');
      const updated = await tasksApi.update(activeTaskId, patch);
      setTask((prev) => (prev ? { ...prev, ...updated } : prev));
      void loadActivity();
    },
    [activeTaskId, setTask, loadActivity],
  );

  const tryColumnMove = useCallback(
    async (toColumnId: string, snapshot: TaskSnapshot): Promise<boolean> => {
      if (!task || !board || !activeTaskId) return false;
      if (toColumnId === task.columnId) return true;

      const pendingMsg = formatPendingApprovalsMessage(
        approvalRules,
        task.columnId,
        columnApprovals,
      );
      if (pendingMsg) throw new Error(pendingMsg);

      const rawCompletions = Array.isArray(
        (task as TaskRecord & { columnActionCompletions?: TaskColumnActionCompletionRow[] })
          .columnActionCompletions,
      )
        ? (task as TaskRecord & { columnActionCompletions?: TaskColumnActionCompletionRow[] })
            .columnActionCompletions!
        : [];

      const actionPlan = buildColumnTransitionPlan(
        board,
        {
          title: snapshot.title,
          assigneeId: snapshot.assigneeId,
          description: snapshot.description,
          conclusionText: conclusionDraft,
          customFields: snapshot.customFields,
          taskAttachments,
          columnActionCompletions: rawCompletions,
        },
        task.columnId,
        toColumnId,
      );

      if (actionPlan.checkErrors.length > 0) {
        throw new Error(formatColumnTransitionCheckErrors(actionPlan.checkErrors));
      }

      if (actionPlan.interactiveSteps.length > 0) {
        setColumnTransition({
          fromColumnId: task.columnId,
          toColumnId,
          steps: actionPlan.interactiveSteps,
          pendingUpdate: { ...snapshot, columnId: toColumnId },
        });
        return false;
      }

      await applyUpdate({ columnId: toColumnId });
      return true;
    },
    [
      task,
      board,
      activeTaskId,
      approvalRules,
      columnApprovals,
      conclusionDraft,
      taskAttachments,
      applyUpdate,
      setColumnTransition,
    ],
  );

  const saveField = useCallback(
    async (key: InlineFieldKey, value: unknown) => {
      if (!task) throw new Error('Задача не загружена');

      const validationError = validateField(key, value, taskFields, titleFieldId, descriptionFieldId);
      if (validationError) {
        setFieldErrors((prev) => ({ ...prev, [key]: validationError }));
        throw new Error(validationError);
      }

      clearFieldError(key);
      setSavingField(key);

      try {
        const patch = buildPatchForField(key, value, task, titleFieldId, descriptionFieldId);

        if (key === 'columnId' && patch.columnId && patch.columnId !== task.columnId) {
          const snapshot = getTaskSnapshot(task);
          await tryColumnMove(patch.columnId, snapshot);
        } else {
          await applyUpdate(patch);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Не удалось сохранить';
        setFieldErrors((prev) => ({ ...prev, [key]: msg }));
        throw e;
      } finally {
        setSavingField(null);
      }
    },
    [
      task,
      taskFields,
      titleFieldId,
      descriptionFieldId,
      clearFieldError,
      tryColumnMove,
      applyUpdate,
    ],
  );

  const finishColumnTransition = useCallback(
    async (toColumnId: string, pendingUpdate: TaskSnapshot) => {
      if (!activeTaskId) return;
      setSavingField('columnId');
      try {
        await applyUpdate({ ...pendingUpdate, columnId: toColumnId });
        setColumnTransition(null);
      } finally {
        setSavingField(null);
      }
    },
    [activeTaskId, applyUpdate, setColumnTransition],
  );

  return {
    savingField,
    fieldErrors,
    saveField,
    isFieldLocked,
    clearFieldError,
    finishColumnTransition,
  };
}
