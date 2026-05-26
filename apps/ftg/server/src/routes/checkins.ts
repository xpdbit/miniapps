import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { createCheckin, listByUser, getTodayStatus, getStreak } from '../services/checkin.service';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/checkins
 * Body: { foodRecordId: number, latitude?: number, longitude?: number, locationName?: string }
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.uuid;
    const { foodRecordId, latitude, longitude, locationName } = req.body;

    if (!foodRecordId || typeof foodRecordId !== 'number') {
      res.status(400).json({ success: false, errCode: 1001, errMsg: '缺少必要参数 foodRecordId', data: null });
      return;
    }

    const checkin = await createCheckin(userId, foodRecordId, { latitude, longitude, locationName });
    res.status(201).json({ success: true, errCode: 0, errMsg: '打卡成功', data: checkin });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    const statusCode = err.statusCode ?? 500;
    res.status(statusCode).json({ success: false, errCode: 1000, errMsg: err.message, data: null });
  }
});

/**
 * GET /api/v1/checkins
 * Query: ?page=1&limit=20
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.uuid;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await listByUser(userId, page, limit);
    res.json({
      success: true,
      errCode: 0,
      errMsg: 'ok',
      data: {
        list: result.items,
        total: result.total,
        page: result.page,
        pageSize: result.limit,
        totalPages: result.totalPages,
        hasMore: result.page < result.totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 1000, errMsg: (error as Error).message, data: null });
  }
});

/**
 * GET /api/v1/checkins/today
 */
router.get('/today', async (req, res) => {
  try {
    const userId = req.user!.uuid;
    const status = await getTodayStatus(userId);
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: status });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 1000, errMsg: (error as Error).message, data: null });
  }
});

/**
 * GET /api/v1/checkins/streak
 */
router.get('/streak', async (req, res) => {
  try {
    const userId = req.user!.uuid;
    const streak = await getStreak(userId);
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: streak });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 1000, errMsg: (error as Error).message, data: null });
  }
});

export default router;
