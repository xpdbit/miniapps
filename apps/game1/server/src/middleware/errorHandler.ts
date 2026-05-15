import { type Request, type Response, type NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { sendError, ErrorCodes } from '../utils/response';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as Express.Request & { requestId?: string }).requestId || 'unknown';

  if (err instanceof AppError) {
    logger.warn('AppError', {
      requestId,
      errCode: err.errCode,
      message: err.message,
      stack: err.stack,
    });
    sendError(res, err.errCode, err.message, err.statusCode);
    return;
  }

  logger.error('UnhandledError', {
    requestId,
    message: err.message,
    stack: err.stack,
  });
  sendError(res, ErrorCodes.INTERNAL_ERROR, '服务器内部错误', 500);
}
