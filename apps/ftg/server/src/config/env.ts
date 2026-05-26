import dotenv from 'dotenv';

dotenv.config();

export interface EnvConfig {
  /** Server port (default: 3000) */
  PORT: number;
  /** Node environment */
  NODE_ENV: string;

  /** MySQL database URL for Prisma */
  DATABASE_URL: string;
  /** Redis connection URL */
  REDIS_URL: string;

  /** Alibaba Cloud OSS region */
  OSS_REGION: string;
  /** Alibaba Cloud OSS bucket name */
  OSS_BUCKET: string;
  /** Alibaba Cloud OSS access key ID */
  OSS_ACCESS_KEY_ID: string;
  /** Alibaba Cloud OSS access key secret */
  OSS_ACCESS_KEY_SECRET: string;

  /** JWT signing secret */
  JWT_SECRET: string;

  /** WeChat Mini Program app ID */
  WECHAT_APPID: string;
  /** WeChat Mini Program secret */
  WECHAT_SECRET: string;

  /** DashScope AI API key */
  DASHSCOPE_API_KEY: string;

  /** AES-256-GCM encryption key (32 bytes hex or base64) */
  ENCRYPTION_KEY: string;

  /** CORS allowed origins (comma-separated). Default: http://localhost:3000 */
  CORS_ORIGINS: string;

  /** Server public URL (dev: http://localhost:3000, prod: https://mnapp.top) */
  PUBLIC_URL: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    // In development, warn about missing env vars instead of crashing
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[env] Warning: Environment variable ${key} is not set`);
    }
    return '';
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    console.warn(`[env] Warning: Environment variable ${key} is not a valid number, using default ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

export const env: EnvConfig = {
  PORT: getEnvNumber('PORT', 3000),
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),

  DATABASE_URL: getEnvVar('DATABASE_URL'),
  REDIS_URL: getEnvVar('REDIS_URL'),

  OSS_REGION: getEnvVar('OSS_REGION'),
  OSS_BUCKET: getEnvVar('OSS_BUCKET'),
  OSS_ACCESS_KEY_ID: getEnvVar('OSS_ACCESS_KEY_ID'),
  OSS_ACCESS_KEY_SECRET: getEnvVar('OSS_ACCESS_KEY_SECRET'),

  JWT_SECRET: getEnvVar('JWT_SECRET'),

  WECHAT_APPID: getEnvVar('WECHAT_APPID'),
  WECHAT_SECRET: getEnvVar('WECHAT_SECRET'),

  DASHSCOPE_API_KEY: getEnvVar('DASHSCOPE_API_KEY'),

  ENCRYPTION_KEY: getEnvVar('ENCRYPTION_KEY'),

  CORS_ORIGINS: getEnvVar('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173,https://mnapp.top,https://ftl.mnapp.top'),

  PUBLIC_URL: getEnvVar('PUBLIC_URL', 'http://localhost:3000'),
};
