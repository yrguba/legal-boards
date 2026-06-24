import bcrypt from 'bcryptjs';

const BCRYPT_PREFIX = /^\$2[aby]\$\d+\$/;

export function generateTempPassword(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain.trim(), 10);
}

export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  const candidate = plain.trim();
  if (!candidate || !stored) return false;
  if (BCRYPT_PREFIX.test(stored)) {
    return bcrypt.compare(candidate, stored);
  }
  return candidate === stored;
}
