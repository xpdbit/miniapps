import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from './config';
import { globalLimiter } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { sendError, ErrorCodes } from './utils/response';
import { logger } from './utils/logger';
import routes from './routes';

const app: Express = express();
const isProduction = config.nodeEnv === 'production';

// ─── 1. Security headers ───
app.use(
  helmet({
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
    strictTransportSecurity: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
    ieNoOpen: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    dnsPrefetchControl: { allow: false },
  }),
);

// ─── 2. CORS ───
app.use(
  cors(
    isProduction
      ? {
          origin: config.corsOrigin.split(',').map((s) => s.trim()).filter(Boolean),
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization'],
          maxAge: 86400,
        }
      : { origin: '*', credentials: true },
  ),
);

// ─── 3. Body parsing ───
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── 4. Global rate limiting ───
app.use(globalLimiter);

// ─── 5. Request logging ───
app.use(requestLogger);

// ─── 6. Health check ───
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 7. API Routes ───
app.use('/api/v1/game1', routes);

// ─── 8. 404 handler ───
app.use((_req: Request, res: Response) => {
  sendError(res, ErrorCodes.NOT_FOUND, '接口不存在', 404);
});

// ─── 9. Global error handler ───
app.use(errorHandler);

// ─── Validate env ───
validateConfig();

// ─── Start server ───
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(config.port, () => {
    logger.info(`Game1 Server started on port ${config.port}`);
    logger.info(`Health check: http://localhost:${config.port}/health`);
  });
  server.keepAliveTimeout = 65 * 1000;
  server.headersTimeout = 70 * 1000;
  server.timeout = 30 * 1000;
}

export default app;
