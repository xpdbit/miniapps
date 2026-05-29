import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';
import { warmupConfigProvider } from './services/config-provider.service';

const app = express();

// 安全中间件
app.use(helmet());

// CORS — 支持多来源（H5 Web 各端口 + Dashboard + 微信小程序）
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// 请求体解析
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 全局限流（宽松，主供聊天场景）
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// 认证端点严限流（防暴力破解）
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁，请稍后再试', data: null },
});

app.use(globalLimiter);

// 请求日志
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/', routes);

// 错误处理
app.use(errorHandler);

/**
 * 创建 HTTP 服务器（带超时配置）
 * 避免 SSE 长连接被默认 5 秒超时切断
 */
export function createServer() {
  const server = http.createServer(app);

  // SSE 流式聊天需要长连接 — 设为 24 小时
  server.keepAliveTimeout = 86400_000;
  server.headersTimeout = 86400_000 + 10_000;
  server.timeout = 0; // 禁用默认超时

  return server;
}

export default app;
