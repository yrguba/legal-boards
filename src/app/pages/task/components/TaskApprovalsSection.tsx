import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { BoardApprovalRule } from '../../../features/board-settings/boardAdvancedSettings.types';
import type { TaskColumnApprovalRow } from '../../../utils/boardApprovals';
import {
  canUserApproveRule,
  getCompletedApprovalsForColumn,
  getDecisionForRule,
  getPendingApprovalRules,
  isApprovalRejected,
} from '../../../utils/boardApprovals';

export function TaskApprovalsSection({
  columnId,
  rules,
  approvals,
  currentUserId,
  processingRuleId,
  approvalError,
  onApprove,
  onReject,
}: {
  columnId: string;
  rules: BoardApprovalRule[];
  approvals: TaskColumnApprovalRow[];
  currentUserId: string | undefined;
  processingRuleId: string | null;
  approvalError: string | null;
  onApprove: (ruleId: string) => void;
  onReject: (ruleId: string, reason: string) => void | Promise<void>;
}) {
  const pending = getPendingApprovalRules(rules, columnId, approvals);
  const completed = getCompletedApprovalsForColumn(rules, columnId, approvals);
  const [rejectingRuleId, setRejectingRuleId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectFormError, setRejectFormError] = useState<string | null>(null);

  if (pending.length === 0 && completed.length === 0) return null;

  const formatWhen = (iso: string) => {
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
  };

  const openRejectForm = (ruleId: string) => {
    setRejectFormError(null);
    setRejectReason('');
    setRejectingRuleId(ruleId);
  };

  const cancelRejectForm = () => {
    setRejectFormError(null);
    setRejectReason('');
    setRejectingRuleId(null);
  };

  const submitReject = async (ruleId: string) => {
    const reason = rejectReason.trim();
    if (!reason) {
      setRejectFormError('Укажите причину отклонения');
      return;
    }
    try {
      await onReject(ruleId, reason);
      cancelRejectForm();
    } catch {
      /* ошибка показана в approvalError */
    }
  };

  return (
    <div className="col-span-2 border-t border-slate-200 pt-4 mt-2">
      <h3 className="text-sm font-medium text-slate-900 mb-3">Согласования</h3>

      {approvalError ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {approvalError}
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="mb-3 space-y-2">
          <p className="text-xs text-slate-500">
            Для перевода задачи в другой статус необходимо получить все согласования ниже.
          </p>
          {pending.map((rule) => {
            const canDecide = canUserApproveRule(rule, currentUserId);
            const isProcessing = processingRuleId === rule.id;
            const decision = getDecisionForRule(approvals, columnId, rule.id);
            const isRejected = decision ? isApprovalRejected(decision) : false;
            const showRejectForm = rejectingRuleId === rule.id;

            return (
              <div
                key={rule.id}
                className={`rounded-lg border px-3 py-2 ${
                  isRejected
                    ? 'border-red-200 bg-red-50/60'
                    : 'border-amber-200 bg-amber-50/60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">
                      {rule.name.trim() || 'Согласование'}
                    </div>
                    <div className={`text-xs ${isRejected ? 'text-red-700' : 'text-slate-500'}`}>
                      {isRejected ? 'Отклонено' : 'Ожидает согласования'}
                    </div>
                    {isRejected && decision?.reason ? (
                      <div className="mt-1 text-xs text-red-800 whitespace-pre-wrap">
                        Причина: {decision.reason}
                      </div>
                    ) : null}
                    {isRejected && decision ? (
                      <div className="mt-1 text-xs text-red-700/80">
                        {decision.approver?.name || '—'}
                        {decision.updatedAt || decision.createdAt
                          ? ` · ${formatWhen(decision.updatedAt || decision.createdAt)}`
                          : ''}
                      </div>
                    ) : null}
                  </div>
                  {canDecide && !showRejectForm ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={!!processingRuleId}
                        onClick={() => onApprove(rule.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Согласовать
                      </button>
                      <button
                        type="button"
                        disabled={!!processingRuleId}
                        onClick={() => openRejectForm(rule.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Отклонить
                      </button>
                    </div>
                  ) : null}
                </div>

                {canDecide && showRejectForm ? (
                  <div className="mt-3 border-t border-red-200/80 pt-3">
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Причина отклонения
                    </label>
                    <textarea
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => {
                        setRejectReason(e.target.value);
                        if (rejectFormError) setRejectFormError(null);
                      }}
                      placeholder="Опишите, что необходимо исправить"
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    />
                    {rejectFormError ? (
                      <p className="mt-1 text-xs text-red-600">{rejectFormError}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!!processingRuleId}
                        onClick={() => void submitReject(rule.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Подтвердить отклонение
                      </button>
                      <button
                        type="button"
                        disabled={!!processingRuleId}
                        onClick={cancelRejectForm}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {completed.length > 0 ? (
        <div className="space-y-2">
          {completed.map((row) => (
            <div
              key={row.id}
              className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">
                  {row.ruleName?.trim() || 'Согласование'}
                </div>
                <div className="text-xs text-emerald-800">
                  Согласовано: {row.approver?.name || '—'}
                  {row.createdAt ? ` · ${formatWhen(row.createdAt)}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
