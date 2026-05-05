/**
 * 配置管理入口
 * 聚合环境变量加载并进行必要变量校验
 */

import { env } from './env';

const requiredVars: Array<keyof typeof env> = [
  'DATABASE_URL',
  'JWT_SECRET',
  'WECHAT_APPID',
  'WECHAT_SECRET',
];

for (const key of requiredVars) {
  if (!env[key]) {
    const message = `[config] FATAL: Required environment variable ${key} is not set`;
    if (env.NODE_ENV === 'production') {
      throw new Error(message);
    } else {
      console.warn(message);
    }
  }
}

export { env };
export * from './env';
