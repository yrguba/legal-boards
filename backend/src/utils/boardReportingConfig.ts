import { parseBoardTimeTrackingCfg } from './boardTimeTracking';

export type BoardReportingCfg = {
  doneColumnId: string;
  doneColumnName: string;
  ignoreColumnIds: Set<string>;
};

export function parseBoardReportingCfg(
  advancedSettings: unknown,
  columns: { id: string; name: string; position: number }[],
): BoardReportingCfg | null {
  if (columns.length === 0) return null;

  const root =
    advancedSettings && typeof advancedSettings === 'object'
      ? (advancedSettings as Record<string, unknown>)
      : {};
  const reporting =
    root.reporting && typeof root.reporting === 'object'
      ? (root.reporting as Record<string, unknown>)
      : {};

  const ttCfg = parseBoardTimeTrackingCfg(advancedSettings);
  let doneColumnId =
    typeof reporting.doneColumnId === 'string' ? reporting.doneColumnId.trim() : '';
  if (!doneColumnId && ttCfg?.stopColumnId) {
    doneColumnId = ttCfg.stopColumnId;
  }
  if (!doneColumnId) {
    const sorted = [...columns].sort((a, b) => b.position - a.position);
    doneColumnId = sorted[0]?.id ?? '';
  }

  const doneCol = columns.find((c) => c.id === doneColumnId);
  if (!doneCol) return null;

  const ignoreColumnIds = new Set(ttCfg?.ignoreIds ?? []);
  return {
    doneColumnId: doneCol.id,
    doneColumnName: doneCol.name,
    ignoreColumnIds,
  };
}
