export function isPushLogEnabled(): boolean {
  const raw = process.env.PUSH_LOG?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return true;
}

export function maskToken(token: string): string {
  const t = token.trim();
  if (t.length <= 12) return '***';
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

export function pushLog(message: string, meta?: Record<string, unknown>): void {
  if (!isPushLogEnabled()) return;
  if (meta && Object.keys(meta).length > 0) {
    console.log(`[push] ${message}`, meta);
  } else {
    console.log(`[push] ${message}`);
  }
}

export function pushWarn(message: string, meta?: Record<string, unknown>): void {
  if (!isPushLogEnabled()) return;
  if (meta && Object.keys(meta).length > 0) {
    console.warn(`[push] ${message}`, meta);
  } else {
    console.warn(`[push] ${message}`);
  }
}
