import { defineConfig } from '@tarojs/cli'
import path from 'path'
import devConfig from './dev'
import prodConfig from './prod'

const baseConfig = {
  projectName: 'ai-tavern',
  date: '2026-05-10',
  designWidth: 750,
  deviceRatio: { 640: 2.34 / 2, 750: 1, 828: 1.81 / 2 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [
    '@tarojs/plugin-platform-weapp',
    '@tarojs/plugin-framework-react',
    '@tarojs/plugin-html',
  ],
  defineConstants: {
    'process.env.TARO_ENV': JSON.stringify('weapp'),
    'process.env.TARO_APP_API_BASE': JSON.stringify(process.env.TARO_APP_API_BASE || 'http://localhost:3002/api/v1'),
  },
  copy: { patterns: [{ from: 'src/assets/icons/', to: 'assets/icons/' }], options: {} },
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
    postcss: {
      autoprefixer: { enable: true, config: {} },
      cssModules: { enable: false, config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' } },
    },
  },
}

export default defineConfig((merge, { mode }) => {
  const envConfig = mode === 'production' ? prodConfig : devConfig
  return merge({}, baseConfig, envConfig)
})
