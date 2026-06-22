import path from 'path';

/** Корень `backend/` (рядом с `package.json`), не зависит от `process.cwd()`. */
export function getBackendRoot(): string {
  return path.resolve(__dirname, '..', '..');
}

/** Относительные пути — от `backend/`, абсолютные — как есть. */
export function resolveBackendPath(relativeOrAbsolute: string): string {
  const trimmed = relativeOrAbsolute.trim();
  if (!trimmed) return '';
  if (path.isAbsolute(trimmed)) return trimmed;
  return path.resolve(getBackendRoot(), trimmed);
}
