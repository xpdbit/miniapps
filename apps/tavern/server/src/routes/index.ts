import { Router } from 'express';
import { success } from '../utils/response';
import authRoutes from './auth';
import exportRoutes from './export';
import characterRoutes from './characters';
import chatRoutes from './chat';
import marketRoutes from './market';
import keyRoutes from './keys';
import adminRoutes from './admin';
import officialRoutes from './official';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json(success({ status: 'ok' }));
});

// Auth routes
router.use('/api/v1/auth', authRoutes);

// Export routes (MUST be before /characters to match /:id/export)
router.use('/api/v1', exportRoutes);

// Character card routes
router.use('/api/v1/characters', characterRoutes);

// Market routes
router.use('/api/v1/market', marketRoutes);

// Chat routes
router.use('/api/v1/chat', chatRoutes);

// API Key routes
router.use('/api/v1/keys', keyRoutes);

// Admin routes
router.use('/api/v1/admin', adminRoutes);

// Official cards sync route (replaces built-in)
router.use('/api/v1/official', officialRoutes);

export default router;