import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import { FORMS_MICROAPP_ENABLED } from './qiankun/formsMicroAppFeature';
import { FormsDisabledRoute } from './pages/FormsDisabledRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { VerifyEmail } from './pages/VerifyEmail';
import { Boards } from './pages/Boards';
import { Board } from './pages/Board';
import { TaskRoute } from './pages/TaskRoute';
import { Employees } from './pages/Employees';
import { Documents } from './pages/Documents';
import { Settings } from './pages/Settings';
import { Chat } from './pages/Chat';
import { Calendar } from './pages/Calendar';
import { Workspaces } from './pages/Workspaces';
import { Knowledge } from './pages/Knowledge';
import { LexClients } from './pages/LexClients';
import { Analytics } from './pages/Analytics';
import { Conferences } from './pages/Conferences';
import { ConferenceRoom } from './pages/ConferenceRoom';
import { ConferenceJoin } from './pages/ConferenceJoin';
import { ChangePassword } from './pages/ChangePassword';
import { Invite } from './pages/Invite';
import { FeatureTabGuard } from './components/FeatureTabGuard';
import { useApp } from './store/AppContext';
import { BrowserNotificationNavigation } from './store/BrowserNotificationNavigation';

const FormsMicroAppRoute = FORMS_MICROAPP_ENABLED
  ? lazy(() =>
      import('./pages/FormsMicroAppRoute').then((m) => ({ default: m.FormsMicroAppRoute })),
    )
  : null;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useApp();
  const location = useLocation();
  return isAuthenticated ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  );
}

function AppLayout() {
  const { currentUser } = useApp();
  if (currentUser?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  return (
    <>
      <BrowserNotificationNavigation />
      <Layout />
    </>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/verify-email',
    element: <VerifyEmail />,
  },
  {
    path: '/invite',
    element: <Invite />,
  },
  {
    path: '/conferences/join/:shareToken',
    element: <ConferenceJoin />,
  },
  {
    path: '/change-password',
    element: (
      <ProtectedRoute>
        <ChangePassword />
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Boards />,
      },
      {
        path: 'board/:boardId',
        element: <Board />,
      },
      {
        path: 'task/:taskKey',
        element: <TaskRoute />,
      },
      {
        path: 'forms/*',
        element: FORMS_MICROAPP_ENABLED && FormsMicroAppRoute ? (
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-600">
                Загрузка модуля форм…
              </div>
            }
          >
            <FormsMicroAppRoute />
          </Suspense>
        ) : (
          <FormsDisabledRoute />
        ),
      },
      {
        path: 'employees',
        element: <Employees />,
      },
      {
        path: 'documents',
        element: (
          <FeatureTabGuard tab="documents">
            <Documents />
          </FeatureTabGuard>
        ),
      },
      {
        path: 'chat/:channelId?',
        element: (
          <FeatureTabGuard tab="chat">
            <Chat />
          </FeatureTabGuard>
        ),
      },
      {
        path: 'calendar',
        element: (
          <FeatureTabGuard tab="calendar">
            <Calendar />
          </FeatureTabGuard>
        ),
      },
      {
        path: 'conferences',
        element: <Conferences />,
      },
      {
        path: 'conferences/:id',
        element: <ConferenceRoom />,
      },
      {
        path: 'knowledge/:articleId',
        element: (
          <FeatureTabGuard tab="knowledge">
            <Knowledge />
          </FeatureTabGuard>
        ),
      },
      {
        path: 'knowledge',
        element: (
          <FeatureTabGuard tab="knowledge">
            <Knowledge />
          </FeatureTabGuard>
        ),
      },
      {
        path: 'workspaces',
        element: <Workspaces />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'lex-clients',
        element: <LexClients />,
      },
      {
        path: 'analytics',
        element: <Analytics />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
