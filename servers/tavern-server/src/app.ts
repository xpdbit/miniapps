import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';

const app = express();

// 安全中间件
app.use(helmet());

// CORS
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// 请求体解析
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 限流
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
}));

// 请求日志
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/', routes);

// 错误处理
app.use(errorHandler);

export default app;
