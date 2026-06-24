import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { configApi, type AppPublicConfig } from '../../services/api';

const DEFAULT_CONFIG: AppPublicConfig = {
  documents: true,
  knowledge: true,
  chat: true,
  calendar: true,
  workspaceInviteEmail: false,
  feedbackEnabled: true,
};

type FeatureTabsContextValue = AppPublicConfig & { loading: boolean };

const FeatureTabsContext = createContext<FeatureTabsContextValue>({
  ...DEFAULT_CONFIG,
  loading: true,
});

export function FeatureTabsProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppPublicConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    configApi
      .getFeatureTabs()
      .then((cfg) => {
        if (!cancelled) setConfig(cfg);
      })
      .catch(() => {
        if (!cancelled) setConfig(DEFAULT_CONFIG);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <FeatureTabsContext.Provider value={{ ...config, loading }}>
      {children}
    </FeatureTabsContext.Provider>
  );
}

export function useFeatureTabsConfig() {
  return useContext(FeatureTabsContext);
}

export type { AppPublicConfig as FeatureTabsConfig };
