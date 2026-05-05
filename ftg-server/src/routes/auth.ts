import { Router, type Request, type Response } from 'express';
import { wechatLogin, getUserById } from '../services/auth.service';
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

export default router;
