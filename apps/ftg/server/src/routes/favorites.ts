/**
 * 收藏路由
 *
 * POST   /              → 收藏一条记录
 * DELETE /:recordId     → 取消收藏
 * GET    /              → 收藏列表（分页）
 * GET    /check?ids=    → 批量检查收藏状态
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  addFavorite,
  removeFavorite,
  listFavorites,
  isFavorited,
  batchCheckFavorited,
} from '../services/favorite.service';

const router = Router();

// 所有收藏路由需要登录
router.use(requireAuth);

/**
 * POST /api/v1/favorites
 * 收藏一条食物记录
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uuid;
    const { recordId } = req.body as { recordId: number };

    if (!recordId || typeof recordId !== 'number') {
      res.status(400).json({ success: false, errCode: 400, errMsg: '缺少 recordId', data: null });
      return;
    }

    const existing = await isFavorited(userId, recordId);
    if (existing) {
      res.json({ success: true, errCode: 0, errMsg: '已收藏', data: null });
      return;
    }

    await addFavorite(userId, recordId);
    res.status(201).json({ success: true, errCode: 0, errMsg: 'ok', data: null });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 7000, errMsg: (error as Error).message, data: null });
  }
});

/**
 * DELETE /api/v1/favorites/:recordId
 * 取消收藏
 */
router.delete('/:recordId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uuid;
    const recordId = parseInt(req.params.recordId as string, 10);

    if (isNaN(recordId)) {
      res.status(400).json({ success: false, errCode: 400, errMsg: '无效的 recordId', data: null });
      return;
    }

    await removeFavorite(userId, recordId);
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: null });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 7000, errMsg: (error as Error).message, data: null });
  }
});

/**
 * GET /api/v1/favorites
 * 收藏列表（分页）
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uuid;
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));

    const result = await listFavorites(userId, { page, limit });
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: result });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 7000, errMsg: (error as Error).message, data: null });
  }
});

/**
 * GET /api/v1/favorites/check?ids=1,2,3
 * 批量检查收藏状态
 */
router.get('/check', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uuid;
    const idsParam = req.query.ids as string | undefined;
    if (!idsParam) {
      res.status(400).json({ success: false, errCode: 400, errMsg: '缺少 ids 参数', data: null });
      return;
    }

    const recordIds = idsParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    const result = await batchCheckFavorited(userId, recordIds);
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: result });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 7000, errMsg: (error as Error).message, data: null });
  }
});

export default router;
