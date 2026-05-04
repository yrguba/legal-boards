import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function lexUserPayload(row: {
  id: string;
  email: string;
  name: string;
  clientKind: string;
  companyName: string | null;
  phone: string | null;
  contactNotes: string | null;
}) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: 'lex_client',
    clientKind: row.clientKind,
    companyName: row.companyName ?? undefined,
    phone: row.phone ?? undefined,
    contactNotes: row.contactNotes ?? undefined,
  };
}

router.post('/register', async (req, res) => {
  try {
    const body = req.body as {
      email?: string;
      password?: string;
      name?: string;
      clientKind?: string;
      companyName?: string;
    };

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const clientKind = body.clientKind === 'company' ? 'company' : 'individual';
    const companyName =
      typeof body.companyName === 'string' ? body.companyName.trim() : '';

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Укажите email, пароль и имя' });
    }
    if (clientKind === 'company' && !companyName) {
      return res.status(400).json({ error: 'Укажите название компании' });
    }

    const [staffExists, lexExists] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.lexClientUser.findUnique({ where: { email }, select: { id: true } }),
    ]);

    if (staffExists || lexExists) {
      return res.status(400).json({ error: 'Пользователь с таким email уже зарегистрирован' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const row = await prisma.lexClientUser.create({
      data: {
        email,
        password: hashedPassword,
        name,
        clientKind,
        companyName: clientKind === 'company' ? companyName : null,
      },
    });

    const token = jwt.sign({ lexClientId: row.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: lexUserPayload(row),
    });
  } catch (error) {
    console.error('Lex registration error:', error);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const row = await prisma.lexClientUser.findUnique({ where: { email } });
    if (!row) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    const ok = await bcrypt.compare(password, row.password);
    if (!ok) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    const token = jwt.sign({ lexClientId: row.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: lexUserPayload(row),
    });
  } catch (error) {
    console.error('Lex login error:', error);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { lexClientId?: string };
    if (!decoded.lexClientId) {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    const row = await prisma.lexClientUser.findUnique({
      where: { id: decoded.lexClientId },
    });

    if (!row) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    res.json({ user: lexUserPayload(row) });
  } catch {
    res.status(401).json({ error: 'Недействительный токен' });
  }
});

/** Обновление профиля LEXPRO (контакты и т.д.). POST — как у остальных `/lex/auth/*`; PATCH/PUT — для совместимости. */
async function handleLexProfileUpdate(req: AuthRequest, res: Response) {
  try {
    if (!req.lexClientId) {
      return res.status(403).json({ error: 'Доступно только клиентам LEXPRO' });
    }

    const body = req.body as {
      phone?: unknown;
      contactNotes?: unknown;
      name?: unknown;
      companyName?: unknown;
    };

    const rowCurrent = await prisma.lexClientUser.findUnique({
      where: { id: req.lexClientId },
    });
    if (!rowCurrent) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const phone =
      body.phone === undefined
        ? undefined
        : typeof body.phone === 'string'
          ? body.phone.trim() || null
          : null;
    const contactNotes =
      body.contactNotes === undefined
        ? undefined
        : typeof body.contactNotes === 'string'
          ? body.contactNotes.trim() || null
          : null;
    const name =
      body.name === undefined
        ? undefined
        : typeof body.name === 'string'
          ? body.name.trim()
          : undefined;
    const companyNameRaw =
      body.companyName === undefined
        ? undefined
        : typeof body.companyName === 'string'
          ? body.companyName.trim()
          : undefined;

    if (name !== undefined && !name) {
      return res.status(400).json({ error: 'Имя не может быть пустым' });
    }
    if (rowCurrent.clientKind === 'company' && companyNameRaw !== undefined && !companyNameRaw) {
      return res.status(400).json({ error: 'Укажите название компании' });
    }

    const data: {
      phone?: string | null;
      contactNotes?: string | null;
      name?: string;
      companyName?: string | null;
    } = {};
    if (phone !== undefined) data.phone = phone;
    if (contactNotes !== undefined) data.contactNotes = contactNotes;
    if (name !== undefined) data.name = name;
    if (companyNameRaw !== undefined) {
      data.companyName = rowCurrent.clientKind === 'company' ? companyNameRaw : null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    const updated = await prisma.lexClientUser.update({
      where: { id: req.lexClientId },
      data,
    });

    res.json({ user: lexUserPayload(updated) });
  } catch (error) {
    console.error('Lex profile update error:', error);
    res.status(500).json({ error: 'Ошибка сохранения профиля' });
  }
}

router.post('/profile', authenticate, handleLexProfileUpdate);
router.patch('/profile', authenticate, handleLexProfileUpdate);
router.put('/profile', authenticate, handleLexProfileUpdate);

export default router;
