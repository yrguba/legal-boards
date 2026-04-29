import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Boards } from './pages/Boards';
import { Board } from './pages/Board';
import { Task } from './pages/Task';
import { Employees } from './pages/Employees';
import { Documents } from './pages/Documents';
import { Settings } from './pages/Settings';
import { Chat } from './pages/Chat';
import { Calendar } from './pages/Calendar';
import { Workspaces } from './pages/Workspaces';
import { Knowledge } from './pages/Knowledge';
import { useApp } from './store/AppContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useApp();
  const location = useLocation();
  return isAuthenticated ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
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
        path: 'task/:taskId',
        element: <Task />,
      },
      {
        path: 'employees',
        element: <Employees />,
      },
      {
        path: 'documents',
        element: <Documents />,
      },
      {
        path: 'chat',
        element: <Chat />,
      },
      {
        path: 'calendar',
        element: <Calendar />,
      },
      {
        path: 'knowledge/:articleId',
        element: <Knowledge />,
      },
      {
        path: 'knowledge',
        element: <Knowledge />,
      },
      {
        path: 'workspaces',
        element: <Workspaces />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
