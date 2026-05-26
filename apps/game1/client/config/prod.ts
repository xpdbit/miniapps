import type { UserConfigExport } from '@tarojs/cli';
import domain from '../../../../domain.config.js';

// 生产环境 API 地址
// 构建时可通过环境变量覆盖：TARO_APP_API_BASE=https://your-domain.com/api/v1/game1
const PROD_API_BASE = process.env.TARO_APP_API_BASE || domain.GAME1.PROD;

export default {
  defineConstants: {
    'process.env.TARO_APP_API_BASE': JSON.stringify(PROD_API_BASE),
  },
  logger: {
    quiet: true,
    stats: false,
  },
  mini: {},
  h5: {
    publicPath: './',
  },
} satisfies UserConfigExport;
