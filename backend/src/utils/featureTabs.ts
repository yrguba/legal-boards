export type FeatureTabsConfig = {
  documents: boolean;
  knowledge: boolean;
  chat: boolean;
  calendar: boolean;
};

function parseEnvFlag(name: string, defaultValue = true): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function getFeatureTabsConfig(): FeatureTabsConfig {
  return {
    documents: parseEnvFlag('DOCUMENTS_ENABLED', true),
    knowledge: parseEnvFlag('KNOWLEDGE_ENABLED', true),
    chat: parseEnvFlag('CHAT_ENABLED', true),
    calendar: parseEnvFlag('CALENDAR_ENABLED', true),
  };
}
