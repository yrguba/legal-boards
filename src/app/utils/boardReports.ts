export type BoardFunnelColumn = {
  columnId: string;
  columnName: string;
  position: number;
  taskCount: number;
  avgDaysInColumn: number;
};

export type BoardAgingTask = {
  taskId: string;
  title: string;
  columnId: string;
  columnName: string;
  daysInColumn: number;
  enteredAt: string;
  assigneeId: string | null;
  assigneeName: string | null;
};

export type BoardPendingApproval = {
  taskId: string;
  title: string;
  columnId: string;
  columnName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  pendingRules: { id: string; name: string }[];
};

export type BoardProcessMetrics = {
  doneColumnId: string;
  doneColumnName: string;
  periodDays: number;
  throughput: { created: number; completed: number };
  leadTime: { avgDays: number | null; medianDays: number | null; sampleSize: number };
  cycleTime: { avgDays: number | null; medianDays: number | null; sampleSize: number };
  inProgressCount: number;
  columnHeatmap: {
    columnId: string;
    columnName: string;
    avgDays: number;
    sampleSize: number;
  }[];
};

export type BoardApprovalAnalytics = {
  approved: number;
  rejected: number;
  rejectRate: number | null;
  medianWaitHours: number | null;
  topRejectReasons: { reason: string; count: number }[];
};

export type BoardDashboardReport = {
  boardId: string;
  boardName: string;
  workspaceId: string;
  generatedAt: string;
  filters: { assigneeId: string | null; agingDays: number; periodDays: number };
  funnel: BoardFunnelColumn[];
  aging: BoardAgingTask[];
  pendingApprovals: BoardPendingApproval[];
  processMetrics: BoardProcessMetrics | null;
  approvalAnalytics: BoardApprovalAnalytics;
  summary: {
    totalTasks: number;
    staleTasksCount: number;
    pendingApprovalsCount: number;
    inProgressCount: number | null;
    completedInPeriod: number | null;
  };
};
