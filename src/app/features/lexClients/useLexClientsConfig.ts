import { useEffect, useState } from 'react';
import { usersApi } from '../../services/api';

export function useLexClientsConfig() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .getLexClientsConfig()
      .then((cfg) => {
        if (!cancelled) setEnabled(cfg.enabled);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { enabled, loading };
}
