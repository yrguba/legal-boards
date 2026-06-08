import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  getFrontendUrl,
  isEmailVerificationConfigured,
  isRegistrationEnabled,
} from '../utils/registration';
import { buildVerificationEmailHtml, isConsoleEmailMode, sendEmail } from '../utils/email';

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
  departmentId?: string | null;
  avatar?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: user.departmentId ?? undefined,
    avatar: user.avatar ?? undefined,
  };
}

function createVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

router.get('/registration-config', (_req, res) => {
  res.json({ enabled: isRegistrationEnabled() });
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
        role: 'member',
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

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
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
        departmentId: true,
        avatar: true,
        emailVerified: true,
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

export default router;
