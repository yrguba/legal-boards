import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, BarChart3, ClipboardCheck, Clock, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { canManageWorkspace } from '../utils/workspacePermissions';
import { boardsApi, reportsApi, usersApi } from '../services/api';
import type { Board } from '../types';
import type { BoardDashboardReport } from '../utils/boardReports';

const AGING_OPTIONS = [
  { value: 3, label: '3+ дней' },
  { value: 7, label: '7+ дней' },
  { value: 14, label: '14+ дней' },
];

const PERIOD_OPTIONS = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
];

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function Analytics() {
  const { currentWorkspace } = useApp();
  const canView = canManageWorkspace(currentWorkspace);

  const [boards, setBoards] = useState<Board[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [boardId, setBoardId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [agingDays, setAgingDays] = useState(7);
  const [periodDays, setPeriodDays] = useState(30);
  const [report, setReport] = useState<BoardDashboardReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView || !currentWorkspace?.id) return;
    let cancelled = false;
    Promise.all([
      boardsApi.getByWorkspace(currentWorkspace.id),
      usersApi.getAll(),
    ])
      .then(([b, u]) => {
        if (cancelled) return;
        const list = (b || []) as Board[];
        setBoards(list);
        setUsers((u || []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
        if (!boardId && list[0]?.id) setBoardId(list[0].id);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить список досок');
      });
    return () => {
      cancelled = true;
    };
  }, [canView, currentWorkspace?.id]);

  const loadReport = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await reportsApi.getBoardDashboard(boardId, {
        agingDays,
        periodDays,
        assigneeId: assigneeId || undefined,
      });
      setReport(data);
    } catch (e: unknown) {
      setReport(null);
      setError(e instanceof Error ? e.message : 'Не удалось загрузить отчёт');
    } finally {
      setLoading(false);
    }
  }, [boardId, agingDays, periodDays, assigneeId]);

  useEffect(() => {
    if (!canView || !boardId) return;
    void loadReport();
  }, [canView, boardId, loadReport]);

  const maxFunnelCount = useMemo(() => {
    if (!report?.funnel.length) return 1;
    return Math.max(1, ...report.funnel.map((c) => c.taskCount));
  }, [report?.funnel]);

  const maxHeatmapDays = useMemo(() => {
    const hm = report?.processMetrics?.columnHeatmap ?? [];
    if (hm.length === 0) return 1;
    return Math.max(1, ...hm.map((c) => c.avgDays));
  }, [report?.processMetrics?.columnHeatmap]);

  if (!canView) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center">
          <BarChart3 className="mx-auto mb-3 size-10 text-slate-300" aria-hidden />
          <h1 className="text-lg font-semibold text-slate-900">Аналитика</h1>
          <p className="mt-2 text-sm text-slate-600">
            Раздел доступен владельцу пространства, администратору и руководителю.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Аналитика</h1>
            <p className="mt-0.5 text-sm text-slate-600">
              {currentWorkspace?.name} — операционный срез по доске
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={loading || !boardId}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Обновить
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <label className="min-w-[200px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Доска</span>
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[180px]">
            <span className="mb-1 block text-xs font-medium text-slate-600">Исполнитель</span>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Все</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[140px]">
            <span className="mb-1 block text-xs font-medium text-slate-600">Застряли</span>
            <select
              value={agingDays}
              onChange={(e) => setAgingDays(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {AGING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[140px]">
            <span className="mb-1 block text-xs font-medium text-slate-600">Период</span>
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading && !report ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
            Формирование отчёта…
          </div>
        ) : report ? (
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Задач на доске</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{report.summary.totalTasks}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-800">В работе</p>
                <p className="mt-1 text-2xl font-semibold text-blue-900">
                  {report.processMetrics?.inProgressCount ?? '—'}
                </p>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-violet-800">
                  Завершено за {periodDays} дн.
                </p>
                <p className="mt-1 text-2xl font-semibold text-violet-900">
                  {report.summary.completedInPeriod ?? '—'}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Застряли</p>
                <p className="mt-1 text-2xl font-semibold text-amber-900">
                  {report.summary.staleTasksCount}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                  Ждут согласования
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-900">
                  {report.summary.pendingApprovalsCount}
                </p>
              </div>
            </div>

            {report.processMetrics ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <TrendingUp className="size-4 text-brand" aria-hidden />
                  Lead time и cycle time
                </h2>
                <p className="mb-4 text-xs text-slate-500">
                  «Готово» — колонка «{report.processMetrics.doneColumnName}». Cycle time не учитывает
                  колонки из списка исключений учёта времени.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">Lead time (медиана)</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {report.processMetrics.leadTime.medianDays != null
                        ? `${report.processMetrics.leadTime.medianDays} дн.`
                        : '—'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      n={report.processMetrics.leadTime.sampleSize}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">Lead time (среднее)</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {report.processMetrics.leadTime.avgDays != null
                        ? `${report.processMetrics.leadTime.avgDays} дн.`
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">Cycle time (медиана)</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {report.processMetrics.cycleTime.medianDays != null
                        ? `${report.processMetrics.cycleTime.medianDays} дн.`
                        : '—'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      n={report.processMetrics.cycleTime.sampleSize}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">Создано за период</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {report.processMetrics.throughput.created}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {report.processMetrics && report.processMetrics.columnHeatmap.some((c) => c.sampleSize > 0) ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Clock className="size-4 text-slate-600" aria-hidden />
                  Среднее время в колонках
                </h2>
                <div className="space-y-3">
                  {report.processMetrics.columnHeatmap
                    .filter((c) => c.sampleSize > 0)
                    .map((col) => (
                      <div key={col.columnId}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium text-slate-800">{col.columnName}</span>
                          <span className="shrink-0 text-slate-500">
                            ср. {col.avgDays} дн. · n={col.sampleSize}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-violet-500 transition-all"
                            style={{ width: `${(col.avgDays / maxHeatmapDays) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ClipboardCheck className="size-4 text-teal-600" aria-hidden />
                Согласования за {periodDays} дн.
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-emerald-50 px-3 py-2">
                  <p className="text-xs text-emerald-800">Согласовано</p>
                  <p className="text-lg font-semibold text-emerald-900">
                    {report.approvalAnalytics.approved}
                  </p>
                </div>
                <div className="rounded-lg bg-red-50 px-3 py-2">
                  <p className="text-xs text-red-800">Отклонено</p>
                  <p className="text-lg font-semibold text-red-900">
                    {report.approvalAnalytics.rejected}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Reject rate</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {report.approvalAnalytics.rejectRate != null
                      ? `${report.approvalAnalytics.rejectRate}%`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Медиана ожидания</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {report.approvalAnalytics.medianWaitHours != null
                      ? `${report.approvalAnalytics.medianWaitHours} ч`
                      : '—'}
                  </p>
                </div>
              </div>
              {report.approvalAnalytics.topRejectReasons.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-slate-600">Частые причины отклонения</p>
                  <ul className="space-y-1">
                    {report.approvalAnalytics.topRejectReasons.map((r) => (
                      <li
                        key={r.reason}
                        className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-sm"
                      >
                        <span className="text-slate-700">{r.reason}</span>
                        <span className="text-slate-500">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <BarChart3 className="size-4 text-brand" aria-hidden />
                Воронка по колонкам
              </h2>
              {report.funnel.length === 0 ? (
                <p className="text-sm text-slate-500">Нет колонок на доске.</p>
              ) : (
                <div className="space-y-3">
                  {report.funnel.map((col) => (
                    <div key={col.columnId}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-800">{col.columnName}</span>
                        <span className="shrink-0 text-slate-500">
                          {col.taskCount} · ср. {col.avgDaysInColumn} дн.
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${(col.taskCount / maxFunnelCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">
                Обновлено: {formatDateTime(report.generatedAt)}
              </p>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <AlertTriangle className="size-4 text-amber-600" aria-hidden />
                Застрявшие задачи ({agingDays}+ дней в колонке)
              </h2>
              {report.aging.length === 0 ? (
                <p className="text-sm text-slate-500">Нет задач с превышением порога.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs text-slate-500">
                        <th className="pb-2 pr-3 font-medium">Задача</th>
                        <th className="pb-2 pr-3 font-medium">Колонка</th>
                        <th className="pb-2 pr-3 font-medium">Дней</th>
                        <th className="pb-2 font-medium">Исполнитель</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.aging.map((row) => (
                        <tr key={row.taskId} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 pr-3">
                            <Link
                              to={`/task/${row.taskId}`}
                              className="font-medium text-brand hover:underline"
                            >
                              {row.title}
                            </Link>
                          </td>
                          <td className="py-2 pr-3 text-slate-600">{row.columnName}</td>
                          <td className="py-2 pr-3 font-medium text-amber-700">{row.daysInColumn}</td>
                          <td className="py-2 text-slate-600">{row.assigneeName ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ClipboardCheck className="size-4 text-emerald-600" aria-hidden />
                Ожидают согласования
              </h2>
              {report.pendingApprovals.length === 0 ? (
                <p className="text-sm text-slate-500">Все согласования по текущим колонкам получены.</p>
              ) : (
                <div className="space-y-3">
                  {report.pendingApprovals.map((row) => (
                    <div
                      key={row.taskId}
                      className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <Link
                            to={`/task/${row.taskId}`}
                            className="font-medium text-brand hover:underline"
                          >
                            {row.title}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {row.columnName}
                            {row.assigneeName ? ` · ${row.assigneeName}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {row.pendingRules.map((rule) => (
                          <span
                            key={rule.id}
                            className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200"
                          >
                            {rule.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
