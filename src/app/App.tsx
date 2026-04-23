import { RouterProvider } from 'react-router';
import { AppProvider } from './store/AppContext';
import { EmployeesProvider } from './store/EmployeesContext';
import { router } from './routes';

export default function App() {
  return (
    <AppProvider>
      <EmployeesProvider>
        <RouterProvider router={router} />
      </EmployeesProvider>
    </AppProvider>
  );
}
