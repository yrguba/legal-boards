import { RouterProvider } from 'react-router';
import { AppProvider } from './store/AppContext';
import { ColumnTransitionProvider } from './store/ColumnTransitionContext';
import { EmployeesProvider } from './store/EmployeesContext';
import { NotificationPreferencesProvider } from './store/NotificationPreferencesContext';
import { RealtimeProvider } from './store/RealtimeContext';
import { BrowserNotificationsListener } from './store/BrowserNotificationsListener';
import { NotificationsProvider } from './store/NotificationsContext';
import { FeatureTabsProvider } from './features/featureTabs/useFeatureTabsConfig';
import { router } from './routes';

export default function App() {
  return (
    <AppProvider>
      <FeatureTabsProvider>
        <NotificationPreferencesProvider>
          <RealtimeProvider>
            <BrowserNotificationsListener />
            <NotificationsProvider>
              <EmployeesProvider>
                <ColumnTransitionProvider>
                  <RouterProvider router={router} />
                </ColumnTransitionProvider>
              </EmployeesProvider>
            </NotificationsProvider>
          </RealtimeProvider>
        </NotificationPreferencesProvider>
      </FeatureTabsProvider>
    </AppProvider>
  );
}
