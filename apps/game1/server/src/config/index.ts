import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  wechat: {
    appId: process.env.WECHAT_APP_ID || '',
    appSecret: process.env.WECHAT_APP_SECRET || '',
  },
  adminToken: process.env.ADMIN_TOKEN || 'admin-token',
  logLevel: process.env.LOG_LEVEL || 'info',
} as const;

export type Config = typeof config;

const REQUIRED_VARS: Array<{ key: string; name: string }> = [
  { key: 'databaseUrl', name: 'DATABASE_URL' },
  { key: 'jwtSecret', name: 'JWT_SECRET' },
  { key: 'wechat.appId', name: 'WECHAT_APP_ID' },
  { key: 'wechat.appSecret', name: 'WECHAT_APP_SECRET' },
];

export function validateConfig(): void {
  if (config.nodeEnv !== 'production') return;

  const missing: string[] = [];
  for (const varDef of REQUIRED_VARS) {
    const keys = varDef.key.split('.');
    let value: unknown = config;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[k];
      } else {
        value = undefined;
        break;
      }
    }
    if (!value || value === '') {
      missing.push(varDef.name);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `生产环境缺少必要环境变量: ${missing.join(', ')}。请检查 .env 文件。`
    );
  }
}
