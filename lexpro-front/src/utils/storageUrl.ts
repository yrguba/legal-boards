/** Нормализация пути вложения → URL относительно корня бэкенда */
export function normalizeStoragePath(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = String(raw).replace(/\\/g, '/');
  const lower = s.toLowerCase();
  const inPath = lower.indexOf('/uploads/');
  if (inPath >= 0) {
    return s.slice(inPath);
  }
  if (lower.startsWith('uploads/')) {
    return `/${s}`;
  }
  return `/${s.replace(/^[./]+/, '')}`;
}

export function filePublicUrl(baseUrl: string, path: string | undefined): string | undefined {
  if (!path) return undefined;
  const n = normalizeStoragePath(path);
  if (!n) return undefined;
  return `${baseUrl}${n}`;
}
