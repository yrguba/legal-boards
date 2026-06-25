import { useMemo } from 'react';
import type { TaskField } from '../types';
import type { ColumnTransitionInteractiveStep, TaskForColumnChecks } from '../utils/boardColumnActions';
import {
  resolveFormsAccessTokenForTask,
  resolveFormsMountFromActionConfig,
} from '../qiankun/formsActionParams';
import { FORMS_MICRO_APP_ENTRY } from '../qiankun/formsMicroApp.config';
import { LegalFormsMicroAppModal } from './LegalFormsMicroAppModal';

type Props = {
  step: ColumnTransitionInteractiveStep;
  stepIndex: number;
  stepsLength: number;
  task: TaskForColumnChecks;
  taskFields: TaskField[];
  targetColumnName?: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onComplete: (payload: Record<string, unknown>) => void | Promise<void>;
};

export function LegalFormsColumnStep({
  step,
  stepIndex,
  stepsLength,
  task,
  taskFields,
  targetColumnName,
  submitting,
  error,
  onClose,
  onComplete,
}: Props) {
  const formsMount = useMemo(
    () => resolveFormsMountFromActionConfig(step.rule.config, task, taskFields),
    [step.rule.config, task, taskFields],
  );

  const formsAccessToken = useMemo(
    () => resolveFormsAccessTokenForTask(step.rule.config, task, taskFields),
    [step.rule.config, task, taskFields],
  );

  const phaseLabel =
    step.phase === 'enter'
      ? `Для перехода в «${targetColumnName || 'новый статус'}»`
      : 'Перед выходом из текущего статуса';

  return (
    <LegalFormsMicroAppModal
      open
      title={step.rule.name.trim() || 'Форма Legal Forms'}
      description={`${phaseLabel} — шаг ${stepIndex + 1} из ${stepsLength}`}
      formsPath={formsMount.embeddedPath}
      formsEntry={formsMount.entry ?? FORMS_MICRO_APP_ENTRY}
      pathError={formsMount.error}
      accessToken={formsAccessToken}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onComplete={() =>
        onComplete({
          completed: true,
          formsPath: formsMount.embeddedPath ?? undefined,
        })
      }
    />
  );
}

export default LegalFormsColumnStep;
