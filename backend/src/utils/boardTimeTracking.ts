export type BoardTimeTrackingCfg = {
  startColumnId: string;
  stopColumnId: string;
  ignoreIds: Set<string>;
};

export function parseBoardTimeTrackingCfg(advancedSettings: unknown): BoardTimeTrackingCfg | null {
  const root =
    advancedSettings && typeof advancedSettings === 'object'
      ? (advancedSettings as Record<string, unknown>)
      : {};
  const tt =
    root.timeTracking && typeof root.timeTracking === 'object'
      ? (root.timeTracking as Record<string, unknown>)
      : {};

  let startColumnId = typeof tt.startColumnId === 'string' ? tt.startColumnId : '';
  let stopColumnId = typeof tt.stopColumnId === 'string' ? tt.stopColumnId : '';
  if (!startColumnId && Array.isArray(tt.startColumnIds) && typeof tt.startColumnIds[0] === 'string') {
    startColumnId = tt.startColumnIds[0];
  }
  if (!stopColumnId && Array.isArray(tt.stopColumnIds) && typeof tt.stopColumnIds[0] === 'string') {
    stopColumnId = tt.stopColumnIds[0];
  }

  const ignoreIds = new Set<string>();
  if (Array.isArray(tt.ignoreColumnIds)) {
    for (const x of tt.ignoreColumnIds) {
      if (typeof x === 'string') ignoreIds.add(x);
    }
  }

  if (!startColumnId || !stopColumnId) return null;
  return { startColumnId, stopColumnId, ignoreIds };
}

function columnCountsTowardTime(columnId: string, cfg: BoardTimeTrackingCfg): boolean {
  if (columnId === cfg.stopColumnId) return false;
  if (cfg.ignoreIds.has(columnId)) return false;
  return true;
}

export type TaskTimeTrackingState = {
  trackedTimeSeconds: number;
  timeTrackingActiveSince: Date | null;
  timeTrackingCycleOpen: boolean;
};

export function applyTimeTrackingColumnMove(
  state: TaskTimeTrackingState,
  fromColumnId: string,
  toColumnId: string,
  cfg: BoardTimeTrackingCfg,
  now: Date,
): TaskTimeTrackingState {
  let trackedTimeSeconds = state.trackedTimeSeconds;
  let timeTrackingActiveSince = state.timeTrackingActiveSince;
  let timeTrackingCycleOpen = state.timeTrackingCycleOpen;

  if (timeTrackingActiveSince && columnCountsTowardTime(fromColumnId, cfg)) {
    const deltaSec = Math.floor((now.getTime() - timeTrackingActiveSince.getTime()) / 1000);
    trackedTimeSeconds += Math.max(0, deltaSec);
  }
  timeTrackingActiveSince = null;

  if (toColumnId === cfg.startColumnId) {
    timeTrackingCycleOpen = true;
  } else if (toColumnId === cfg.stopColumnId && timeTrackingCycleOpen) {
    timeTrackingCycleOpen = false;
  }

  if (timeTrackingCycleOpen && columnCountsTowardTime(toColumnId, cfg)) {
    timeTrackingActiveSince = now;
  }

  return {
    trackedTimeSeconds,
    timeTrackingActiveSince,
    timeTrackingCycleOpen,
  };
}

export function applyTimeTrackingOnTaskCreate(
  columnId: string,
  cfg: BoardTimeTrackingCfg | null,
  now: Date,
): TaskTimeTrackingState {
  if (!cfg) {
    return {
      trackedTimeSeconds: 0,
      timeTrackingActiveSince: null,
      timeTrackingCycleOpen: false,
    };
  }

  let timeTrackingCycleOpen = false;
  let timeTrackingActiveSince: Date | null = null;

  if (columnId === cfg.startColumnId) {
    timeTrackingCycleOpen = true;
  }

  if (columnId === cfg.stopColumnId && timeTrackingCycleOpen) {
    timeTrackingCycleOpen = false;
    timeTrackingActiveSince = null;
  } else if (timeTrackingCycleOpen && columnCountsTowardTime(columnId, cfg)) {
    timeTrackingActiveSince = now;
  }

  return {
    trackedTimeSeconds: 0,
    timeTrackingActiveSince,
    timeTrackingCycleOpen,
  };
}
