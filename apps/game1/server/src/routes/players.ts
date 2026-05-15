import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import * as playerService from '../services/player.service';
import { reconcilePlayer } from '../services/sync.service';

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

/**
 * PUT /players/:id/sync — 同步游戏数据（带增速校验）
 *
 * 请求: { level, exp, totalMileage, playTime, prestigeCount }
 * 返回:
 *   player: 服务端权威数据
 *   corrected: 是否发生过纠偏
 *   corrections: 纠偏原因列表
 */
router.put('/players/:id/sync', requireAuth, async (req, res) => {
  try {
    const playerId = parseInt(req.params.id as string, 10);
    if (req.player!.playerId !== playerId) {
      sendError(res, ErrorCodes.FORBIDDEN, '只能同步自己的数据', 403);
      return;
    }

    const { level, exp, gold, gems, totalMileage, playTime, prestigeCount } = req.body;
    const result = await playerService.syncPlayerStats(playerId, {
      level,
      exp,
      gold: gold ?? 0,
      gems: gems ?? 0,
      totalMileage,
      playTime,
      prestigeCount,
    });

    sendSuccess(res, result);
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

/**
 * POST /players/:id/reconcile — 登录调协
 *
 * 服务端计算离线收益 + 返回权威数据
 * 客户端启动时调用一次
 */
router.post('/players/:id/reconcile', requireAuth, async (req, res) => {
  try {
    const playerId = parseInt(req.params.id as string, 10);
    if (req.player!.playerId !== playerId) {
      sendError(res, ErrorCodes.FORBIDDEN, '只能调协自己的数据', 403);
      return;
    }

    const result = await reconcilePlayer(playerId);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '调协失败',
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
