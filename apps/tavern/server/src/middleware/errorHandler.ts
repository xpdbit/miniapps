import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('未处理的错误:', err);

  res.status(500).json({
    code: 500,
    data: null,
    message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
  });
}
