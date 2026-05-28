import { defineConfig } from '@tarojs/cli'
import path from 'path'
import devConfig from './dev'
import prodConfig from './prod'
import domain from '../../../../domain.config.js'

// HtmlWebpackPlugin for H5 entry HTML generation
let HtmlWebpackPlugin: typeof import('html-webpack-plugin') | null = null
try {
  HtmlWebpackPlugin = require('html-webpack-plugin')
} catch { /* optional - will fall back to copy-based approach */ }

// 根据构建类型（weapp/h5）确定输出目录，避免互相覆盖
const targetEnv = process.env.TARO_ENV || 'weapp'
const isH5 = targetEnv === 'h5'
const outputRoot = isH5 ? 'dist-h5' : 'dist-weapp'

const baseConfig = {
  projectName: 'ai-tavern',
  date: '2026-05-10',
  designWidth: 750,
  deviceRatio: { 640: 2.34 / 2, 750: 1, 828: 1.81 / 2 },
  sourceRoot: 'src',
  outputRoot,
  plugins: [
    '@tarojs/plugin-platform-weapp',
    '@tarojs/plugin-platform-h5',
    '@tarojs/plugin-framework-react',
    '@tarojs/plugin-html',
  ],
  copy: {
    patterns: [
      { from: 'src/assets/icons/', to: `${outputRoot}/assets/icons/` },
    ],
    options: {},
  },
  framework: 'react',
  compiler: 'webpack5',
  cache: { enable: false },
  mini: {
    outputRoot: 'dist-weapp',
    prebundle: { enable: false },
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: { enable: false, config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' } },
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
    },
  },
  h5: {
    outputRoot: 'dist-h5',
    publicPath: '/',
    staticDirectory: 'static',
    devServer: {
      port: 5174,
      host: '0.0.0.0',
      hot: true,
      open: false,
      historyApiFallback: true,
    },
    router: {
      mode: 'hash',
      customRoutes: {
        '/pages/cards/index': '/cards',
        '/pages/chat/index': '/chat',
        '/pages/character/index': '/character',
        '/pages/character/detail/index': '/character/detail',
        '/pages/creator/index': '/creator',
        '/pages/profile/index': '/profile',
        '/pages/persona/index': '/persona',
      },
    },
    postcss: {
      autoprefixer: { enable: true, config: {} },
      cssModules: { enable: false, config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' } },
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
        .set('core-js-pure/web/url-search-params', path.resolve(__dirname, '..', 'h5-polyfills', 'url-search-params-shim'))

      // 生成 index.html 入口（H5 Web 必需）
      if (HtmlWebpackPlugin) {
        chain.plugin('html-webpack-plugin').use(HtmlWebpackPlugin, [{
          template: path.resolve(__dirname, '..', 'index.html'),
          filename: 'index.html',
          inject: true,
          minify: process.env.NODE_ENV === 'production' ? {
            removeComments: true,
            collapseWhitespace: true,
          } : false,
        }])
      }

      // 显式启用 HMR plugin — Taro 4.x webpack5-runner 创建 devServer 时
      // 才添加此 plugin（晚于 compiler 编译启动），导致 ReactRefreshPlugin 在首次编译时
      // 无法检测到 HMR 并弹出 warning。此处提前注入，确保 plugin 在 compiler 创建时就存在。
      // 同时仅 dev 模式注入，避免 production 构建中引入 HMR 运行时死代码。
      if (process.env.NODE_ENV !== 'production') {
        const webpack = require('webpack')
        chain.plugin('hmr').before('fastRefreshPlugin').use(webpack.HotModuleReplacementPlugin)
      }
    },
  },
}

export default defineConfig((merge, { mode }) => {
  const envConfig = mode === 'production' ? prodConfig : devConfig
  const apiBase = process.env.TARO_APP_API_BASE || (mode === 'production' ? domain.TAVERN.PROD : domain.TAVERN.DEV)
  const merged = merge({}, baseConfig, envConfig)
  merged.defineConstants = {
    'process.env.TARO_ENV': JSON.stringify(process.env.TARO_ENV || 'weapp'),
    'process.env.TARO_APP_API_BASE': JSON.stringify(apiBase),
  }
  return merged
})
