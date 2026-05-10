import { type Request, type Response, type NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { JwtPayload } from '../types';
import { config } from '../config';
import { sendError, ErrorCodes } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      player?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, ErrorCodes.UNAUTHORIZED, '缺少认证令牌', 401);
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    req.player = payload;
    next();
  } catch {
    sendError(res, ErrorCodes.INVALID_TOKEN, '无效或过期的令牌', 401);
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      req.player = verifyToken(token);
    } catch {
      // Token 无效，忽略
    }
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // 1. 检查 adminToken
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token === config.adminToken) {
      req.player = { playerId: 0, openid: 'admin', role: 'admin' };
      next();
      return;
    }
  }

  // 2. 检查 JWT 中的 role
  if (req.player && req.player.role === 'admin') {
    next();
    return;
  }

  sendError(res, ErrorCodes.FORBIDDEN, '需要管理员权限', 403);
}
