import app from './app';
import { config } from './config';
import logger from './utils/logger';

const server = app.listen(config.port, () => {
  logger.info(`服务器运行在端口 ${config.port}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM 收到，关闭服务器');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});
