import { Bot, MessageSquare, Send } from 'lucide-react';
import { t } from '../taskPage.classes';
import type { TaskSidePanelsProps, TaskPanelType } from '../types';
import { formatDateTime } from '../utils/format';
import { TaskDocumentsPanel } from './TaskDocumentsPanel';

function ChatFooter(p: {
  activePanel: TaskPanelType;
  commentText: string;
  assistantMessage: string;
  assistantChatError: string | null;
  isPostingComment: boolean;
  isPostingAssistant: boolean;
  onCommentText: (v: string) => void;
  onAssistantMessage: (v: string) => void;
  onPostComment: () => void;
  onPostAssistant: () => void;
}) {
  if (p.activePanel !== 'comments' && p.activePanel !== 'assistant') return null;
  return (
    <div className="shrink-0 border-t border-slate-200 p-4">
      {p.activePanel === 'assistant' && p.assistantChatError ? (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
          {p.assistantChatError}
        </div>
      ) : null}
      <div className="flex gap-2">
        <input
          type="text"
          value={p.activePanel === 'comments' ? p.commentText : p.assistantMessage}
          onChange={(e) =>
            p.activePanel === 'comments' ? p.onCommentText(e.target.value) : p.onAssistantMessage(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            if (p.activePanel === 'comments') void p.onPostComment();
            else void p.onPostAssistant();
          }}
          placeholder={p.activePanel === 'comments' ? 'Написать комментарий…' : 'Сообщение ассистенту…'}
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="button"
          onClick={() =>
            p.activePanel === 'comments' ? void p.onPostComment() : void p.onPostAssistant()
          }
          disabled={
            p.activePanel === 'comments'
              ? !p.commentText.trim() || p.isPostingComment
              : !p.assistantMessage.trim() || p.isPostingAssistant
          }
          className="rounded bg-brand px-3 py-2 text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function TaskSidePanels(p: TaskSidePanelsProps) {
  const { activePanel, task } = p;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activePanel === 'documents' ? (
          <TaskDocumentsPanel
            documents={p.workspaceDocuments}
            loading={p.documentsLoading}
            error={p.documentsError}
            apiBaseUrl={p.apiBaseUrl}
            onPreviewDoc={p.onPreviewDoc}
          />
        ) : activePanel === 'comments' ? (
          <div className="space-y-3">
            {(task.comments || []).length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Пока нет комментариев</p>
              </div>
            ) : (
              (task.comments || []).map((c: any) => (
                <div key={c.id} className="rounded-lg border border-slate-200 p-3 bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-brand-light flex items-center justify-center">
                      <span className="text-xs font-medium text-brand">{c.user?.name?.charAt(0) || 'U'}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {c.user?.name || 'Пользователь'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {c.createdAt ? formatDateTime(c.createdAt) : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{c.content}</div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {p.assistantPanelChat.length === 0 ? (
              <div className="py-8 text-center">
                <Bot className="mx-auto mb-3 size-12 text-slate-300" />
                <p className="text-sm text-slate-500">Сообщений пока нет</p>
              </div>
            ) : (
              p.assistantPanelChat.map((m: any) => (
                <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light">
                      <span className="text-xs font-medium text-brand">
                        {m.user?.name?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {m.user?.name || 'Пользователь'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {m.createdAt ? formatDateTime(m.createdAt) : ''}
                      </div>
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-slate-700">{m.content}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <ChatFooter
        activePanel={activePanel}
        commentText={p.commentText}
        assistantMessage={p.assistantMessage}
        assistantChatError={p.assistantChatError}
        isPostingComment={p.isPostingComment}
        isPostingAssistant={p.isPostingAssistant}
        onCommentText={p.onCommentText}
        onAssistantMessage={p.onAssistantMessage}
        onPostComment={p.onPostComment}
        onPostAssistant={p.onPostAssistant}
      />
    </>
  );
}
