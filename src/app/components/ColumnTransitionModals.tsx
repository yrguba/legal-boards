import { lazy, Suspense, useEffect, useState } from 'react';
import type { TaskField } from '../types';
import type { ColumnTransitionInteractiveStep, TaskForColumnChecks } from '../utils/boardColumnActions';
import { FORMS_MICROAPP_ENABLED } from '../qiankun/formsMicroAppFeature';
import { ColumnActionTransitionModal } from './ColumnActionTransitionModal';

const LegalFormsColumnStep = FORMS_MICROAPP_ENABLED
  ? lazy(() => import('./LegalFormsColumnStep'))
  : null;

type Props = {
  open: boolean;
  steps: ColumnTransitionInteractiveStep[];
  task: TaskForColumnChecks | null;
  taskFields: TaskField[];
  targetColumnName?: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmitStep: (
    step: ColumnTransitionInteractiveStep,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  onAllComplete: () => Promise<void>;
};

export function ColumnTransitionModals({
  open,
  steps,
  task,
  taskFields,
  targetColumnName,
  submitting,
  error,
  onClose,
  onSubmitStep,
  onAllComplete,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open, steps]);

  const step = steps[stepIndex];

  if (!open || !step) return null;

  const phaseLabel =
    step.phase === 'enter'
      ? `Для перехода в «${targetColumnName || 'новый статус'}»`
      : 'Перед выходом из текущего статуса';

  const advance = async (payload: Record<string, unknown>) => {
    await onSubmitStep(step, payload);
    if (stepIndex >= steps.length - 1) {
      await onAllComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  if (step.rule.actionKind === 'legal_forms') {
    if (!FORMS_MICROAPP_ENABLED || !LegalFormsColumnStep || !task) {
      return (
        <ColumnActionTransitionModal
          open
          steps={[step]}
          targetColumnName={targetColumnName}
          submitting={false}
          error="Модуль Legal Forms временно отключён на сервере."
          onClose={onClose}
          onSubmitStep={async () => {}}
          onAllComplete={async () => {}}
        />
      );
    }

    return (
      <Suspense fallback={null}>
        <LegalFormsColumnStep
          step={step}
          stepIndex={stepIndex}
          stepsLength={steps.length}
          task={task}
          taskFields={taskFields}
          targetColumnName={targetColumnName}
          submitting={submitting}
          error={error}
          onClose={onClose}
          onComplete={(payload) => void advance(payload)}
        />
      </Suspense>
    );
  }

  return (
    <ColumnActionTransitionModal
      open
      steps={[step]}
      targetColumnName={targetColumnName}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmitStep={async (_s, payload) => {
        await advance(payload);
      }}
      onAllComplete={async () => {
        /* handled in advance */
      }}
    />
  );
}
