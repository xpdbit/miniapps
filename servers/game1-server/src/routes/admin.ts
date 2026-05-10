import { Router } from 'express';
import { requireAdmin } from '../middleware/auth';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import * as adminService from '../services/admin.service';

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

export default router;
