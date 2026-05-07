import type { Board } from '../../../types';
import type { BoardIframeService } from '../../../features/board-settings/boardAdvancedSettings.types';
import { mergeBoardAdvanced } from '../../../features/board-settings/boardAdvancedSettings.defaults';
import type { TaskPanelType } from '../types';

export function getBoardIframeServices(board: Board | null | undefined): BoardIframeService[] {
  if (!board) return [];
  const list = mergeBoardAdvanced(board.advancedSettings ?? {}).iframeServices ?? [];
  return list.filter((s) => {
    if (!s?.url?.trim()) return false;
    try {
      const u = new URL(s.url.trim());
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  });
}

export function taskIframePanelId(serviceId: string): TaskPanelType {
  return `iframe:${serviceId}`;
}

export function parseIframePanelId(panel: TaskPanelType): string | null {
  if (!panel.startsWith('iframe:')) return null;
  return panel.slice('iframe:'.length);
}
