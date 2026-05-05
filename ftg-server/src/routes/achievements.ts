/**
 * 成就系统路由
 *
 * GET  /                  → 获取所有成就定义
 * GET  /my                → 获取当前用户的成就进度
 * POST /check             → 检查并解锁成就
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getAllDefinitions,
  getUserAchievements,
  checkAndUnlock,
} from '../services/achievement.service';

const router = Router();

// 所有成就路由需要登录
router.use(requireAuth);

// GET /api/v1/achievements/ - 获取所有成就定义
router.get('/', async (_req, res) => {
  try {
    const definitions = getAllDefinitions();
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: definitions });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 1000, errMsg: (error as Error).message, data: null });
  }
});

// GET /api/v1/achievements/my - 获取当前用户的成就进度
router.get('/my', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const achievements = await getUserAchievements(userId);
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: achievements });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 1000, errMsg: (error as Error).message, data: null });
  }
});

// POST /api/v1/achievements/check - 检查并解锁成就
router.post('/check', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const result = await checkAndUnlock(userId);
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: result });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 1000, errMsg: (error as Error).message, data: null });
  }
});

export default router;
