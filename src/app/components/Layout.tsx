import { Link, Outlet, NavLink, useLocation, useNavigate } from 'react-router';
import { useApp } from '../store/AppContext';
import { useWorkspacePermissions } from '../utils/workspacePermissions';
import {
  LayoutDashboard,
  Users,
  FileText,
  Briefcase,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
  Bell,
  PanelLeft,
  Layers,
  MessageCircle,
  Calendar,
  BookOpen,
  Handshake,
  BarChart3,
  Video,
  Plus,
  MessageSquarePlus,
  ListTodo,
  ClipboardList,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NotificationsPanel } from './NotificationsPanel';
import { BrowserNotificationPermissionBanner } from './BrowserNotificationPermissionBanner';
import { QuickCreateTaskModal, type QuickCreateSuccess } from './QuickCreateTaskModal';
import { FeedbackModal } from './FeedbackModal';
import { useNotifications } from '../store/NotificationsContext';
import { useConferencesConfig } from '../features/conferences/useConferencesConfig';
import { useLexClientsConfig } from '../features/lexClients/useLexClientsConfig';
import { useFeatureTabsConfig } from '../features/featureTabs/useFeatureTabsConfig';
import { resolveUserAvatarUrl } from '../utils/userAvatar';
import { UserPresenceBadge } from './UserPresenceBadge';
import { usersApi } from '../services/api';
import type { UserPresenceInfo } from '../types';
import { FORMS_ACTIVE_RULE } from '../qiankun/formsMicroApp.config';
import { FORMS_MICROAPP_ENABLED } from '../qiankun/formsMicroAppFeature';

