import type { RequestHandler } from 'express';
import { getFeatureTabsConfig, type FeatureTabKey } from '../utils/featureTabs';

const LABELS: Record<FeatureTabKey, string> = {
  documents: 'Документы',
  knowledge: 'База знаний',
  chat: 'Чат',
  calendar: 'Календарь',
};

export function requireFeatureTab(tab: FeatureTabKey): RequestHandler {
  return (_req, res, next) => {
    const cfg = getFeatureTabsConfig();
    if (cfg[tab]) {
      next();
      return;
    }
    res.status(403).json({ error: `Раздел «${LABELS[tab]}» отключён` });
  };
}
