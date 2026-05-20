import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  role: string;
}

const EXPIRES_IN = '7d';

export function signToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
  return jwt.sign(payload, secret, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
  return jwt.verify(token, secret) as JwtPayload;
}