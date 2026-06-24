import { parseEnvFlag } from './envFlags';
import { isFeedbackEnabled } from './feedback';

export type FeatureTabsConfig = {
  documents: boolean;
  knowledge: boolean;
  chat: boolean;
  calendar: boolean;
};

export type FeatureTabKey = keyof FeatureTabsConfig;

export type AppPublicConfig = FeatureTabsConfig & {
  workspaceInviteEmail: boolean;
  feedbackEnabled: boolean;
};

export function getFeatureTabsConfig(): FeatureTabsConfig {
  return {
    documents: parseEnvFlag('DOCUMENTS_ENABLED', true),
    knowledge: parseEnvFlag('KNOWLEDGE_ENABLED', true),
    chat: parseEnvFlag('CHAT_ENABLED', true),
    calendar: parseEnvFlag('CALENDAR_ENABLED', true),
  };
}

export function getAppPublicConfig(): AppPublicConfig {
  return {
    ...getFeatureTabsConfig(),
    workspaceInviteEmail: parseEnvFlag('WORKSPACE_INVITE_EMAIL', false),
    feedbackEnabled: isFeedbackEnabled(),
  };
}
