import { useState } from 'react';
import type { Board, User } from '../types';
import { useApp } from '../store/AppContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { richEditorDialogHandlers } from './markdown';
import {
  TaskCreateFormFields,
  useTaskCreateForm,
  type TaskCreatePayload,
} from './TaskCreateFormFields';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: Board;
  columnId: string;
  users: User[];
  onSubmit: (data: TaskCreatePayload, pendingFiles: File[]) => Promise<void> | void;
}

export function CreateTaskModal({ isOpen, onClose, board, columnId, users, onSubmit }: CreateTaskModalProps) {
  const { currentUser } = useApp();
  const form = useTaskCreateForm(board);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    form.reset();
    setError(null);
    onClose();
  };

  const submit = async () => {
    setError(null);
    const validationError = form.validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(form.buildPayload(), form.pendingFiles);
      handleClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось создать задачу');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="flex max-h-[min(90vh,calc(100dvh-2rem))] flex-col gap-4 overflow-hidden sm:max-w-2xl"
        {...richEditorDialogHandlers}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Создать задачу</DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto overscroll-contain px-2 py-2 pb-4 [-webkit-overflow-scrolling:touch]">
          <TaskCreateFormFields
            form={form}
            users={users}
            authorName={currentUser?.name}
            board={board}
            key={`${board.id}-${columnId}`}
          />
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
            disabled={isSubmitting || !form.canSubmit}
          >
            Создать
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
