import { useEffect, useState } from 'react';
import { conferencesApi } from '../../services/api';

export function useConferencesConfig() {
  const [enabled, setEnabled] = useState(false);
  const [jitsiDomain, setJitsiDomain] = useState('video.vibecall.space');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    conferencesApi
      .getConfig()
      .then((cfg) => {
        if (cancelled) return;
        setEnabled(cfg.enabled);
        setJitsiDomain(cfg.jitsiDomain);
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

  return { enabled, jitsiDomain, loading };
}
