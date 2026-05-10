import { Request } from 'express';

export interface AuthPayload {
  userId: string;
  openId?: string;
  role: 'USER' | 'ADMIN';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}
