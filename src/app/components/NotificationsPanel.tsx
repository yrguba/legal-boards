import { useEffect, useMemo, useRef } from 'react';
import { X, Bell, CheckCheck, FileText, MessageSquare, ArrowRightLeft, AtSign, UserPlus } from 'lucide-react';
import type { Notification } from '../types';
import { useNavigate } from 'react-router';
import { useNotifications } from '../store/NotificationsContext';

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ isOpen, onClose }: NotificationsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { items, isLoading, refresh, markAsRead, markAllAsRead } = useNotifications();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    refresh();
  }, [isOpen]);

  const unreadCount = useMemo(() => items.filter((n) => !n.isRead).length, [items]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'task_assigned':
        return <Bell className="w-5 h-5" style={{ color: 'var(--brand-primary)' }} />;
      case 'comment':
        return <MessageSquare className="w-5 h-5 text-brand" />;
      case 'status_change':
        return <ArrowRightLeft className="w-5 h-5 text-orange-600" />;
      case 'document':
        return <FileText className="w-5 h-5 text-purple-600" />;
      case 'mention':
        return <AtSign className="w-5 h-5 text-pink-600" />;
      case 'user_added':
        return <UserPlus className="w-5 h-5 text-emerald-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} д назад`;
    return date.toLocaleDateString('ru-RU');
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20" />
      <div
        ref={panelRef}
        className="absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Уведомления</h2>
            {unreadCount > 0 && (
              <p className="text-sm text-slate-600 mt-0.5">
                Непрочитанных: {unreadCount}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="p-2 text-slate-600 hover:text-slate-900 rounded transition-colors"
                title="Отметить все как прочитанные"
              >
                <CheckCheck className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-600 hover:text-slate-900 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full p-8 text-center">
              <p className="text-slate-500">Загрузка…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Bell className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500">Нет уведомлений</p>
            </div>
          ) : (
            <div>
              {items.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${
                    !notification.isRead ? 'bg-brand-light/30' : ''
                  }`}
                  onClick={async () => {
                    if (!notification.isRead) await markAsRead(notification.id);

                    // Navigate by relatedId when possible
                    if (notification.relatedId) {
                      if (
                        notification.type === 'task_assigned' ||
                        notification.type === 'comment' ||
                        notification.type === 'status_change' ||
                        notification.type === 'document' ||
                        notification.type === 'mention'
                      ) {
                        navigate(`/task/${notification.relatedId}`);
                        onClose();
                        return;
                      }

                      if (notification.type === 'user_added') {
                        navigate('/');
                        onClose();
                        return;
                      }
                    }

                    onClose();
                  }}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-medium text-slate-900">
                          {notification.title}
                        </h4>
                        {!notification.isRead && (
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                            style={{ backgroundColor: 'var(--brand-primary)' }}
                          />
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{notification.message}</p>
                      <div className="text-xs text-slate-500">
                        {formatTime(notification.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
