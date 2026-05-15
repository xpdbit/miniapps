import { Response } from 'express';
import { ApiResponse } from '../types';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const body: ApiResponse<T> = { success: true, data };
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  errCode: number,
  errMsg: string,
  statusCode = 400,
): void {
  const body: ApiResponse = { success: false, errCode, errMsg };
  res.status(statusCode).json(body);
}

export const ErrorCodes = {
  UNAUTHORIZED: 1001,
  INVALID_TOKEN: 1002,
  FORBIDDEN: 1003,
  NOT_FOUND: 2001,
  VALIDATION_ERROR: 2002,
  CONFLICT: 2003,
  RATE_LIMITED: 3001,
  INTERNAL_ERROR: 5000,
} as const;
