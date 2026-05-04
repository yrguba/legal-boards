import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  lexClientId?: string;
}

type JwtPayload = {
  userId?: string;
  role?: string;
  lexClientId?: string;
};

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (decoded.lexClientId) {
      req.lexClientId = decoded.lexClientId;
      next();
      return;
    }
    if (decoded.userId) {
      req.userId = decoded.userId;
      req.userRole = decoded.role;
      next();
      return;
    }
    return res.status(401).json({ error: 'Недействительный токен' });
  } catch {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
};

/** Только учётные записи Legal Boards (User), не клиенты LEXPRO */
export const requireStaffUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.userId) {
    return res.status(403).json({ error: 'Доступно только для сотрудников Legal Boards' });
  }
  next();
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId || !req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
};
