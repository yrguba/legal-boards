export function parseEnvFlag(name: string, defaultValue = true): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return raw === 'true' || raw === '1' || raw === 'yes';
}
