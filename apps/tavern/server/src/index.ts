import { createServer, default as app } from './app';
import { config } from './config';
import logger from './utils/logger';

// 使用 createServer() 以启用正确的超时配置（SSE 长连接支持）
const server = createServer();

server.listen(config.port, () => {
  logger.info(`服务器运行在端口 ${config.port}`);
});

// 优雅关闭
function shutdown(signal: string) {
  logger.info(`${signal} 收到，关闭服务器...`);
  server.close((err) => {
    if (err) {
      logger.error('关闭服务器时出错:', err);
      process.exit(1);
    }
    logger.info('服务器已关闭');
    process.exit(0);
  });

  // 强制关闭超时（10 秒后如果还没关完就强制退出）
  setTimeout(() => {
    logger.error('强制关闭超时，退出进程');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// 防止未捕获的异常导致静默退出
process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常:', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('未处理的 Promise 拒绝:', reason);
});
