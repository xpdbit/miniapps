import { Router } from 'express';
import { wechatLogin, getPlayerById } from '../services/auth.service';
import { requireAuth } from '../middleware/auth';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';

const router = Router();

router.post('/auth/login', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      sendError(res, ErrorCodes.VALIDATION_ERROR, '缺少微信登录 code', 400);
      return;
    }
    const result = await wechatLogin(code);
    sendSuccess(res, result, 200);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '登录失败',
      appErr.statusCode || 500,
    );
  }
});

router.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const player = await getPlayerById(req.player!.playerId);
    if (!player) {
      sendError(res, ErrorCodes.NOT_FOUND, '玩家不存在', 404);
      return;
    }
    sendSuccess(res, player);
  } catch {
    sendError(res, ErrorCodes.INTERNAL_ERROR, '服务器错误', 500);
  }
});

export default router;
