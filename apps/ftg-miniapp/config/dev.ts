import type { UserConfigExport } from '@tarojs/cli';
import domain from '../../../domain.config.js';

// 开发环境 API 基础地址
// 构建时可通过环境变量覆盖：TARO_APP_API_BASE=http://your-ip:port/api/v1
// 使用 HTTP 而非 HTTPS，避免真机调试时自签名 SSL 证书导致的连接失败
// 生产环境（--mode production）使用 config/prod.ts 中的 HTTPS 配置
const DEV_API_BASE = process.env.TARO_APP_API_BASE || domain.FTG.DEV;

export default {
  logger: {
    quiet: false,
    stats: true,
  },
  defineConstants: {
    'process.env.TARO_APP_API_BASE': JSON.stringify(DEV_API_BASE),
  },
  mini: {},
  h5: {},
} satisfies UserConfigExport;
