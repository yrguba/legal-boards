import { useMemo } from 'react';
import type { Board, TaskField, User } from '../../../types';
import { extractClientInfo } from '../utils/clientInfo';
import { filterChatMessagesByType } from '../utils/chatMessages';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { getDescriptionFieldId, getSortedTaskFields, getTitleFieldId } from '../utils/taskFieldIds';
import type { TaskRecord } from '../types';

export function useTaskDerived(task: TaskRecord | null, board: Board | null, users: User[]) {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const taskFields: TaskField[] = useMemo(
    () => (board ? getSortedTaskFields(board.taskFields) : []),
    [board],
  );

  const titleFieldId = useMemo(() => getTitleFieldId(taskFields), [taskFields]);
  const descriptionFieldId = useMemo(() => getDescriptionFieldId(taskFields), [taskFields]);

  const taskType =
    task && board ? task.type || board.taskTypes?.find((t) => t.id === task.typeId) : undefined;
  const assignee = task
    ? task.assignee || (task.assigneeId ? usersById.get(task.assigneeId) : null)
    : null;
  const creator = task
    ? task.creator || (task.createdBy ? usersById.get(task.createdBy) : null)
    : null;
  const column = task && board ? board.columns?.find((c) => c.id === task.columnId) : undefined;

  const clientInfo = useMemo(
    () =>
      task ? extractClientInfo(task.customFields as any, taskFields) : { fullName: null, organization: null },
    [task, taskFields],
  );

  const clientPanelChat = useMemo(
    () => filterChatMessagesByType(task?.chatMessages, 'client'),
    [task?.chatMessages],
  );

  const assistantPanelChat = useMemo(
    () => filterChatMessagesByType(task?.chatMessages, 'assistant'),
    [task?.chatMessages],
  );

  const clientInteractionList = useMemo(() => {
    const list = task?.clientInteractions;
    if (!Array.isArray(list)) return [];
    return list;
  }, [task?.clientInteractions]);

  const taskAttachments: Record<string, unknown>[] = useMemo(() => {
    const list = task?.taskAttachments;
    if (!Array.isArray(list)) return [];
    return list as Record<string, unknown>[];
  }, [task?.taskAttachments]);

  return {
    apiBaseUrl,
    usersById,
    taskFields,
    titleFieldId,
    descriptionFieldId,
    taskType,
    assignee,
    creator,
    column,
    clientInfo,
    clientPanelChat,
    assistantPanelChat,
    clientInteractionList,
    taskAttachments,
  };
}
