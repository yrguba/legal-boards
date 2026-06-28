import { useRef } from 'react';
import { Bot, Loader2, MessageSquare, Paperclip, Send } from 'lucide-react';
import {
  MessageAttachmentItem,
  PendingAttachmentPreview,
  usePendingAttachmentPreviews,
} from '../../../components/ChatAttachments';
import { CommentContent } from '../../../components/CommentContent';
import { CommentMentionTextarea } from '../../../components/CommentMentionTextarea';
import { MarkdownEditorRoot } from '../../../components/markdown';
import type { User } from '../../../types';
import type { CommentMentionInsert } from '../../../utils/commentMentions';
import type { TaskSidePanelsProps, TaskPanelType } from '../types';
import { filePublicUrl } from '../utils/documentPaths';
import { formatDateTime } from '../utils/format';
import { TaskDocumentsPanel } from './TaskDocumentsPanel';
import { TaskActivityPanel } from './TaskActivityPanel';

function ChatFooter(p: {
  activePanel: TaskPanelType;
  commentComposeKey: number;
  commentText: string;
  commentMentionInserts: CommentMentionInsert[];
  onCommentMentionInsertsChange: (inserts: CommentMentionInsert[]) => void;
  assistantMessage: string;
  assistantChatError: string | null;
  isPostingComment: boolean;
  isPostingAssistant: boolean;
  attachmentsEnabled: boolean;
  pendingCommentFiles: File[];
  users: User[];
  currentUserId?: string;
  onCommentText: (v: string) => void;
  onAssistantMessage: (v: string) => void;
  onAddCommentFiles: (files: FileList | File[]) => void;
  onRemoveCommentFile: (index: number) => void;
  onPostComment: () => void;
  onPostAssistant: () => void;
}) {
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachmentPreviews = usePendingAttachmentPreviews(p.pendingCommentFiles);

  if (p.activePanel !== 'comments' && p.activePanel !== 'assistant') return null;

  const canPostComment =
    (p.commentText.trim().length > 0 ||
      p.commentMentionInserts.length > 0 ||
      p.pendingCommentFiles.length > 0) &&
    !p.isPostingComment;

  return (
    <div className="relative z-20 shrink-0 border-t border-slate-200 bg-white p-4">
      {p.activePanel === 'assistant' && p.assistantChatError ? (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
          {p.assistantChatError}
        </div>
      ) : null}
      {p.activePanel === 'comments' && pendingAttachmentPreviews.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingAttachmentPreviews.map((item, index) => (
            <PendingAttachmentPreview
              key={item.key}
              name={item.file.name}
              type={item.file.type}
              previewUrl={item.previewUrl}
              onRemove={() => p.onRemoveCommentFile(index)}
            />
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        {p.activePanel === 'comments' && p.attachmentsEnabled ? (
          <>
            <label
              className={`relative inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center self-end rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 ${
                p.isPostingComment ? 'pointer-events-none opacity-50' : ''
              }`}
              title="Прикрепить файлы"
            >
              <input
                ref={commentFileInputRef}
                type="file"
                multiple
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                disabled={p.isPostingComment}
                onChange={(e) => {
                  if (e.target.files?.length) {
                    p.onAddCommentFiles(e.target.files);
                  }
                  e.target.value = '';
                }}
              />
              <Paperclip className="pointer-events-none size-5" aria-hidden />
            </label>
          </>
        ) : null}
        {p.activePanel === 'comments' ? (
          <div
            key={p.commentComposeKey}
            className="min-w-0 flex-1 rounded border border-slate-300 bg-white"
          >
            <CommentMentionTextarea
              value={p.commentText}
              onChange={p.onCommentText}
              mentionInserts={p.commentMentionInserts}
              onMentionInsertsChange={p.onCommentMentionInsertsChange}
              users={p.users}
              currentUserId={p.currentUserId}
              disabled={p.isPostingComment}
            />
          </div>
        ) : (
          <textarea
            value={p.assistantMessage}
            onChange={(e) => p.onAssistantMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.shiftKey) return;
              e.preventDefault();
              void p.onPostAssistant();
            }}
            placeholder="Сообщение ассистенту… (Enter — отправить, Shift+Enter — новая строка)"
            rows={2}
            className="min-h-[44px] flex-1 resize-y rounded border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand"
          />
        )}
        <button
          type="button"
          onClick={() =>
            p.activePanel === 'comments' ? void p.onPostComment() : void p.onPostAssistant()
          }
          disabled={
            p.activePanel === 'comments'
              ? !canPostComment
              : !p.assistantMessage.trim() || p.isPostingAssistant
          }
          className="self-end rounded bg-brand px-3 py-2 text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
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
    <MarkdownEditorRoot>
      <div className="flex min-h-0 flex-1 flex-col overflow-visible">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activePanel === 'activity' ? (
          <TaskActivityPanel
            items={p.activityItems}
            loading={p.activityLoading}
            error={p.activityError}
          />
        ) : activePanel === 'documents' ? (
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
                  {c.content ? (
                    <CommentContent commentId={c.id} content={String(c.content || '')} />
                  ) : null}
                  {Array.isArray(c.attachments) && c.attachments.length > 0 ? (
                    <div className={`space-y-2 ${c.content ? 'mt-3' : ''}`}>
                      {c.attachments.map((att: { id: string; name: string; type: string; path?: string }) => (
                        <MessageAttachmentItem
                          key={att.id}
                          name={att.name}
                          type={att.type}
                          href={filePublicUrl(p.apiBaseUrl, att.path) ?? null}
                          mine={false}
                          onOpenPreview={p.onPreviewDoc}
                        />
                      ))}
                    </div>
                  ) : null}
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
              p.assistantPanelChat.map((m: any) => {
                if (m._pendingLoader) {
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200">
                        <Bot className="h-4 w-4 text-slate-600" />
                      </div>
                      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-700">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" aria-hidden />
                        <span className="truncate">Ассистент отвечает…</span>
                      </div>
                    </div>
                  );
                }

                const isAi = m.sender === 'assistant';
                const isOptimistic = Boolean(m._optimistic);
                return (
                  <div
                    key={m.id}
                    className={`rounded-lg border p-3 ${
                      isAi ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
                    } ${isOptimistic ? 'ring-1 ring-brand/25' : ''}`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      {isAi ? (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200">
                          <Bot className="h-4 w-4 text-slate-600" />
                        </div>
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light">
                          <span className="text-xs font-medium text-brand">
                            {m.user?.name?.charAt(0) || 'U'}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {isAi ? 'Ассистент (Groq)' : m.user?.name || 'Вы'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {m.createdAt ? formatDateTime(m.createdAt) : ''}
                        </div>
                      </div>
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-slate-700">{m.content}</div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <ChatFooter
        activePanel={activePanel}
        commentComposeKey={p.commentComposeKey}
        commentText={p.commentText}
        commentMentionInserts={p.commentMentionInserts}
        onCommentMentionInsertsChange={p.onCommentMentionInsertsChange}
        assistantMessage={p.assistantMessage}
        assistantChatError={p.assistantChatError}
        isPostingComment={p.isPostingComment}
        isPostingAssistant={p.isPostingAssistant}
        attachmentsEnabled={p.attachmentsEnabled}
        pendingCommentFiles={p.pendingCommentFiles}
        users={p.users}
        currentUserId={p.currentUserId}
        onCommentText={p.onCommentText}
        onAssistantMessage={p.onAssistantMessage}
        onAddCommentFiles={p.onAddCommentFiles}
        onRemoveCommentFile={p.onRemoveCommentFile}
        onPostComment={p.onPostComment}
        onPostAssistant={p.onPostAssistant}
      />
      </div>
    </MarkdownEditorRoot>
  );
}
