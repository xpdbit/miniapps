import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload, AuthenticatedRequest } from '../types';

export type { AuthPayload, AuthenticatedRequest };

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

// Required authentication - returns 401 if no valid token
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 401, message: '未登录', data: null });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    req.user = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ code: 401, message: '登录已过期，请重新登录', data: null });
  }
}

// Optional authentication - sets req.user if token valid, continues regardless
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    req.user = { userId: payload.sub, role: payload.role };
  } catch {
    // Token invalid, continue without user
  }
  next();
}

// Admin-only middleware
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({ code: 403, message: '无权限', data: null });
      return;
    }
    next();
  });
}
