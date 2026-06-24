import { getApiBaseUrl } from '../pages/task/utils/apiBaseUrl';
import { filePublicUrl } from '../pages/task/utils/documentPaths';

export function resolveUserAvatarUrl(avatar: string | null | undefined): string | undefined {
  if (!avatar) return undefined;
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
  return filePublicUrl(getApiBaseUrl(), avatar);
}
