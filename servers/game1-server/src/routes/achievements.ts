import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import * as achievementService from '../services/achievement.service';

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /achievements/check
 * 检查当前玩家的所有成就条件，解锁符合条件的成就。
 */
router.post('/achievements/check', requireAuth, async (req, res) => {
  try {
    const playerId = req.player!.playerId;

    const [player, pvpWins] = await Promise.all([
      prisma.game1Player.findUnique({ where: { id: playerId } }),
      prisma.game1PvpMatch.count({ where: { playerId, result: 'victory' } }),
    ]);

    if (!player) {
      sendError(res, ErrorCodes.NOT_FOUND, '玩家不存在', 404);
      return;
    }

    const stats: Record<string, number> = {
      totalMileage: player.totalMileage,
      level: player.level,
      pvpWins,
      prestigeCount: player.prestigeCount,
      loginDays: player.loginDays,
    };

    const unlocked = await achievementService.checkAndUnlockAchievements(playerId, stats);
    sendSuccess(res, { unlocked });
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
 * GET /achievements/:playerId
 * 获取指定玩家的完整成就列表（含已解锁和未解锁）。
 */
router.get('/achievements/:playerId', requireAuth, async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId as string, 10);
    const achievements = await achievementService.getPlayerAchievements(playerId);
    sendSuccess(res, achievements);
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

export default router;
