import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response';
import { ErrorCodes } from '../utils/response';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, ErrorCodes.RATE_LIMITED, '请求过于频繁，请稍后再试', 429);
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, ErrorCodes.RATE_LIMITED, '登录请求过于频繁', 429);
  },
});

export const saveUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, ErrorCodes.RATE_LIMITED, '上传过于频繁', 429);
  },
});

export const pvpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, ErrorCodes.RATE_LIMITED, '对战请求过于频繁', 429);
  },
});
