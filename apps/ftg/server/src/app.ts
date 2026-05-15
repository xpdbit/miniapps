import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import path from 'path';
import { env } from './config/env';
import logger from './utils/logger';
import routes from './routes/index';
import { globalRateLimiter, recognitionRateLimiter, aiGenerationRateLimiter } from './middleware/rate-limiter';
import { requestLogger } from './middleware/request-logger';

const app: Express = express();

// Trust the first proxy (Nginx) — required for correct req.protocol,
// req.ip, and X-Forwarded-* headers behind reverse proxy
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Security headers (helmet)
// 生产环境中启用严格的安全策略，开发环境放宽以便调试
// ---------------------------------------------------------------------------
const isProduction = env.NODE_ENV === 'production';

app.use(
  helmet({
    // 内容安全策略：API 不提供 HTML，限制为同源资源
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'none'"],
            styleSrc: ["'none'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'none'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'none'"],
            frameSrc: ["'none'"],
          },
        }
      : false,

    // 严格传输安全：仅在生产环境启用
    strictTransportSecurity: isProduction
      ? {
          maxAge: 31536000, // 1 年
          includeSubDomains: true,
          preload: true,
        }
      : false,

    // X-Frame-Options: DENY — 不允许被嵌入 iframe
    frameguard: { action: 'deny' },

    // 禁止嗅探 MIME 类型
    noSniff: true,

    // 禁用 IE 的 XSS 过滤（已废弃，但仍防御）
    xssFilter: true,

    // 不暴露 Express / X-Powered-By
    hidePoweredBy: true,

    // 移除对旧版 IE 的兼容（不输出 X-Download-Options）
    ieNoOpen: true,

    // 禁止通过 Referer 泄露来源
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

    // DNS 预取控制
    dnsPrefetchControl: { allow: false },

    // 跨域资源策略：允许微信小程序跨域加载头像图片
    // 默认 same-origin 会阻止微信小程序 WebView 加载 /uploads/ 下的资源
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// ---------------------------------------------------------------------------
// CORS
// 生产环境只允许白名单中的域名，开发环境允许所有来源（方便调试）
// ---------------------------------------------------------------------------
const corsWhitelist: string[] = env.CORS_ORIGINS
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = isProduction
  ? {
      origin: (origin, callback) => {
        // 允许无 origin 的请求（如服务端、Postman、curl）
        if (!origin) {
          callback(null, true);
          return;
        }
        if (corsWhitelist.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 86400, // 预检请求缓存 24 小时
    }
  : {
      origin: '*',
      credentials: true,
    };

app.use(cors(corsOptions));

// ---------------------------------------------------------------------------
// Body parsing
// JSON 限制 5MB（base64 编码图片上传），URL-encoded 也限制 1MB
// 图片上传由 multer 在路由层单独处理（限制 10MB）
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---------------------------------------------------------------------------
// 全局速率限制（100 次 / 15 分钟 / IP）
// ---------------------------------------------------------------------------
app.use(globalRateLimiter);

// ---------------------------------------------------------------------------
// 专用速率限制
// - 图片识别：POST /api/v1/records 限 10 次/分钟/用户
// - AI 生成：POST /api/v1/pipeline/start 限 5 次/分钟/用户
// ---------------------------------------------------------------------------
app.use('/api/v1/records', recognitionRateLimiter);
app.use('/api/v1/pipeline/start', aiGenerationRateLimiter);

// ---------------------------------------------------------------------------
// 请求日志（放在速率限制之后可看到被限流的请求记录）
// ---------------------------------------------------------------------------
app.use(requestLogger);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/', routes);

// ---------------------------------------------------------------------------
// Static files — 头像上传目录
// ---------------------------------------------------------------------------
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), {
  maxAge: '7d',
  etag: true,
}));

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // 如果是 CORS 错误，返回 403
  if (err.message.startsWith('Origin ')) {
    res.status(403).json({
      success: false,
      errCode: 1004,
      errMsg: '跨域请求被拒绝',
      data: null,
    });
    return;
  }

  logger.error('Unhandled error:', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal Server Error' });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const port: number = env.PORT;

const server = app.listen(port, () => {
  logger.info(`Server is running on http://localhost:${port}`);
  logger.info(`Health check: http://localhost:${port}/health`);
});

// 与 Nginx 保持长连接复用，防止每个请求新建 TCP 连接
// keepAliveTimeout 需略高于 Nginx 的 keepalive_timeout (65s)
server.keepAliveTimeout = 65 * 1000; // 65s
server.headersTimeout = 70 * 1000;   // 70s，必须大于 keepAliveTimeout
server.timeout = 30 * 1000;          // 30s 请求超时，防止慢请求占用连接

export default app;
