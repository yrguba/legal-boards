import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquarePlus, Paperclip } from 'lucide-react';
import { feedbackApi, ApiError, type FeedbackTicket } from '../services/api';
import { getApiBaseUrl } from '../pages/task/utils/apiBaseUrl';
import { filePublicUrl } from '../pages/task/utils/documentPaths';
import { FeedbackModal } from './FeedbackModal';

function statusBadgeClass(status: string) {
  if (status === 'resolved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'in_progress') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'closed') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MyFeedbackPanel() {
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await feedbackApi.listMine();
      setTickets(data.tickets);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить обращения');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 5000);
    return () => window.clearTimeout(t);
  }, [success]);

  const apiBaseUrl = getApiBaseUrl();

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Мои обращения</h2>
          <p className="text-sm text-slate-600 mt-1">
            История ваших сообщений об ошибках, улучшениях и вопросах.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
        >
          <MessageSquarePlus className="size-4" />
          Новое обращение
        </button>
      </div>

      {success ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Загрузка…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
          <p className="text-sm text-slate-600">Пока нет обращений.</p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-3 text-sm font-medium text-brand hover:underline"
          >
            Отправить первое сообщение
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {tickets.map((ticket) => {
            const expanded = expandedId === ticket.id;
            return (
              <div key={ticket.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : ticket.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-slate-500">#{ticket.shortId}</span>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(ticket.status)}`}
                      >
                        {ticket.statusLabel}
                      </span>
                      <span className="text-xs text-slate-500">{ticket.categoryLabel}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-900">{ticket.subject}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDate(ticket.createdAt)}</p>
                  </div>
                </button>
                {expanded ? (
                  <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
                    {ticket.workspace?.name ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Пространство: {ticket.workspace.name}
                      </p>
                    ) : null}
                    {ticket.pageUrl ? (
                      <p className="mt-1 text-xs text-slate-500 break-all">Страница: {ticket.pageUrl}</p>
                    ) : null}
                    {ticket.attachments.length > 0 ? (
                      <ul className="mt-3 space-y-1">
                        {ticket.attachments.map((att) => {
                          const href = filePublicUrl(apiBaseUrl, att.path);
                          return (
                            <li key={att.id}>
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
                                >
                                  <Paperclip className="size-3.5" />
                                  {att.name}
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                                  <Paperclip className="size-3.5" />
                                  {att.name}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <FeedbackModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmitted={(message) => {
          setSuccess(message);
          void loadTickets();
        }}
      />
    </div>
  );
}
