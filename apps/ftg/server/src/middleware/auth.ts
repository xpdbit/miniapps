import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ErrorCode } from '../types/api';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: { uuid: string; role: string };
    }
  }
}

/**
 * Require valid JWT authentication
 * Returns 401 with ErrorCode.USER_NOT_LOGIN if token is invalid or missing
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      errCode: ErrorCode.USER_NOT_LOGIN,
      errMsg: '请先登录',
      data: null,
    });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer '
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    req.user = { uuid: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({
      success: false,
      errCode: ErrorCode.USER_NOT_LOGIN,
      errMsg: '登录已过期，请重新登录',
      data: null,
    });
  }
}

/**
 * Optional authentication - attaches user if valid token, continues without error if not
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    req.user = { uuid: payload.sub, role: payload.role };
  } catch {
    // Token invalid - ignore
  }
  next();
}