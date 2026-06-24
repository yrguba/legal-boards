import { useState } from 'react';
import type { BoardColumnActionRule } from '../features/board-settings/boardAdvancedSettings.types';
import { boardsApi, tasksApi } from '../services/api';
import {
  forwardToBoardConfirmMessage,
  getForwardToBoardRulesForTransition,
  resolveForwardRuleLabels,
} from '../utils/boardColumnActions';
import type { Board } from '../types';
import { ConfirmAddToBoardDialog } from './ConfirmAddToBoardDialog';

export type ForwardToBoardOffer = {
  taskId: string;
  rule: BoardColumnActionRule;
  message: string;
  boardName: string;
};

export async function prepareForwardToBoardOffer(
  board: Board | null | undefined,
  taskId: string,
  fromColumnId: string,
  toColumnId: string,
): Promise<ForwardToBoardOffer | null> {
  const rules = getForwardToBoardRulesForTransition(board, fromColumnId, toColumnId);
  if (rules.length === 0) return null;

  const rule = rules[0];
  const labels = await resolveForwardRuleLabels(rule, async (boardId) => {
    try {
      const targetBoard = await boardsApi.getById(boardId);
      return targetBoard
        ? { name: targetBoard.name, columns: targetBoard.columns }
        : null;
    } catch {
      return null;
    }
  });

  return {
    taskId,
    rule,
    boardName: labels.boardName,
    message: forwardToBoardConfirmMessage(rule, labels),
  };
}

type Props = {
  offer: ForwardToBoardOffer | null;
  onClose: () => void;
  onAdded?: (taskId: string, created: boolean) => void;
};

export function ForwardToBoardOfferDialog({ offer, onClose, onAdded }: Props) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!offer) return;
    const targetBoardId = offer.rule.config.targetBoardId;
    if (!targetBoardId) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      const result = await tasksApi.addPlacement(offer.taskId, {
        boardId: targetBoardId,
        columnId: offer.rule.config.targetColumnId || undefined,
      });
      onAdded?.(offer.taskId, result.created);
      onClose();
    } catch {
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmAddToBoardDialog
      open={!!offer}
      onOpenChange={(open) => {
        if (!open && !loading) onClose();
      }}
      title={
        offer?.boardName && offer.boardName !== '—'
          ? `Добавить задачу на доску «${offer.boardName}»?`
          : 'Добавить задачу на другую доску?'
      }
      description={offer?.message ?? ''}
      confirmLabel="Добавить на доску"
      cancelLabel="Не сейчас"
      loading={loading}
      onConfirm={() => void handleConfirm()}
    />
  );
}
