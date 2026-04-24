import { Outlet, NavLink, useNavigate } from 'react-router';
import { useApp } from '../store/AppContext';
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
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NotificationsPanel } from './NotificationsPanel';
import { notifications } from '../store/mockData';

export function Layout() {
  const { currentUser, currentWorkspace, workspaces, logout, switchWorkspace } = useApp();
  const navigate = useNavigate();
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === '1') setIsSidebarCollapsed(true);
  }, []);

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
    switchWorkspace(workspaceId);
    setShowWorkspaceMenu(false);
  };

  const navItems = useMemo(
    () => [
      { to: '/', end: true, label: 'Доски', icon: LayoutDashboard },
      { to: '/employees', label: 'Сотрудники', icon: Users },
      { to: '/documents', label: 'Документы', icon: FileText },
      { to: '/settings', label: 'Настройки', icon: Settings },
    ],
    []
  );

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

        <div className={`${isSidebarCollapsed ? 'p-2' : 'p-4'} border-t border-slate-200`}>
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} mb-3`}>
            <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
              <span className="text-sm text-brand font-medium">{currentUser?.name.charAt(0)}</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 ml-2">
                <div className="text-sm text-slate-900 truncate">{currentUser?.name}</div>
                <div className="text-xs text-slate-500 truncate">{currentUser?.role}</div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded transition-colors ${
              isSidebarCollapsed ? 'justify-center' : ''
            }`}
            title={isSidebarCollapsed ? 'Выйти' : undefined}
          >
            <LogOut className="size-5" />
            {!isSidebarCollapsed && <span>Выйти</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
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
                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded shadow-lg z-10">
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
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-2 text-slate-600 hover:text-slate-900 rounded transition-colors"
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
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      <NotificationsPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </div>
  );
}
