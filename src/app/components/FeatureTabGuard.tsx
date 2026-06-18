import type { ReactNode } from 'react';
import { useFeatureTabsConfig } from '../features/featureTabs/useFeatureTabsConfig';

type FeatureTabKey = 'documents' | 'knowledge' | 'chat' | 'calendar';

const TAB_META: Record<FeatureTabKey, { label: string; envName: string }> = {
  documents: { label: 'Документы', envName: 'DOCUMENTS_ENABLED' },
  knowledge: { label: 'База знаний', envName: 'KNOWLEDGE_ENABLED' },
  chat: { label: 'Чат', envName: 'CHAT_ENABLED' },
  calendar: { label: 'Календарь', envName: 'CALENDAR_ENABLED' },
};

export function FeatureTabGuard({ tab, children }: { tab: FeatureTabKey; children: ReactNode }) {
  const cfg = useFeatureTabsConfig();
  const meta = TAB_META[tab];

  if (cfg.loading) {
    return <p className="p-8 text-sm text-slate-500">Загрузка…</p>;
  }

  if (!cfg[tab]) {
    return (
      <div className="p-8 text-center text-sm text-slate-600">
        Раздел «{meta.label}» отключён ({meta.envName}=false).
      </div>
    );
  }

  return <>{children}</>;
}
