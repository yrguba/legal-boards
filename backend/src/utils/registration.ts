export function isRegistrationEnabled(): boolean {
  const raw = process.env.REGISTRATION_ENABLED?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function getFrontendUrl(): string {
  const url = process.env.FRONTEND_URL?.trim() || 'http://localhost:5173';
  return url.replace(/\/$/, '');
}

export function getResendConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export function isEmailVerificationConfigured(): boolean {
  return isRegistrationEnabled() && getResendConfig() !== null;
}
