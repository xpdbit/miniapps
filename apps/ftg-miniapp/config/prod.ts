import type { UserConfigExport } from '@tarojs/cli';
import path from 'path';
import domain from '../../../domain.config.js';

// ─── 生产环境 API 地址 ──────────────────────────────────
// 构建时可通过环境变量覆盖：TARO_APP_API_BASE=https://your-domain.com/api/v1
// 默认为 ECS 部署地址（见 deploy/scripts/deploy.sh 部署摘要）
// ────────────────────────────────────────────────────────
const PROD_API_BASE = process.env.TARO_APP_API_BASE || domain.FTG.PROD;

export default {
  logger: {
    quiet: true,
    stats: false,
  },
  defineConstants: {
    'process.env.TARO_APP_API_BASE': JSON.stringify(PROD_API_BASE),
  },
  mini: {},
  h5: {
    publicPath: './',
  },
} satisfies UserConfigExport;
