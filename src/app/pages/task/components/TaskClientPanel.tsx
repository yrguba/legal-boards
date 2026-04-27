import { Building2, History, Send } from 'lucide-react';
import { CLIENT_INTERACTION_KINDS } from '../constants';
import { t } from '../taskPage.classes';
import type { TaskClientPanelProps } from '../types';
import { formatDateTime } from '../utils/format';

export function TaskClientPanel(p: TaskClientPanelProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-200 p-3">
        <div className="mb-2 text-xs font-medium text-slate-500">Карточка клиента</div>
        <div className="text-sm font-semibold leading-snug text-slate-900">
          {p.clientInfo.fullName || 'ФИО не заполнено'}
        </div>
        <div className="mt-2 flex items-start gap-2 text-sm text-slate-700">
          <Building2 className="mt-0.5 size-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <div className="text-xs text-slate-500">Организация</div>
            <div className="mt-0.5 break-words text-slate-800">{p.clientInfo.organization || '—'}</div>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-slate-200">
        <div className="flex shrink-0">
          <button
            type="button"
            onClick={() => p.onClientSubPanel('chat')}
            className={t.tabButton(p.clientSubPanel === 'chat')}
          >
            Чат
          </button>
          <button
            type="button"
            onClick={() => p.onClientSubPanel('history')}
            className={t.tabButton(p.clientSubPanel === 'history')}
          >
            История
          </button>
        </div>
        {p.clientSubPanel === 'chat' ? (
          <>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {p.clientChatError ? (
                <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
                  {p.clientChatError}
                </div>
              ) : null}
              {p.clientPanelChat.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">Сообщений пока нет</div>
              ) : (
                p.clientPanelChat.map((m: any) => {
                  const fromClient = m.sender === 'client';
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[95%] rounded-lg px-3 py-2 text-sm ${
                        fromClient
                          ? 'ml-0 border border-slate-200 bg-slate-50 text-slate-800'
                          : 'ml-auto bg-brand text-white'
                      }`}
                    >
                      {!fromClient && m.user?.name ? (
                        <div
                          className={`mb-1 text-[10px] ${fromClient ? 'text-slate-500' : 'text-white/90'}`}
                        >
                          {m.user.name}
                        </div>
                      ) : null}
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      <div
                        className={`mt-1 text-[10px] ${
                          fromClient ? 'text-slate-400' : 'text-white/80'
                        }`}
                      >
                        {m.createdAt ? formatDateTime(m.createdAt) : ''}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="shrink-0 border-t border-slate-200 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={p.clientMessage}
                  onChange={(e) => p.onClientMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void p.onPostClientChat();
                  }}
                  placeholder="Сообщение клиенту…"
                  className={t.chatInput}
                />
                <button
                  type="button"
                  onClick={() => void p.onPostClientChat()}
                  disabled={!p.clientMessage.trim() || p.isPostingClientChat}
                  className={t.sendBtn}
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {p.clientInteractionList.length === 0 ? (
                <div className="py-6 text-center">
                  <History className="mx-auto mb-2 size-10 text-slate-300" />
                  <p className="text-sm text-slate-500">Пока нет записей</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Добавьте взаимодействие ниже — оно появится в списке
                  </p>
                </div>
              ) : (
                p.clientInteractionList.map((x: any) => (
                  <div key={x.id} className="rounded-lg border border-slate-200 bg-white p-3 text-left">
                    <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {CLIENT_INTERACTION_KINDS.find((k) => k.value === x.kind)?.label || x.kind}
                    </span>
                    <div className="mt-1 text-sm font-medium text-slate-900">{x.title}</div>
                    {x.details ? (
                      <div className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{x.details}</div>
                    ) : null}
                    <div className="mt-2 text-xs text-slate-500">
                      {x.occurredAt ? formatDateTime(x.occurredAt) : ''}
                      {x.user?.name ? ` · ${x.user.name}` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="shrink-0 space-y-2 border-t border-slate-200 p-3">
              {p.interactionError ? <div className="text-xs text-red-600">{p.interactionError}</div> : null}
              <select
                value={p.interactionKind}
                onChange={(e) => p.onInteractionKind(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {CLIENT_INTERACTION_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={p.interactionTitle}
                onChange={(e) => p.onInteractionTitle(e.target.value)}
                placeholder="Кратко, о чём контакт"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <textarea
                value={p.interactionDetails}
                onChange={(e) => p.onInteractionDetails(e.target.value)}
                rows={2}
                placeholder="Детали (необязательно)"
                className="w-full resize-none rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <input
                type="datetime-local"
                value={p.interactionOccurredAt}
                onChange={(e) => p.onInteractionOccurredAt(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <button
                type="button"
                onClick={() => void p.onSubmitInteraction()}
                disabled={p.isPostingInteraction || !p.interactionTitle.trim()}
                className="w-full rounded bg-brand py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {p.isPostingInteraction ? 'Сохранение…' : 'Добавить запись'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
