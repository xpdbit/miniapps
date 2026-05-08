import { Router } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './auth';
import userRoutes from './users';
import recordsRoutes from './records';
import pipelineRoutes from './pipeline';
import shareRoutes from './share';
import recognizeRoutes from './recognize';
import textgenRoutes from './textgen';
import checkinRoutes from './checkins';
import themeRoutes from './themes';
import themeClassRoutes from './theme-classes';
import themeRenderRoutes from './theme-render';
import achievementRoutes from './achievements';
import apikeyRoutes from './apikeys';
import favoriteRoutes from './favorites';
import uploadRoutes from './upload';

const router: Router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Auth routes
router.use('/api/v1/auth', authRoutes);

// User routes
router.use('/api/v1/users', userRoutes);

// Food record routes
router.use('/api/v1/records', recordsRoutes);

// AI pipeline routes
router.use('/api/v1/pipeline', pipelineRoutes);

// Share card & IP location routes
router.use('/api/v1', shareRoutes);

// Food recognition routes
router.use('/api/v1/recognize', recognizeRoutes);

// AI text generation routes
router.use('/api/v1/generate-text', textgenRoutes);

// Check-in routes
router.use('/api/v1/checkins', checkinRoutes);

// Theme routes (public + admin)
router.use('/api/v1/themes', themeRoutes);

// Theme class routes (admin)
router.use('/api/v1/theme-classes', themeClassRoutes);

// Theme render routes (public + admin)
router.use('/api/v1/theme', themeRenderRoutes);

// Achievement system routes
router.use('/api/v1/achievements', achievementRoutes);

// API Key management routes
router.use('/api/v1/api-keys', apikeyRoutes);

// Favorite routes
router.use('/api/v1/favorites', favoriteRoutes);

// Image upload routes (替代 wx.cloud.uploadFile)
router.use('/api/v1/upload', uploadRoutes);

// ============================================================
// Swagger / OpenAPI docs
// ============================================================
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'FTG API',
    version: '1.0.0',
    description: '食物主题生成器后端 API 文档',
  },
  servers: [
    { url: '/api/v1', description: 'API v1' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

const specs = swaggerJsdoc({
  swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/routes/*.js'],
});

router.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(specs, { explorer: true }));

export default router;
