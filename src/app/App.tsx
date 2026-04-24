import { RouterProvider } from 'react-router';
import { AppProvider } from './store/AppContext';
import { EmployeesProvider } from './store/EmployeesContext';
import { NotificationsProvider } from './store/NotificationsContext';
import { router } from './routes';

export default function App() {
  return (
    <AppProvider>
      <NotificationsProvider>
        <EmployeesProvider>
          <RouterProvider router={router} />
        </EmployeesProvider>
      </NotificationsProvider>
    </AppProvider>
  );
}