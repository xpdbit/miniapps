import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import * as playerService from '../services/player.service';

const router = Router();

router.get('/players/:id', requireAuth, async (req, res) => {
  try {
    const playerId = parseInt(req.params.id as string, 10);
    const player = await playerService.getPlayer(playerId);
    sendSuccess(res, player);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '服务器错误',
      appErr.statusCode || 500,
    );
  }
});

router.put('/players/:id/profile', requireAuth, async (req, res) => {
  try {
    const playerId = parseInt(req.params.id as string, 10);
    const { nickname, avatarUrl } = req.body;
    if (req.player!.playerId !== playerId) {
      sendError(res, ErrorCodes.FORBIDDEN, '只能更新自己的资料', 403);
      return;
    }
    const player = await playerService.updatePlayerProfile(playerId, { nickname, avatarUrl });
    sendSuccess(res, player);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '更新失败',
      appErr.statusCode || 500,
    );
  }
});

router.get('/players/:id/stats', requireAuth, async (req, res) => {
  try {
    const playerId = parseInt(req.params.id as string, 10);
    const stats = await playerService.getPlayerStats(playerId);
    sendSuccess(res, stats);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '服务器错误',
      appErr.statusCode || 500,
    );
  }
});

router.put('/players/:id/sync', requireAuth, async (req, res) => {
  try {
    const playerId = parseInt(req.params.id as string, 10);
    const { level, exp, totalMileage, playTime, prestigeCount } = req.body;
    const player = await playerService.syncPlayerStats(playerId, {
      level,
      exp,
      totalMileage,
      playTime,
      prestigeCount,
    });
    sendSuccess(res, player);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '同步失败',
      appErr.statusCode || 500,
    );
  }
});

router.get('/rankings', optionalAuth, async (req, res) => {
  try {
    const sortBy = (req.query.sortBy as 'totalMileage' | 'level') || 'totalMileage';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await playerService.getLeaderboard(sortBy, limit, offset);
    sendSuccess(res, result);
  } catch {
    sendError(res, ErrorCodes.INTERNAL_ERROR, '服务器错误', 500);
  }
});

export default router;
