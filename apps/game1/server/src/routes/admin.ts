import { Router } from 'express';
import { requireAdmin } from '../middleware/auth';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import * as adminService from '../services/admin.service';
import * as pvpService from '../services/pvp.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const router = Router();

// ─── 所有管理后台路由都需要管理员权限 ───
router.use(requireAdmin);

/**
 * GET /admin/players - 玩家列表（分页 + 搜索 + 排序）
 */
router.get('/admin/players', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize as string) || 20, 1), 100);
    const search = req.query.search as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

    const result = await adminService.getPlayerList({ page, pageSize, search, sortBy, sortOrder });
    sendSuccess(res, result);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '获取玩家列表失败',
      appErr.statusCode || 500,
    );
  }
});

/**
 * GET /admin/dashboard - 运营数据概览
 */
router.get('/admin/dashboard', async (_req, res) => {
  try {
    const dashboard = await adminService.getAdminDashboard();
    sendSuccess(res, dashboard);
  } catch {
    sendError(res, ErrorCodes.INTERNAL_ERROR, '获取仪表盘数据失败', 500);
  }
});

/**
 * DELETE /admin/players/:id - 软删除玩家
 */
router.delete('/admin/players/:id', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id as string, 10);
    const result = await adminService.softDeletePlayer(playerId);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '删除玩家失败',
      appErr.statusCode || 500,
    );
  }
});

/**
 * GET /admin/achievements - 成就统计（各成就解锁人数 + 解锁率）
 */
router.get('/admin/achievements', async (_req, res) => {
  try {
    const stats = await adminService.getAchievementStats();
    sendSuccess(res, { items: stats });
  } catch {
    sendError(res, ErrorCodes.INTERNAL_ERROR, '获取成就统计失败', 500);
  }
});

/**
 * GET /admin/pvp/leaderboard - PVP 排行榜
 */
router.get('/admin/pvp/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const leaderboard = await pvpService.getLeaderboard(limit, offset);
    sendSuccess(res, leaderboard);
  } catch {
    sendError(res, ErrorCodes.INTERNAL_ERROR, '获取排行榜失败', 500);
  }
});

/**
 * GET /admin/players/:id/detail - 玩家详细信息（包含成就、PVP、存档元数据）
 */
router.get('/admin/players/:id/detail', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id as string, 10);
    const [player, achievements, pvpRanking, pvpMatches, cloudSave] = await Promise.all([
      prisma.game1Player.findUnique({ where: { id: playerId } }),
      prisma.game1Achievement.findMany({ where: { playerId } }),
      prisma.game1PvpRanking.findUnique({ where: { playerId } }),
      prisma.game1PvpMatch.findMany({
        where: { OR: [{ playerId }, { opponentId: playerId }] },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.game1CloudSave.findUnique({ where: { playerId } }),
    ]);

    if (!player) {
      return sendError(res, ErrorCodes.NOT_FOUND, '玩家不存在', 404);
    }

    sendSuccess(res, {
      player,
      achievements: achievements.map((a) => ({
        achievementId: a.achievementId,
        title: a.title,
        unlocked: a.progress >= 1.0,
        progress: a.progress,
        unlockedAt: a.unlockedAt,
      })),
      pvpRanking: pvpRanking
        ? {
            rating: pvpRanking.rating,
            rank: pvpRanking.rank,
            wins: pvpRanking.wins,
            losses: pvpRanking.losses,
            season: pvpRanking.season,
          }
        : null,
      recentMatches: pvpMatches.map((m) => ({
        id: m.id,
        opponentId: m.playerId === playerId ? m.opponentId : m.playerId,
        result: m.playerId === playerId ? m.result : (m.result === 'win' ? 'loss' : m.result === 'loss' ? 'win' : m.result),
        ratingChange: m.playerId === playerId ? m.ratingChange : -m.ratingChange,
        season: m.season,
        playedAt: m.createdAt,
      })),
      saveData: cloudSave
        ? {
            version: cloudSave.version,
            checksum: cloudSave.checksum,
            updatedAt: cloudSave.updatedAt,
          }
        : null,
    });
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(res, appErr.errCode || ErrorCodes.INTERNAL_ERROR, appErr.message || '获取玩家详情失败', appErr.statusCode || 500);
  }
});

/**
 * GET /admin/pvp/matches - PVP 对战记录列表
 */
router.get('/admin/pvp/matches', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize as string) || 20, 1), 100);
    const playerId = req.query.playerId ? parseInt(req.query.playerId as string, 10) : undefined;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (playerId) {
      where['OR'] = [{ playerId }, { opponentId: playerId }];
    }

    const [items, total] = await Promise.all([
      prisma.game1PvpMatch.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          player: { select: { id: true, nickname: true } },
          opponent: { select: { id: true, nickname: true } },
        },
      }),
      prisma.game1PvpMatch.count({ where: where as any }),
    ]);

    sendSuccess(res, {
      items: items.map((m) => ({
        id: m.id,
        playerId: m.playerId,
        playerName: m.player.nickname,
        opponentId: m.opponentId,
        opponentName: m.opponent.nickname,
        result: m.result,
        ratingChange: m.ratingChange,
        playerRating: m.playerRating,
        opponentRating: m.opponentRating,
        season: m.season,
        playedAt: m.createdAt,
      })),
      total,
      page,
      pageSize,
    });
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(res, appErr.errCode || ErrorCodes.INTERNAL_ERROR, appErr.message || '获取对战记录失败', appErr.statusCode || 500);
  }
});

/**
 * GET /admin/achievements/trend - 成就解锁趋势
 */
router.get('/admin/achievements/trend', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const unlocks = await prisma.game1Achievement.findMany({
      where: { unlockedAt: { gte: since }, progress: { gte: 1.0 } },
      orderBy: { unlockedAt: 'asc' },
      select: { unlockedAt: true },
    });

    // 按日期分组
    const dateMap = new Map<string, number>();
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      dateMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const u of unlocks) {
      const key = u.unlockedAt.toISOString().slice(0, 10);
      dateMap.set(key, (dateMap.get(key) || 0) + 1);
    }

    const sorted = Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b));

    sendSuccess(res, {
      dates: sorted.map(([d]) => d),
      unlockCounts: sorted.map(([, c]) => c),
      totalUnlocks: unlocks.length,
    });
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(res, appErr.errCode || ErrorCodes.INTERNAL_ERROR, appErr.message || '获取成就趋势失败', appErr.statusCode || 500);
  }
});

export default router;
