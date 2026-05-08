import { defineConfig } from '@tarojs/cli';
import path from 'path';

import devConfig from './dev';
import prodConfig from './prod';

// ─── 基础配置（开发/生产共享部分） ────────────────────────
const baseConfig = {
  projectName: 'food-theme-generator',
  date: '2026-05-01',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [
    '@tarojs/plugin-platform-weapp',
    '@tarojs/plugin-framework-react',
    '@tarojs/plugin-html',
  ],
  defineConstants: {
    'process.env.TARO_ENV': JSON.stringify('weapp'),
    'process.env.CLOUDBASE_ENV_ID': JSON.stringify(process.env.CLOUDBASE_ENV_ID || ''),
    'process.env.TARO_APP_API_BASE': JSON.stringify(process.env.TARO_APP_API_BASE || 'https://47.94.108.150/api/v1'),
    'process.env.TARO_APP_MOCK_AUTH': JSON.stringify(process.env.TARO_APP_MOCK_AUTH || 'false'),
    'process.env.QQ_MAP_KEY': JSON.stringify(process.env.QQ_MAP_KEY || 'YOUR_QQ_MAP_KEY_HERE'),
  },
  copy: {
    patterns: [
      // 复制 tabBar 图标到构建输出（app.json 中引用的路径）
      { from: 'src/assets/icons/', to: 'assets/icons/' },
    ],
    options: {},
  },
  framework: 'react',
  compiler: 'webpack5',
  cache: {
    enable: false,
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
    webpackChain(chain) {
      chain.resolve.alias
        .set('@', path.resolve(__dirname, '..', 'src'))
        .set('@utils', path.resolve(__dirname, '..', 'src/utils'))
        .set('@components', path.resolve(__dirname, '..', 'src/components'))
        .set('@services', path.resolve(__dirname, '..', 'src/services'))
        .set('@types', path.resolve(__dirname, '..', 'src/types'))
        .set('@constants', path.resolve(__dirname, '..', 'src/constants'))
        .set('@stores', path.resolve(__dirname, '..', 'src/stores'));
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: {
        enable: true,
        config: {},
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
  },
};

export default defineConfig((merge, { mode }) => {
  // mode === 'production' 时（npm run build:weapp:prod），合并 prod.ts
  // 否则（npm run dev:weapp），合并 dev.ts
  const envConfig = mode === 'production' ? prodConfig : devConfig;
  return merge({}, baseConfig, envConfig);
});
