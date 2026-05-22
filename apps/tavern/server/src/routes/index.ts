import { Router } from 'express';
import { success } from '../utils/response';
import authRoutes from './auth';
import aiRoutes from './ai';
import exportRoutes from './export';
import characterRoutes from './characters';
import chatRoutes from './chat';
import marketRoutes from './market';
import keyRoutes from './keys';
import tierRoutes from './tier';
import adminRoutes from './admin';
import officialRoutes from './official';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json(success({ status: 'ok' }));
});

// Auth routes
router.use('/v1/auth', authRoutes);

// AI generation routes
router.use('/v1/ai', aiRoutes);

// Export routes (MUST be before /characters to match /:id/export)
router.use('/v1', exportRoutes);

// Character card routes
router.use('/v1/characters', characterRoutes);

// Market routes
router.use('/v1/market', marketRoutes);

// Chat routes
router.use('/v1/chat', chatRoutes);

// API Key routes
router.use('/v1/keys', keyRoutes);

// Tier & model access routes (mounted at /v1 for /models, /user/tier, etc.)
router.use('/v1', tierRoutes);

// Admin routes
router.use('/v1/admin', adminRoutes);

// Official cards sync route (replaces built-in)
router.use('/v1/official', officialRoutes);

// Backward-compatible routes (旧 URL 格式兼容，过渡期后移除)
router.use('/api/v1', tierRoutes);
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/ai', aiRoutes);
router.use('/api/v1/characters', characterRoutes);
router.use('/api/v1/market', marketRoutes);
router.use('/api/v1/chat', chatRoutes);
router.use('/api/v1/keys', keyRoutes);
router.use('/api/v1/admin', adminRoutes);
router.use('/api/v1/official', officialRoutes);

export default router;