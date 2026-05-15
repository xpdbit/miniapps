import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import * as shareService from '../services/share.service';

const router = Router();

/**
 * POST /social/share-callback - 记录分享事件
 */
router.post('/social/share-callback', requireAuth, async (req, res) => {
  try {
    const { shareType } = req.body as { shareType?: string };

    if (!shareType || typeof shareType !== 'string') {
      sendError(res, ErrorCodes.VALIDATION_ERROR, '缺少分享类型', 400);
      return;
    }

    if (!shareService.isValidShareType(shareType)) {
      sendError(
        res,
        ErrorCodes.VALIDATION_ERROR,
        `无效的分享类型，可选值: pvp_victory, prestige, achievement, normal`,
        400,
      );
      return;
    }

    const record = await shareService.recordShare(req.player!.playerId, shareType);
    sendSuccess(res, record);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '记录分享失败',
      appErr.statusCode || 500,
    );
  }
});

/**
 * GET /social/share-stats - 获取当前玩家的分享统计
 */
router.get('/social/share-stats', requireAuth, async (req, res) => {
  try {
    const stats = await shareService.getPlayerShareStats(req.player!.playerId);
    sendSuccess(res, stats);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '获取分享统计失败',
      appErr.statusCode || 500,
    );
  }
});

/**
 * GET /admin/share-stats - 获取全局分享统计（需管理员权限）
 */
router.get('/admin/share-stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const stats = await shareService.getGlobalShareStats();
    sendSuccess(res, stats);
  } catch {
    sendError(res, ErrorCodes.INTERNAL_ERROR, '获取全局分享统计失败', 500);
  }
});

export default router;
