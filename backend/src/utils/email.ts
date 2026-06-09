import https from 'https';
import dns from 'dns';
import { getResendConfig } from './registration';

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

export function isConsoleEmailMode(): boolean {
  const raw = process.env.REGISTRATION_EMAIL_CONSOLE?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function isEmailConfigured(): boolean {
  return getResendConfig() !== null;
}

/** Отправка через HTTPS (обход проблем Node fetch / DNS на части окружений). */
function sendViaHttps(
  apiKey: string,
  payload: { from: string; to: string; subject: string; html: string },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'api.resend.com',
        port: 443,
        path: '/emails',
        method: 'POST',
        family: 4,
        lookup: (hostname, _opts, cb) => {
          dns.lookup(hostname, { family: 4 }, cb);
        },
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'legal-boards-backend',
        },
        timeout: 20_000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
            return;
          }
          try {
            const parsed = JSON.parse(raw) as { message?: string; name?: string };
            reject(
              new Error(
                parsed.message ||
                  `Resend HTTP ${res.statusCode ?? '?'}: ${raw.slice(0, 200)}`,
              ),
            );
          } catch {
            reject(new Error(`Resend HTTP ${res.statusCode ?? '?'}: ${raw.slice(0, 200)}`));
          }
        });
      },
    );

    req.on('error', (err) => {
      reject(
        new Error(
          `Не удалось подключиться к Resend (${err.message}). Проверьте интернет, DNS и VPN.`,
        ),
      );
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Таймаут подключения к Resend (api.resend.com)'));
    });

    req.write(body);
    req.end();
  });
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const config = getResendConfig();
  if (!config) {
    throw new Error('Email-сервис не настроен (RESEND_API_KEY, RESEND_FROM)');
  }

  if (isConsoleEmailMode()) {
    console.log('[email:console] Письмо не отправлено (REGISTRATION_EMAIL_CONSOLE=true)');
    console.log(`  to: ${params.to}`);
    console.log(`  subject: ${params.subject}`);
    console.log(`  html preview: ${params.html.slice(0, 120)}…`);
    return;
  }

  await sendViaHttps(config.apiKey, {
    from: config.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

export function buildVerificationEmailHtml(name: string, verifyUrl: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a; margin: 0 0 16px;">Подтверждение регистрации</h2>
      <p style="color: #334155; line-height: 1.5;">Здравствуйте, ${name}!</p>
      <p style="color: #334155; line-height: 1.5;">
        Для завершения регистрации в Legal Boards перейдите по ссылке:
      </p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Подтвердить email
        </a>
      </p>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
        Ссылка действительна 24 часа. Если вы не регистрировались, просто проигнорируйте это письмо.
      </p>
      <p style="color: #94a3b8; font-size: 12px; word-break: break-all;">${verifyUrl}</p>
    </div>
  `;
}
