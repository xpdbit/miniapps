import { defineConfig } from '@tarojs/cli';
import path from 'path';

import devConfig from './dev';
import prodConfig from './prod';
import domain from '../../../../domain.config.js';

const baseConfig = {
  projectName: 'game1-miniapp',
  date: '2026-05-08',
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
    '@tarojs/plugin-platform-h5',
    '@tarojs/plugin-framework-react',
    '@tarojs/plugin-html',
  ],
  defineConstants: {
    'process.env.TARO_ENV': JSON.stringify(process.env.TARO_ENV || 'weapp'),
    'process.env.TARO_APP_API_BASE': JSON.stringify(process.env.TARO_APP_API_BASE || domain.GAME1.DEV),
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
      // 禁用 ModuleConcatenationPlugin，防止 module 被内联优化后
      // 无法通过 __webpack_modules__[moduleId] 访问，避免
      // "n[e] is not a function" 运行时错误
      chain.optimization.concatenateModules(false);

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
    router: {
      mode: 'hash',
    },
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
    webpackChain(chain) {
      chain.resolve.alias
        .set('@', path.resolve(__dirname, '..', 'src'))
        .set('@utils', path.resolve(__dirname, '..', 'src/utils'))
        .set('@components', path.resolve(__dirname, '..', 'src/components'))
        .set('@services', path.resolve(__dirname, '..', 'src/services'))
        .set('@types', path.resolve(__dirname, '..', 'src/types'))
        .set('@constants', path.resolve(__dirname, '..', 'src/constants'))
        .set('@stores', path.resolve(__dirname, '..', 'src/stores'))
        // core-js-pure 3.x 已移除 web/ 路径，映射到兼容 shim
        .set('core-js-pure/web/url', path.resolve(__dirname, '..', 'h5-polyfills', 'url-shim'))
        .set('core-js-pure/web/url-search-params', path.resolve(__dirname, '..', 'h5-polyfills', 'url-search-params-shim'));

      // 显式启用 HMR plugin
      if (process.env.NODE_ENV !== 'production') {
        const webpack = require('webpack')
        chain.plugin('hmr').before('fastRefreshPlugin').use(webpack.HotModuleReplacementPlugin)
      }
    },
  },
};

export default defineConfig((merge, { mode }) => {
  const envConfig = mode === 'production' ? prodConfig : devConfig;
  return merge({}, baseConfig, envConfig);
});
