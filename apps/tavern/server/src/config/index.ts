import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3002'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string(),
  WECHAT_APP_ID: z.string(),
  WECHAT_APP_SECRET: z.string().optional().default(''),
  DASHSCOPE_API_KEY: z.string().optional().default(''),
  OPENCODE_API_KEY: z.string().optional().default(''),
  OPENCODE_BASE_URL: z.string().optional().default('https://opencode.ai/zen/go/v1'),
  ENCRYPTION_KEY: z.string(),
  ADMIN_TOKEN: z.string().optional().default(''),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('环境变量校验失败:', parsed.error.format());
  process.exit(1);
}

export const config = {
  port: parseInt(parsed.data.PORT, 10),
  databaseUrl: parsed.data.DATABASE_URL,
  redisUrl: parsed.data.REDIS_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  wechatAppId: parsed.data.WECHAT_APP_ID,
  wechatAppSecret: parsed.data.WECHAT_APP_SECRET,
  dashscopeApiKey: parsed.data.DASHSCOPE_API_KEY,
  opencodeApiKey: parsed.data.OPENCODE_API_KEY,
  opencodeBaseUrl: parsed.data.OPENCODE_BASE_URL,
  encryptionKey: parsed.data.ENCRYPTION_KEY,
  adminToken: parsed.data.ADMIN_TOKEN,
  corsOrigin: parsed.data.CORS_ORIGIN,
};
