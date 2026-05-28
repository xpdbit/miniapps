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
import personaRoutes from './personas';
import uploadRoutes from './upload';
import reportRoutes from './reports';
import aiScriptRoutes from './ai-scripts';

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

// Persona routes
router.use('/v1/personas', personaRoutes);

// Upload routes
router.use('/v1/upload', uploadRoutes);

// Report routes
router.use('/v1/reports', reportRoutes);

// AI Script management routes
router.use('/v1/ai-scripts', aiScriptRoutes);

// Backward-compatible routes (旧 URL 格式兼容，过渡期后移除)
router.use('/api/v1', tierRoutes);
router.use('/api/v1', exportRoutes);
router.use('/api/v1/personas', personaRoutes);
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/ai', aiRoutes);
router.use('/api/v1/characters', characterRoutes);
router.use('/api/v1/market', marketRoutes);
router.use('/api/v1/chat', chatRoutes);
router.use('/api/v1/keys', keyRoutes);
router.use('/api/v1/admin', adminRoutes);
router.use('/api/v1/official', officialRoutes);
router.use('/api/v1/upload', uploadRoutes);
router.use('/api/v1/reports', reportRoutes);
router.use('/api/v1/ai-scripts', aiScriptRoutes);

// Backward-compatible routes: legacy URL pattern (/api/tavern/v1/*)
// 某些旧版客户端配置将 tavern 和 v1 顺序写反，兼容此模式
router.use('/api/tavern/v1', tierRoutes);
router.use('/api/tavern/v1', exportRoutes);
router.use('/api/tavern/v1/personas', personaRoutes);
router.use('/api/tavern/v1/auth', authRoutes);
router.use('/api/tavern/v1/ai', aiRoutes);
router.use('/api/tavern/v1/characters', characterRoutes);
router.use('/api/tavern/v1/market', marketRoutes);
router.use('/api/tavern/v1/chat', chatRoutes);
router.use('/api/tavern/v1/keys', keyRoutes);
router.use('/api/tavern/v1/admin', adminRoutes);
router.use('/api/tavern/v1/official', officialRoutes);
router.use('/api/tavern/v1/upload', uploadRoutes);
router.use('/api/tavern/v1/reports', reportRoutes);
router.use('/api/tavern/v1/ai-scripts', aiScriptRoutes);

// Health check for dev direct-access
router.get('/api/v1/tavern/health', (_req, res) => {
  res.json(success({ status: 'ok' }));
});
router.get('/api/tavern/v1/health', (_req, res) => {
  res.json(success({ status: 'ok' }));
});

// Development direct-access routes (API_BASE_URL = /api/v1/tavern)
router.use('/api/v1/tavern', tierRoutes);
router.use('/api/v1/tavern', exportRoutes);
router.use('/api/v1/tavern/personas', personaRoutes);
router.use('/api/v1/tavern/auth', authRoutes);
router.use('/api/v1/tavern/ai', aiRoutes);
router.use('/api/v1/tavern/characters', characterRoutes);
router.use('/api/v1/tavern/market', marketRoutes);
router.use('/api/v1/tavern/chat', chatRoutes);
router.use('/api/v1/tavern/keys', keyRoutes);
router.use('/api/v1/tavern/admin', adminRoutes);
router.use('/api/v1/tavern/official', officialRoutes);
router.use('/api/v1/tavern/upload', uploadRoutes);
router.use('/api/v1/tavern/reports', reportRoutes);
router.use('/api/v1/tavern/ai-scripts', aiScriptRoutes);

export default router;