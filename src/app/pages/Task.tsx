import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { tasks, boards, users, taskTypes } from '../store/mockData';
import {
  ArrowLeft,
  MessageSquare,
  Bot,
  FileText,
  Paperclip,
  Send,
  Calendar,
  User,
  Tag,
} from 'lucide-react';

type PanelType = 'client' | 'assistant' | 'comments' | 'documents';

export function Task() {
  const { taskId } = useParams();
  const task = tasks.find((t) => t.id === taskId);
  const board = task ? boards.find((b) => b.id === task.boardId) : null;
  const [activePanel, setActivePanel] = useState<PanelType>('comments');
  const [message, setMessage] = useState('');

  if (!task || !board) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Задача не найдена</h2>
        </div>
      </div>
    );
  }

  const taskType = taskTypes.find((t) => t.id === task.typeId);
  const assignee = task.assigneeId ? users.find((u) => u.id === task.assigneeId) : null;
  const creator = users.find((u) => u.id === task.createdBy);
  const column = board.columns.find((c) => c.id === task.columnId);

  const handleSendMessage = () => {
    if (message.trim()) {
      console.log(`Sending ${activePanel} message:`, message);
      setMessage('');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <Link
          to={`/board/${board.id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к доске
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">{task.title}</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl">
            <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                    <Tag className="w-4 h-4" />
                    Тип задачи
                  </div>
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium text-white"
                    style={{ backgroundColor: taskType?.color }}
                  >
                    {taskType?.name}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                    <User className="w-4 h-4" />
                    Исполнитель
                  </div>
                  {assignee ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-brand-light flex items-center justify-center">
                        <span className="text-xs font-medium text-brand">
                          {assignee.name.charAt(0)}
                        </span>
                      </div>
                      <span className="text-sm text-slate-900">{assignee.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500">Не назначено</span>
                  )}
                </div>

                <div>
                  <div className="text-sm text-slate-600 mb-1">Статус</div>
                  <span className="text-sm text-slate-900">{column?.name}</span>
                </div>

                {task.customFields?.priority && (
                  <div>
                    <div className="text-sm text-slate-600 mb-1">Приоритет</div>
                    <span className="text-sm text-slate-900">
                      {task.customFields.priority}
                    </span>
                  </div>
                )}

                {task.customFields?.deadline && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      Срок
                    </div>
                    <span className="text-sm text-slate-900">
                      {new Date(task.customFields.deadline).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                )}
              </div>

              {task.description && (
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-medium text-slate-900 mb-2">Описание</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {task.description}
                  </p>
                </div>
              )}

              {task.attachments.length > 0 && (
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <h3 className="text-sm font-medium text-slate-900 mb-2">Вложения</h3>
                  <div className="space-y-2">
                    {task.attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-slate-50 rounded"
                      >
                        <Paperclip className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-700">{file}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="text-xs text-slate-500">
                Создано {creator?.name} •{' '}
                {new Date(task.createdAt).toLocaleString('ru-RU')}
              </div>
              {task.updatedAt !== task.createdAt && (
                <div className="text-xs text-slate-500 mt-1">
                  Обновлено {new Date(task.updatedAt).toLocaleString('ru-RU')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-96 bg-white border-l border-slate-200 flex flex-col">
          <div className="border-b border-slate-200">
            <div className="flex">
              <button
                onClick={() => setActivePanel('client')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors ${
                  activePanel === 'client'
                    ? 'text-brand border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Клиент
              </button>
              <button
                onClick={() => setActivePanel('assistant')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors ${
                  activePanel === 'assistant'
                    ? 'text-brand border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bot className="w-4 h-4" />
                Ассистент
              </button>
            </div>
            <div className="flex border-t border-slate-200">
              <button
                onClick={() => setActivePanel('comments')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors ${
                  activePanel === 'comments'
                    ? 'text-brand border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Комментарии
              </button>
              <button
                onClick={() => setActivePanel('documents')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors ${
                  activePanel === 'documents'
                    ? 'text-brand border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                Документы
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activePanel === 'documents' ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Нет документов</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Нет сообщений</p>
              </div>
            )}
          </div>

          {activePanel !== 'documents' && (
            <div className="border-t border-slate-200 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Введите сообщение..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim()}
                  className="px-3 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
