import { Router } from 'express';
import { requireAdmin } from '../middleware/auth';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import * as adminService from '../services/admin.service';
import * as pvpService from '../services/pvp.service';

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
    sendSuccess(res, stats);
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

export default router;