export function Layout() {
  const { currentUser, currentWorkspace, workspaces, logout, switchWorkspace, refreshWorkspaces, isAuthenticated } = useApp();
  const { canManageWorkspace, workspaceRole } = useWorkspacePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [quickCreateToast, setQuickCreateToast] = useState<QuickCreateSuccess | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [myPresence, setMyPresence] = useState<UserPresenceInfo | null>(null);
  const { unreadCount, toast } = useNotifications();

  useEffect(() => {
    if (!quickCreateToast) return;
    const timer = window.setTimeout(() => setQuickCreateToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [quickCreateToast]);

  useEffect(() => {
    if (!feedbackToast) return;
    const timer = window.setTimeout(() => setFeedbackToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [feedbackToast]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshWorkspaces();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isAuthenticated, refreshWorkspaces]);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === '1') setIsSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    if (!currentWorkspace?.id) {
      setMyPresence(null);
      return;
    }

    const load = () => {
      void usersApi
        .getMyPresence(currentWorkspace.id)
        .then((r) => setMyPresence(r.presence))
        .catch(() => setMyPresence(null));
    };

    load();
    window.addEventListener('lb-presence-updated', load);
    return () => window.removeEventListener('lb-presence-updated', load);
  }, [currentWorkspace?.id]);

  // notifications handled globally

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSwitchWorkspace = (workspaceId: string) => {
    const isSameWorkspace = workspaceId === currentWorkspace?.id;
    switchWorkspace(workspaceId);
    setShowWorkspaceMenu(false);
    if (!isSameWorkspace && location.pathname.startsWith('/board/')) {
      navigate('/');
    }
  };

  const canManageLexClients = canManageWorkspace;
  const canViewAnalytics = canManageLexClients;
  const { enabled: conferencesEnabled } = useConferencesConfig();
  const { enabled: lexClientsEnabled } = useLexClientsConfig();
  const { documents, knowledge, chat, calendar, feedbackEnabled } = useFeatureTabsConfig();

  const navItems = useMemo(() => {
    const items: { to: string; end?: boolean; label: string; icon: typeof LayoutDashboard }[] = [
      { to: '/', end: true, label: 'Доски', icon: LayoutDashboard },
      { to: '/my-tasks', label: 'Мои задачи', icon: ListTodo },
      { to: '/employees', label: 'Сотрудники', icon: Users },
    ];
    if (documents) items.push({ to: '/documents', label: 'Документы', icon: FileText });
    if (FORMS_MICROAPP_ENABLED) {
      items.push({ to: `${FORMS_ACTIVE_RULE}/`, label: 'Формы', icon: ClipboardList });
    }
    if (knowledge) items.push({ to: '/knowledge', label: 'База знаний', icon: BookOpen });
    if (chat) items.push({ to: '/chat', label: 'Чат', icon: MessageCircle });
    if (calendar) items.push({ to: '/calendar', label: 'Календарь', icon: Calendar });
    if (conferencesEnabled) {
      items.push({ to: '/conferences', label: 'Конференции', icon: Video });
    }
    items.push({ to: '/workspaces', label: 'Пространства', icon: Layers });
    items.push({ to: '/settings', label: 'Настройки', icon: Settings });
    if (canViewAnalytics) {
      items.splice(1, 0, { to: '/analytics', label: 'Аналитика', icon: BarChart3 });
    }
    if (canManageLexClients && lexClientsEnabled) {
      const workspacesIdx = items.findIndex((item) => item.to === '/workspaces');
      items.splice(workspacesIdx >= 0 ? workspacesIdx : items.length, 0, {
        to: '/lex-clients',
        label: 'Клиенты LEXPRO',
        icon: Handshake,
      });
    }
    return items;
  }, [canManageLexClients, canViewAnalytics, conferencesEnabled, lexClientsEnabled, documents, knowledge, chat, calendar]);

  const sidebarAvatarUrl = resolveUserAvatarUrl(currentUser?.avatar);

  return (
    <div className="flex h-screen bg-slate-50">
      <aside
        className={`bg-white border-r border-slate-200 flex flex-col transition-[width] duration-200 ${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className={`${isSidebarCollapsed ? 'p-2' : 'p-4'} border-b border-slate-200`}>
          <div className={`flex items-center gap-2 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <Briefcase className="size-6 text-brand" />
            {!isSidebarCollapsed && <span className="font-semibold text-slate-900">Legal Boards</span>}
          </div>
        </div>

        <nav className={`flex-1 ${isSidebarCollapsed ? 'p-2' : 'p-4'} space-y-1`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end as any}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded transition-colors ${
                    isSidebarCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-brand-light text-brand'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <Icon className="size-5" />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className={`${isSidebarCollapsed ? 'p-2' : 'px-3 py-3'} border-t border-slate-200`}>
          <div
            className={`flex min-w-0 gap-3 ${isSidebarCollapsed ? 'justify-center mb-2' : 'items-center mb-2'}`}
          >
            <div className="size-9 shrink-0 rounded-full bg-brand-light flex items-center justify-center overflow-hidden ring-1 ring-slate-200/80">
              {sidebarAvatarUrl ? (
                <img src={sidebarAvatarUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-sm font-medium text-brand">
                  {currentUser?.name.charAt(0)}
                </span>
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate leading-none">
                  {currentUser?.name}
                </p>
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <UserPresenceBadge
                    presence={myPresence}
                    showLabel
                    className="text-[11px] leading-none text-slate-500"
                  />
                  <span className="text-[11px] leading-none text-slate-400 truncate">
                    {workspaceRole ?? currentUser?.role}
                  </span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors ${
              isSidebarCollapsed ? 'justify-center' : ''
            }`}
            title={isSidebarCollapsed ? 'Выйти' : undefined}
          >
            <LogOut className="size-4 shrink-0" />
            {!isSidebarCollapsed && <span>Выйти</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <BrowserNotificationPermissionBanner />
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="p-2 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
              aria-label="Свернуть/развернуть меню"
            >
              <PanelLeft className="w-5 h-5" />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-100 transition-colors"
              >
                <Building2 className="w-4 h-4 text-slate-600 flex-shrink-0" />
                <span className="text-sm text-slate-900 max-w-[240px] truncate">
                  {currentWorkspace?.name || 'Выберите пространство'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>

              {showWorkspaceMenu && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded shadow-lg z-10 py-1">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => handleSwitchWorkspace(ws.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors ${
                        ws.id === currentWorkspace?.id ? 'bg-brand-light text-brand' : 'text-slate-700'
                      }`}
                    >
                      <div className="truncate">{ws.name}</div>
                      {ws.isOwner && <div className="text-xs text-slate-500 mt-0.5">Владелец</div>}
                    </button>
                  ))}
                  <div className="border-t border-slate-200 mt-1 pt-1">
                    <Link
                      to="/workspaces"
                      onClick={() => setShowWorkspaceMenu(false)}
                      className="block px-3 py-2 text-sm text-brand hover:bg-slate-50"
                    >
                      Управление пространствами…
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setQuickCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
              aria-label="Создать задачу"
              title="Создать задачу"
            >
              <Plus className="size-4 shrink-0" />
              <span>Создать задачу</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            {feedbackEnabled ? (
              <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                className="p-2 text-slate-600 hover:text-slate-900 rounded transition-colors"
                aria-label="Обратная связь"
                title="Обратная связь"
              >
                <MessageSquarePlus className="w-5 h-5" />
              </button>
            ) : null}
            <button
              onClick={() => setShowNotifications(true)}
              className="relative p-2 text-slate-600 hover:text-slate-900 rounded transition-colors"
              aria-label="Уведомления"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                />
              )}
            </button>
          </div>
        </div>
        <div
          className={`app-main-scroll flex min-h-0 flex-1 flex-col ${
            FORMS_MICROAPP_ENABLED &&
            (location.pathname.startsWith(`${FORMS_ACTIVE_RULE}/`) ||
              location.pathname === FORMS_ACTIVE_RULE)
              ? 'overflow-hidden'
              : 'overflow-y-auto'
          }`}
        >
          <Outlet />
        </div>
      </main>

      <NotificationsPanel
        isOpen={showNotifications}
        onClose={async () => {
          setShowNotifications(false);
        }}
      />

      {toast ? (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm">
          <div className="rounded-lg border border-slate-200 bg-white shadow-lg p-4">
            <div className="text-sm font-medium text-slate-900">{toast.title}</div>
            <div className="mt-1 text-sm text-slate-600">{toast.message}</div>
          </div>
        </div>
      ) : null}

      {quickCreateToast ? (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 shadow-lg p-4">
            <div className="text-sm font-medium text-emerald-900">Задача создана</div>
            <div className="mt-1 text-sm text-emerald-800">
              {quickCreateToast.title}
              {quickCreateToast.key ? ` (${quickCreateToast.key})` : ''}
            </div>
          </div>
        </div>
      ) : null}

      {feedbackToast ? (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 shadow-lg p-4">
            <div className="text-sm font-medium text-emerald-900">Обратная связь</div>
            <div className="mt-1 text-sm text-emerald-800">{feedbackToast}</div>
          </div>
        </div>
      ) : null}

      <QuickCreateTaskModal
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onSuccess={(task) => setQuickCreateToast(task)}
      />

      {feedbackEnabled ? (
        <FeedbackModal
          open={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          onSubmitted={(message) => setFeedbackToast(message)}
        />
      ) : null}
    </div>
  );
}
