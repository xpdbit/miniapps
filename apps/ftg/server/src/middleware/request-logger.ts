/**
 * 请求日志中间件
 *
 * 基于 Winston 记录每个请求的关键信息：
 * - HTTP 方法、URL、状态码
 * - 响应耗时
 * - User-Agent、客户端 IP
 *
 * 跳过 /health 健康检查端点以减少噪声。
 * 自动脱敏 Authorization / Cookie / API-Key 等敏感头。
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/** 不应记录到日志的请求头 */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'token',
  'x-auth-token',
]);

/** 健康检查路径前缀（含 /health 及其变体） */
const HEALTH_PATH_PATTERN = /^\/health(\/|$)/i;

/**
 * 从请求对象中提取安全的日志上下文
 * 自动脱敏敏感头信息
 */
function sanitizeHeaders(req: Request): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!key || SENSITIVE_HEADERS.has(key.toLowerCase())) continue;
    if (typeof value === 'string') {
      safe[key] = value;
    } else if (Array.isArray(value)) {
      safe[key] = value.join(', ');
    }
  }
  return safe;
}

/**
 * 请求日志中间件
 *
 * 在响应完成（finish）或关闭（close）事件触发时记录日志，
 * 确保状态码和耗时信息完整。
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // 跳过健康检查端点
  if (HEALTH_PATH_PATTERN.test(req.path)) {
    next();
    return;
  }

  const start = Date.now();

  // 在响应结束时记录日志
  res.on('finish', () => {
    const duration = Date.now() - start;

    logger.info('HTTP', {
      method: req.method,
      url: req.originalUrl ?? req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ua: req.headers['user-agent'] ?? '-',
      ip: req.ip ?? req.socket.remoteAddress ?? '-',
    });
  });

  // 如果连接提前关闭（如客户端断开），也记录
  res.on('close', () => {
    if (!res.writableFinished) {
      const duration = Date.now() - start;
      logger.warn('HTTP (aborted)', {
        method: req.method,
        url: req.originalUrl ?? req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ua: req.headers['user-agent'] ?? '-',
        ip: req.ip ?? req.socket.remoteAddress ?? '-',
      });
    }
  });

  next();
}

/**
 * 记录请求体（仅非敏感路由，用于调试）
 * 生产环境下不应开启
 */
export function requestBodyLogger(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && Object.keys(req.body).length > 0) {
    const safeBody = { ...req.body };
    // 脱敏常见敏感字段
    for (const key of ['password', 'secret', 'token', 'apiKey', 'api_key']) {
      if (key in safeBody) {
        safeBody[key] = '***';
      }
    }
    logger.debug('Request body', { url: req.originalUrl ?? req.url, body: safeBody });
  }
  next();
}
