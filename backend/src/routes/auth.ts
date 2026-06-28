import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  getFrontendUrl,
  isEmailVerificationConfigured,
  isPasswordRecoveryEnabled,
  isRegistrationEnabled,
} from '../utils/registration';
import { buildVerificationEmailHtml, isConsoleEmailMode, sendEmail } from '../utils/email';
import {
  buildPasswordResetEmailHtml,
  buildPasswordResetUrl,
  createPasswordResetToken,
  PASSWORD_RESET_TTL_MS,
} from '../utils/passwordReset';
import { normalizeEmail } from '../utils/workspaceRole';
import { verifyPassword } from '../utils/passwordAuth';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function issueToken(user: { id: string; role: string }) {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string | null;
  mustChangePassword?: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar ?? undefined,
    mustChangePassword: user.mustChangePassword ?? false,
  };
}

function createVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

router.get('/registration-config', (_req, res) => {
  res.json({
    enabled: isRegistrationEnabled(),
    passwordRecoveryEnabled: isPasswordRecoveryEnabled(),
  });
});

router.post('/register', async (req, res) => {
  try {
    if (!isRegistrationEnabled()) {
      return res.status(403).json({ error: 'Регистрация отключена' });
    }
    if (!isEmailVerificationConfigured()) {
      return res.status(503).json({
        error: 'Регистрация не настроена: укажите RESEND_API_KEY и RESEND_FROM',
      });
    }

    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password и name обязательны' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [existingUser, lexEmail] = await Promise.all([
      prisma.user.findUnique({ where: { email: normalizedEmail } }),
      prisma.lexClientUser.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    ]);

    if (existingUser) {
      if (!existingUser.emailVerified) {
        return res.status(400).json({
          error: 'Пользователь уже зарегистрирован, но email не подтверждён',
          code: 'EMAIL_NOT_VERIFIED',
        });
      }
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }
    if (lexEmail) {
      return res.status(400).json({ error: 'Этот email зарегистрирован как клиент LEXPRO' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = createVerificationToken();
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: String(name).trim(),
        role: 'admin',
        emailVerified: false,
        emailVerificationToken: token,
        emailVerificationExpiresAt: expiresAt,
      },
    });

    const verifyUrl = `${getFrontendUrl()}/verify-email?token=${token}`;
    try {
      await sendEmail({
        to: user.email,
        subject: 'Подтверждение регистрации — Legal Boards',
        html: buildVerificationEmailHtml(user.name, verifyUrl),
      });
      if (isConsoleEmailMode()) {
        console.log('[registration] Ссылка подтверждения:', verifyUrl);
      }
    } catch (mailErr) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      throw mailErr;
    }

    res.status(201).json({
      message: 'На ваш email отправлена ссылка для подтверждения регистрации',
      email: user.email,
      requiresVerification: true,
    });
  } catch (error) {
    console.error('Registration error:', error);
    const msg = error instanceof Error ? error.message : 'Ошибка регистрации';
    res.status(500).json({ error: msg });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    if (!isRegistrationEnabled()) {
      return res.status(403).json({ error: 'Регистрация отключена' });
    }
    if (!isEmailVerificationConfigured()) {
      return res.status(503).json({ error: 'Email-сервис не настроен' });
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) return res.status(400).json({ error: 'email обязателен' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: 'Если аккаунт существует, письмо будет отправлено' });
    }
    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email уже подтверждён' });
    }

    const token = createVerificationToken();
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: token,
        emailVerificationExpiresAt: expiresAt,
      },
    });

    const verifyUrl = `${getFrontendUrl()}/verify-email?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: 'Подтверждение регистрации — Legal Boards',
      html: buildVerificationEmailHtml(user.name, verifyUrl),
    });

    res.json({ message: 'Письмо с подтверждением отправлено повторно' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Не удалось отправить письмо' });
  }
});

router.get('/verify-email', async (req, res) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (!token) return res.status(400).json({ error: 'Токен не указан' });

    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: 'Недействительная или устаревшая ссылка' });
    }
    if (user.emailVerified) {
      return res.json({
        message: 'Email уже подтверждён',
        alreadyVerified: true,
        token: issueToken(user),
        user: publicUser(user),
      });
    }
    if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Ссылка истекла. Запросите новое письмо.' });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });

    res.json({
      message: 'Email успешно подтверждён',
      token: issueToken(updated),
      user: publicUser(updated),
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Ошибка подтверждения email' });
  }
});

router.get('/invite', async (req, res) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (!token) {
      return res.status(400).json({ error: 'Токен приглашения не указан' });
    }

    const user = await prisma.user.findFirst({
      where: { passwordInviteToken: token },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        mustChangePassword: true,
        passwordInviteExpiresAt: true,
      },
    });

    if (!user) {
      return res.status(400).json({
        error: 'Недействительная ссылка приглашения',
        code: 'INVITE_INVALID',
      });
    }

    if (!user.mustChangePassword) {
      return res.status(400).json({
        error: 'Ссылка уже использована. Вы можете войти со своим паролем.',
        code: 'INVITE_INACTIVE',
        alreadyActivated: true,
      });
    }

    if (!user.passwordInviteExpiresAt || user.passwordInviteExpiresAt < new Date()) {
      return res.status(400).json({
        error: 'Срок действия ссылки истёк. Обратитесь к администратору за новым приглашением.',
        code: 'INVITE_EXPIRED',
      });
    }

    res.json({
      message: 'Перейдите к созданию пароля',
      token: issueToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Ошибка активации приглашения' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const genericMessage = {
    message: 'Если аккаунт существует, на email отправлена ссылка для сброса пароля',
  };

  try {
    if (!isRegistrationEnabled()) {
      return res.status(403).json({ error: 'Восстановление пароля недоступно' });
    }
    if (!isEmailVerificationConfigured()) {
      return res.status(503).json({ error: 'Email-сервис не настроен' });
    }

    const email =
      typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) return res.status(400).json({ error: 'email обязателен' });

    const [user, lexEmail] = await Promise.all([
      prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          emailVerified: true,
          mustChangePassword: true,
          passwordInviteToken: true,
        },
      }),
      prisma.lexClientUser.findUnique({ where: { email }, select: { id: true } }),
    ]);

    if (!user || lexEmail) {
      return res.json(genericMessage);
    }

    if (!user.emailVerified) {
      return res.json(genericMessage);
    }

    if (user.mustChangePassword && user.passwordInviteToken) {
      return res.json(genericMessage);
    }

    const token = createPasswordResetToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const resetUrl = buildPasswordResetUrl(token);
    await sendEmail({
      to: user.email,
      subject: 'Восстановление пароля — Legal Boards',
      html: buildPasswordResetEmailHtml(user.name, resetUrl),
    });

    if (isConsoleEmailMode()) {
      console.log('[password-reset] Ссылка сброса:', resetUrl);
    }

    res.json(genericMessage);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Не удалось отправить письмо' });
  }
});

router.get('/reset-password', async (req, res) => {
  try {
    if (!isRegistrationEnabled()) {
      return res.status(403).json({ error: 'Восстановление пароля недоступно' });
    }

    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (!token) return res.status(400).json({ error: 'Токен не указан' });

    const user = await prisma.user.findFirst({
      where: { passwordResetToken: token },
      select: {
        id: true,
        email: true,
        passwordResetExpiresAt: true,
      },
    });

    if (!user) {
      return res.status(400).json({
        error: 'Недействительная или устаревшая ссылка',
        code: 'RESET_INVALID',
      });
    }

    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      return res.status(400).json({
        error: 'Срок действия ссылки истёк. Запросите восстановление пароля снова.',
        code: 'RESET_EXPIRED',
      });
    }

    res.json({
      message: 'Задайте новый пароль',
      email: user.email,
    });
  } catch (error) {
    console.error('Validate reset password error:', error);
    res.status(500).json({ error: 'Ошибка проверки ссылки' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    if (!isRegistrationEnabled()) {
      return res.status(403).json({ error: 'Восстановление пароля недоступно' });
    }

    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const newPassword = req.body?.newPassword;

    if (!token) return res.status(400).json({ error: 'token обязателен' });
    if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return res.status(400).json({ error: 'Новый пароль должен быть не короче 6 символов' });
    }

    const user = await prisma.user.findFirst({
      where: { passwordResetToken: token },
      select: {
        id: true,
        passwordResetExpiresAt: true,
      },
    });

    if (!user) {
      return res.status(400).json({
        error: 'Недействительная или устаревшая ссылка',
        code: 'RESET_INVALID',
      });
    }

    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      return res.status(400).json({
        error: 'Срок действия ссылки истёк. Запросите восстановление пароля снова.',
        code: 'RESET_EXPIRED',
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(newPassword.trim(), 10),
        mustChangePassword: false,
        passwordInviteToken: null,
        passwordInviteExpiresAt: null,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    res.json({ message: 'Пароль успешно изменён. Теперь вы можете войти.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Ошибка смены пароля' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';
    const email = normalizeEmail(rawEmail);
    const password = rawPassword.trim();

    if (!email || !password) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!user) {
      const lexClient = await prisma.lexClientUser.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (lexClient) {
        return res.status(401).json({
          error: 'Этот email зарегистрирован как клиент LEXPRO. Используйте вход для клиентов.',
          code: 'CLIENT_USE_LEXPRO',
        });
      }
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    if (isRegistrationEnabled() && !user.emailVerified) {
      return res.status(403).json({
        error: 'Подтвердите email перед входом',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    const token = issueToken(user);

    res.json({
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; lexClientId?: string };
    if (decoded.lexClientId) {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        emailVerified: true,
        mustChangePassword: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    if (isRegistrationEnabled() && !user.emailVerified) {
      return res.status(403).json({ error: 'Email не подтверждён', code: 'EMAIL_NOT_VERIFIED' });
    }

    res.json({ user: publicUser(user) });
  } catch {
    res.status(401).json({ error: 'Недействительный токен' });
  }
});

router.post('/change-password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return res.status(400).json({ error: 'Новый пароль должен быть не короче 6 символов' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, email: true, name: true, role: true, avatar: true, password: true, mustChangePassword: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (!user.mustChangePassword) {
      if (typeof currentPassword !== 'string' || !currentPassword) {
        return res.status(400).json({ error: 'Укажите текущий пароль' });
      }
      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) {
        return res.status(401).json({ error: 'Неверный текущий пароль' });
      }
    } else if (typeof currentPassword === 'string' && currentPassword) {
      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) {
        return res.status(401).json({ error: 'Неверный текущий пароль' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(newPassword.trim(), 10),
        mustChangePassword: false,
        passwordInviteToken: null,
        passwordInviteExpiresAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        mustChangePassword: true,
      },
    });

    res.json({ user: publicUser(updated), message: 'Пароль успешно изменён' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Ошибка смены пароля' });
  }
});

export default router;
