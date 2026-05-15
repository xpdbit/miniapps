import { defineConfig } from '@tarojs/cli'
import path from 'path'
import devConfig from './dev'
import prodConfig from './prod'
import domain from '../../../../domain.config.js'

const baseConfig = {
  projectName: 'ai-tavern',
  date: '2026-05-10',
  designWidth: 750,
  deviceRatio: { 640: 2.34 / 2, 750: 1, 828: 1.81 / 2 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [
    '@tarojs/plugin-platform-weapp',
    '@tarojs/plugin-platform-h5',
    '@tarojs/plugin-framework-react',
    '@tarojs/plugin-html',
  ],
  copy: {
    patterns: [
      { from: 'src/assets/icons/', to: 'assets/icons/' },
      {
        from: 'node_modules/tdesign-miniprogram-taro/miniprogram_dist/',
        to: 'miniprogram_npm/tdesign-miniprogram/',
        ignore: ['*.ts', '*.map', 'type.js'],
      },
    ],
    options: {},
  },
  framework: 'react',
  compiler: 'webpack5',
  cache: { enable: false },
  mini: {
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
    publicPath: '/',
    staticDirectory: 'static',
    router: {
      mode: 'hash',
      customRoutes: {
        '/pages/market/index': '/market',
        '/pages/chat/index': '/chat',
        '/pages/character/index': '/character',
        '/pages/character/detail/index': '/character/detail',
        '/pages/creator/index': '/creator',
        '/pages/profile/index': '/profile',
        '/pages/persona/index': '/persona',
        '/pages/settings/index': '/settings',
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
