import { useMemo, useRef } from 'react';
import type { LegalFormsActionConfig } from '../qiankun/formsActionParams';
import type { TaskField } from '../types';
import type { TaskForColumnChecks } from '../utils/boardColumnActions';
import {
  resolveFormsAccessTokenForTask,
  resolveFormsMountFromActionConfig,
} from '../qiankun/formsActionParams';
import { FORMS_MICRO_APP_ENTRY } from '../qiankun/formsMicroApp.config';
import { getFormsHostSavedFormData } from '../qiankun/formsMicroAppHostBridge';
import { LegalFormsMicroAppModal } from './LegalFormsMicroAppModal';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  config: LegalFormsActionConfig;
  task: TaskForColumnChecks;
  taskFields: TaskField[];
  attachDocumentToTaskId?: string;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onComplete: (payload: Record<string, unknown>) => void | Promise<void>;
};

export function LegalFormsTaskModal({
  open,
  title,
  description,
  config,
  task,
  taskFields,
  attachDocumentToTaskId,
  submitting = false,
  error = null,
  onClose,
  onComplete,
}: Props) {
  const formsMount = useMemo(
    () => resolveFormsMountFromActionConfig(config, task, taskFields),
    [config, task, taskFields],
  );

  const formsAccessToken = useMemo(
    () => resolveFormsAccessTokenForTask(config, task, taskFields),
    [config, task, taskFields],
  );

  const savedFormRef = useRef<unknown>(null);

  return (
    <LegalFormsMicroAppModal
      open={open}
      title={title}
      description={description}
      formsPath={formsMount.embeddedPath}
      formsEntry={formsMount.entry ?? FORMS_MICRO_APP_ENTRY}
      pathError={formsMount.error}
      accessToken={formsAccessToken}
      submitting={submitting}
      error={error}
      attachDocumentToTaskId={attachDocumentToTaskId}
      onClose={onClose}
      onSaveForm={(data) => {
        savedFormRef.current = data;
      }}
      onComplete={() =>
        onComplete({
          completed: true,
          formsPath: formsMount.embeddedPath ?? undefined,
          formData: savedFormRef.current ?? getFormsHostSavedFormData(),
        })
      }
    />
  );
}

export default LegalFormsTaskModal;
