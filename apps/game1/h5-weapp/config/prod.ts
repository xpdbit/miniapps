import type { UserConfigExport } from '@tarojs/cli';

export default {
  logger: {
    quiet: true,
    stats: false,
  },
  mini: {},
  h5: {
    publicPath: './',
  },
} satisfies UserConfigExport;
