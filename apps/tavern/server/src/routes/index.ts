import { Router } from 'express';
import { success } from '../utils/response';
import authRoutes from './auth';
import aiRoutes from './ai';
import exportRoutes from './export';
import characterRoutes from './characters';
import chatRoutes from './chat'
import chatChoiceRoutes from './chat-choice';
import marketRoutes from './market';
import keyRoutes from './keys';
import tierRoutes from './tier';
import adminRoutes from './admin';
import officialRoutes from './official';
import personaRoutes from './personas';
import uploadRoutes from './upload';
import reportRoutes from './reports';
import aiScriptRoutes from './ai-scripts';
import cardSchemeRoutes from './cardSchemes';

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

// Card scheme routes
router.use('/v1/card-schemes', cardSchemeRoutes);

// Chat routes
router.use('/v1/chat', chatRoutes)
router.use('/v1/chat', chatChoiceRoutes);

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

// Backward-compatible routes (鏃?URL 鏍煎紡鍏煎锛岃繃娓℃湡鍚庣Щ闄?
router.use('/api/v1', tierRoutes);
router.use('/api/v1', exportRoutes);
router.use('/api/v1/personas', personaRoutes);
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/ai', aiRoutes);
router.use('/api/v1/characters', characterRoutes);
router.use('/api/v1/market', marketRoutes);
router.use('/api/v1/cards', marketRoutes);
router.use('/api/v1/card-schemes', cardSchemeRoutes);
router.use('/api/v1/chat', chatRoutes)
router.use('/api/v1/chat', chatChoiceRoutes);
router.use('/api/v1/keys', keyRoutes);
router.use('/api/v1/admin', adminRoutes);
router.use('/api/v1/official', officialRoutes);
router.use('/api/v1/upload', uploadRoutes);
router.use('/api/v1/reports', reportRoutes);
router.use('/api/v1/ai-scripts', aiScriptRoutes);

// Backward-compatible routes: legacy URL pattern (/api/tavern/v1/*)
// 鏌愪簺鏃х増瀹㈡埛绔厤缃皢 tavern 鍜?v1 椤哄簭鍐欏弽锛屽吋瀹规妯″紡
router.use('/api/tavern/v1', tierRoutes);
router.use('/api/tavern/v1', exportRoutes);
router.use('/api/tavern/v1/personas', personaRoutes);
router.use('/api/tavern/v1/auth', authRoutes);
router.use('/api/tavern/v1/ai', aiRoutes);
router.use('/api/tavern/v1/characters', characterRoutes);
router.use('/api/tavern/v1/market', marketRoutes);
router.use('/api/tavern/v1/cards', marketRoutes);
router.use('/api/tavern/v1/card-schemes', cardSchemeRoutes);
router.use('/api/tavern/v1/chat', chatRoutes)
router.use('/api/tavern/v1/chat', chatChoiceRoutes);
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
router.use('/api/v1/tavern/cards', marketRoutes);
router.use('/api/v1/tavern/card-schemes', cardSchemeRoutes);
router.use('/api/v1/tavern/chat', chatRoutes)
router.use('/api/v1/tavern/chat', chatChoiceRoutes);
router.use('/api/v1/tavern/keys', keyRoutes);
router.use('/api/v1/tavern/admin', adminRoutes);
router.use('/api/v1/tavern/official', officialRoutes);
router.use('/api/v1/tavern/upload', uploadRoutes);
router.use('/api/v1/tavern/reports', reportRoutes);
router.use('/api/v1/tavern/ai-scripts', aiScriptRoutes);

export default router;