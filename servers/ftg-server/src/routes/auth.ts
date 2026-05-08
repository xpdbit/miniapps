import { Router, type Request, type Response } from 'express';
import { wechatLogin, getUserById } from '../services/auth.service';
import { updateUserProfile } from '../services/user.service';
import { requireAuth } from '../middleware/auth';
import type { ApiResponse } from '../types/api';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Body: { code: string }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      const response: ApiResponse = {
        success: false,
        errCode: 1001,
        errMsg: '缺少参数 code',
        data: null,
      };
      res.status(400).json(response);
      return;
    }

    const result = await wechatLogin(code);
    const response: ApiResponse = {
      success: true,
      errCode: 0,
      errMsg: '登录成功',
      data: result,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      errCode: 1000,
      errMsg: (error as Error).message,
      data: null,
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/v1/auth/me
 * Requires authentication
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.user!.userId);
    if (!user) {
      const response: ApiResponse = {
        success: false,
        errCode: 2001,
        errMsg: '用户不存在',
        data: null,
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      errCode: 0,
      errMsg: 'ok',
      data: { user },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      errCode: 1000,
      errMsg: (error as Error).message,
      data: null,
    };
    res.status(500).json(response);
  }
});

/**
 * PATCH /api/v1/auth/me
 * Update current user's profile (nickname, avatarUrl)
 * Requires authentication
 */
router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const { nickname, avatarUrl } = req.body;

    // Validate types
    if (nickname !== undefined && typeof nickname !== 'string') {
      res.status(400).json({ success: false, errCode: 1001, errMsg: 'nickname 必须是字符串', data: null });
      return;
    }
    if (avatarUrl !== undefined && typeof avatarUrl !== 'string') {
      res.status(400).json({ success: false, errCode: 1001, errMsg: 'avatarUrl 必须是字符串', data: null });
      return;
    }

    const updatedUser = await updateUserProfile(req.user!.userId, { nickname, avatarUrl });
    if (!updatedUser) {
      res.status(200).json({ success: true, errCode: 0, errMsg: '未提供需要更新的字段', data: null });
      return;
    }

    const response: ApiResponse = {
      success: true,
      errCode: 0,
      errMsg: 'ok',
      data: { user: updatedUser },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      errCode: 1000,
      errMsg: (error as Error).message,
      data: null,
    };
    res.status(500).json(response);
  }
});

export default router;
