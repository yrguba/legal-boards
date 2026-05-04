import { useState } from 'react';
import { Building2, History, Mail, MessageSquare, Phone, Plus, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { CLIENT_INTERACTION_KINDS } from '../constants';
import { t } from '../taskPage.classes';
import type { TaskClientPanelProps } from '../types';
import { formatDateTime } from '../utils/format';

function ClientContactRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="mt-2 flex items-start gap-2 text-sm text-slate-700">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-0.5 break-words text-slate-800">{value}</div>
      </div>
    </div>
  );
}

export function TaskClientPanel(p: TaskClientPanelProps) {
  const { clientInfo } = p;
  const [interactionModalOpen, setInteractionModalOpen] = useState(false);

  const submitFromModal = async () => {
    const ok = await p.onSubmitInteraction();
    if (ok) setInteractionModalOpen(false);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-200 p-3">
        <div className="mb-2 text-xs font-medium text-slate-500">Карточка клиента</div>
        <div className="text-sm font-semibold leading-snug text-slate-900">
          {clientInfo.fullName || 'ФИО не заполнено'}
        </div>
        <div className="mt-2 flex items-start gap-2 text-sm text-slate-700">
          <Building2 className="mt-0.5 size-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <div className="text-xs text-slate-500">Организация</div>
            <div className="mt-0.5 break-words text-slate-800">{clientInfo.organization || '—'}</div>
          </div>
        </div>
        {clientInfo.email ? (
          <ClientContactRow icon={Mail} label="Email" value={clientInfo.email} />
        ) : null}
        {clientInfo.phone ? (
          <ClientContactRow icon={Phone} label="Телефон" value={clientInfo.phone} />
        ) : null}
        {clientInfo.contactNotes ? (
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <MessageSquare className="size-3.5 text-brand" aria-hidden />
              Комментарий клиента
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{clientInfo.contactNotes}</p>
          </div>
        ) : null}
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
            <p className="shrink-0 px-3 pt-2 text-[11px] leading-snug text-slate-500">
              Канал переписки с клиентом (LEXPRO и др.).
            </p>
            <div className="min-h-0 flex-1 overflow-hidden px-3 pb-2 pt-1">
              <div className="flex h-full min-h-[120px] flex-col gap-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3">
                {p.clientChatError ? (
                  <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
                    {p.clientChatError}
                  </div>
                ) : null}
                {p.clientPanelChat.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center py-6 text-center text-sm text-slate-500">
                    Сообщений пока нет
                  </div>
                ) : (
                  p.clientPanelChat.map((m: any) => {
                    const fromClient = Boolean(m.lexClientUserId) || m.sender === 'client';
                    return (
                      <div
                        key={m.id}
                        className={`flex w-full ${fromClient ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            fromClient
                              ? 'border border-slate-200 bg-white text-slate-800'
                              : 'bg-brand text-white shadow-sm'
                          }`}
                        >
                          {!fromClient && m.user?.name ? (
                            <div
                              className={`mb-1 text-[10px] ${fromClient ? 'text-slate-500' : 'text-white/90'}`}
                            >
                              {m.user.name}
                            </div>
                          ) : null}
                          {fromClient ? (
                            <div className="mb-1 text-[10px] text-slate-500">Клиент</div>
                          ) : null}
                          <div className="whitespace-pre-wrap">{m.content}</div>
                          <div
                            className={`mt-1 text-[10px] ${
                              fromClient ? 'text-slate-400' : 'text-white/75'
                            }`}
                          >
                            {m.createdAt ? formatDateTime(m.createdAt) : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
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
                  aria-label="Отправить"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 justify-end border-b border-slate-100 px-3 py-2">
              <button
                type="button"
                onClick={() => setInteractionModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
              >
                <Plus className="size-3.5" aria-hidden />
                Добавить запись
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {p.clientInteractionList.length === 0 ? (
                <div className="py-6 text-center">
                  <History className="mx-auto mb-2 size-10 text-slate-300" />
                  <p className="text-sm text-slate-500">Пока нет записей</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Нажмите «Добавить запись», чтобы зафиксировать звонок, встречу или заметку
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

            <Dialog
              open={interactionModalOpen}
              onOpenChange={(open) => {
                setInteractionModalOpen(open);
                if (open) p.onClearInteractionError();
              }}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Новая запись в истории</DialogTitle>
                  <DialogDescription>
                    Зафиксируйте контакт с клиентом — запись видна в карточке задачи у всей команды.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  {p.interactionError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {p.interactionError}
                    </div>
                  ) : null}
                  <div>
                    <label htmlFor="interaction-kind" className="mb-1 block text-xs font-medium text-slate-600">
                      Тип
                    </label>
                    <select
                      id="interaction-kind"
                      value={p.interactionKind}
                      onChange={(e) => p.onInteractionKind(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                    >
                      {CLIENT_INTERACTION_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="interaction-title" className="mb-1 block text-xs font-medium text-slate-600">
                      Заголовок
                    </label>
                    <input
                      id="interaction-title"
                      type="text"
                      value={p.interactionTitle}
                      onChange={(e) => p.onInteractionTitle(e.target.value)}
                      placeholder="Кратко, о чём контакт"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                    />
                  </div>
                  <div>
                    <label htmlFor="interaction-details" className="mb-1 block text-xs font-medium text-slate-600">
                      Детали (необязательно)
                    </label>
                    <textarea
                      id="interaction-details"
                      value={p.interactionDetails}
                      onChange={(e) => p.onInteractionDetails(e.target.value)}
                      rows={3}
                      placeholder="Подробности разговора или договорённости"
                      className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                    />
                  </div>
                  <div>
                    <label htmlFor="interaction-at" className="mb-1 block text-xs font-medium text-slate-600">
                      Дата и время события
                    </label>
                    <input
                      id="interaction-at"
                      type="datetime-local"
                      value={p.interactionOccurredAt}
                      onChange={(e) => p.onInteractionOccurredAt(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <button
                    type="button"
                    onClick={() => setInteractionModalOpen(false)}
                    disabled={p.isPostingInteraction}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitFromModal()}
                    disabled={p.isPostingInteraction || !p.interactionTitle.trim()}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {p.isPostingInteraction ? 'Сохранение…' : 'Сохранить'}
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
}
