import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ColumnTransitionModals } from '../components/ColumnTransitionModals';
import type { TaskField } from '../types';
import type {
  ColumnTransitionInteractiveStep,
  TaskForColumnChecks,
} from '../utils/boardColumnActions';

export type ColumnTransitionOpenParams = {
  task: TaskForColumnChecks | null;
  taskFields: TaskField[];
  targetColumnName?: string;
  steps: ColumnTransitionInteractiveStep[];
  onSubmitStep: (
    step: ColumnTransitionInteractiveStep,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  onAllComplete: () => Promise<void>;
  onCancel?: () => void;
};

type ColumnTransitionContextValue = {
  openColumnTransition: (params: ColumnTransitionOpenParams) => void;
  closeColumnTransition: () => void;
  isColumnTransitionOpen: boolean;
};

const ColumnTransitionContext = createContext<ColumnTransitionContextValue | null>(null);

export function ColumnTransitionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ColumnTransitionOpenParams | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeColumnTransition = useCallback(() => {
    if (submitting) return;
    session?.onCancel?.();
    setSession(null);
    setError(null);
  }, [session, submitting]);

  const openColumnTransition = useCallback((params: ColumnTransitionOpenParams) => {
    setError(null);
    setSubmitting(false);
    setSession(params);
  }, []);

  const value = useMemo(
    () => ({
      openColumnTransition,
      closeColumnTransition,
      isColumnTransitionOpen: session != null,
    }),
    [openColumnTransition, closeColumnTransition, session],
  );

  return (
    <ColumnTransitionContext.Provider value={value}>
      {children}
      <ColumnTransitionModals
        open={session != null}
        steps={session?.steps ?? []}
        task={session?.task ?? null}
        taskFields={session?.taskFields ?? []}
        targetColumnName={session?.targetColumnName}
        submitting={submitting}
        error={error}
        onClose={closeColumnTransition}
        onSubmitStep={async (step, payload) => {
          if (!session) return;
          setSubmitting(true);
          setError(null);
          try {
            await session.onSubmitStep(step, payload);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Не удалось выполнить действие';
            setError(msg);
            throw e;
          } finally {
            setSubmitting(false);
          }
        }}
        onAllComplete={async () => {
          if (!session) return;
          setSubmitting(true);
          setError(null);
          try {
            await session.onAllComplete();
            setSession(null);
            setError(null);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Не удалось перевести задачу';
            setError(msg);
            throw e;
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </ColumnTransitionContext.Provider>
  );
}

export function useColumnTransition() {
  const ctx = useContext(ColumnTransitionContext);
  if (!ctx) {
    throw new Error('useColumnTransition must be used within ColumnTransitionProvider');
  }
  return ctx;
}
