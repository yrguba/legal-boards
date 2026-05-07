import type { Board } from '../types';
import { mergeBoardAdvanced } from '../features/board-settings/boardAdvancedSettings.defaults';

/** Контроль времени включён, если заданы обе колонки (старт и финиш). */
export function boardTimeTrackingIsConfigured(board: Board | null | undefined): boolean {
  if (!board) return false;
  const tt = mergeBoardAdvanced(board.advancedSettings ?? {}).timeTracking!;
  return Boolean(tt.startColumnId && tt.stopColumnId);
}
