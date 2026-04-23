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
} from 'lucide-react';
import { useState } from 'react';
import { NotificationsPanel } from './NotificationsPanel';
import { notifications } from '../store/mockData';

export function Layout() {
  const { currentUser, currentWorkspace, workspaces, logout, switchWorkspace } = useApp();
  const navigate = useNavigate();
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSwitchWorkspace = (workspaceId: string) => {
    switchWorkspace(workspaceId);
    setShowWorkspaceMenu(false);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-6 h-6 text-brand" />
            <span className="font-semibold text-slate-900">Legal Boards</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="w-full flex items-center justify-between p-2 rounded hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-slate-600 flex-shrink-0" />
                <span className="text-sm text-slate-900 truncate">{currentWorkspace?.name}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </button>

            {showWorkspaceMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg z-10">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => handleSwitchWorkspace(ws.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors ${
                      ws.id === currentWorkspace?.id ? 'bg-brand-light text-brand' : 'text-slate-700'
                    }`}
                  >
                    <div className="truncate">{ws.name}</div>
                    {ws.isOwner && (
                      <div className="text-xs text-slate-500 mt-0.5">Владелец</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                isActive
                  ? 'bg-brand-light text-brand'
                  : 'text-slate-700 hover:bg-slate-100'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Доски</span>
          </NavLink>

          <NavLink
            to="/employees"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                isActive
                  ? 'bg-brand-light text-brand'
                  : 'text-slate-700 hover:bg-slate-100'
              }`
            }
          >
            <Users className="w-5 h-5" />
            <span>Сотрудники</span>
          </NavLink>

          <NavLink
            to="/documents"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                isActive
                  ? 'bg-brand-light text-brand'
                  : 'text-slate-700 hover:bg-slate-100'
              }`
            }
          >
            <FileText className="w-5 h-5" />
            <span>Документы</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                isActive
                  ? 'bg-brand-light text-brand'
                  : 'text-slate-700 hover:bg-slate-100'
              }`
            }
          >
            <Settings className="w-5 h-5" />
            <span>Настройки</span>
          </NavLink>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
                <span className="text-sm text-brand font-medium">
                  {currentUser?.name.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-sm text-slate-900 truncate">{currentUser?.name}</div>
                <div className="text-xs text-slate-500 truncate">{currentUser?.role}</div>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-end px-6 py-3 border-b border-slate-200 bg-white">
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
