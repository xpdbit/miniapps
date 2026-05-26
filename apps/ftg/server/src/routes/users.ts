import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { listUsers, getUserStats, getUserProfile } from '../services/user.service';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/v1/users/me/stats - user statistics
router.get('/me/stats', async (req, res) => {
  try {
    const userId = req.user!.uuid;
    const stats = await getUserStats(userId);
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: stats });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 1000, errMsg: (error as Error).message, data: null });
  }
});

// GET /api/v1/users/me/profile - user public profile
router.get('/me/profile', async (req, res) => {
  try {
    const userId = req.user!.uuid;
    const profile = await getUserProfile(userId);
    if (!profile) {
      res.status(404).json({ success: false, errCode: 2001, errMsg: '用户不存在', data: null });
      return;
    }
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: profile });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 1000, errMsg: (error as Error).message, data: null });
  }
});

// ─── Admin Routes ─────────────────────────────────────────────────────

// GET /api/v1/users - paginated user list (admin)
router.get('/', async (req, res) => {
  try {
    const result = await listUsers({
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 20,
      keyword: req.query.keyword as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, errCode: 1000, errMsg: (error as Error).message, data: null });
  }
});

// GET /api/v1/users/:id/stats - user stats by ID (admin)
router.get('/:id/stats', async (req, res) => {
  try {
    const userId = parseInt(req.params.id as string);
    if (Number.isNaN(userId)) {
      res.status(400).json({ success: false, errCode: 1001, errMsg: '无效的用户ID', data: null });
      return;
    }
    const stats = await getUserStats(userId);
    // Map UserStats to the format expected by Dashboard UserStats interface
    const foodTypeDistribution = Object.entries(stats.foodTypeCounts).map(([type, count]) => ({ type, count }));
    res.json({
      totalFoodRecords: stats.totalRecords,
      totalCheckIns: stats.totalCheckins,
      foodTypeDistribution,
      achievementProgress: [] as { id: string; name: string; progress: number }[],
      recentFoodRecords: [] as { id: number; foodName: string; foodType: string; createdAt: string }[],
    });
  } catch (error) {
    res.status(500).json({ success: false, errCode: 1000, errMsg: (error as Error).message, data: null });
  }
});

export default router;
