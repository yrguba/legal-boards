import { useEffect, useState } from 'react';
import { configApi } from '../../services/api';

export type FeatureTabsConfig = {
  documents: boolean;
  knowledge: boolean;
  chat: boolean;
  calendar: boolean;
};

const DEFAULT_CONFIG: FeatureTabsConfig = {
  documents: true,
  knowledge: true,
  chat: true,
  calendar: true,
};

export function useFeatureTabsConfig() {
  const [config, setConfig] = useState<FeatureTabsConfig>(DEFAULT_CONFIG);
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

  return { ...config, loading };
}
