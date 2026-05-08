import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  openid: string;
  userId: number;
}

const SECRET = env.JWT_SECRET;
const EXPIRES_IN = '7d';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
