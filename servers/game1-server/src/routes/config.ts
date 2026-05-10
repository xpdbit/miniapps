import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import * as configService from '../services/config.service';

const router = Router();

// GET /config/:key - 公开：获取单个配置
router.get('/config/:key', async (req, res) => {
  try {
    const key = req.params.key as string;
    const value = await configService.getConfig(key);
    sendSuccess(res, { key, value });
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '服务器错误',
      appErr.statusCode || 500,
    );
  }
});

// GET /config/keys - 公开：获取所有配置键名
router.get('/config/keys', async (_req, res) => {
  try {
    const keys = await configService.getConfigKeys();
    sendSuccess(res, { keys });
  } catch {
    sendError(res, ErrorCodes.INTERNAL_ERROR, '服务器错误', 500);
  }
});

// POST /config/batch - 公开：批量获取配置（body: { keys: string[] }）
router.post('/config/batch', async (req, res) => {
  try {
    const { keys } = req.body as { keys?: string[] };
    if (!Array.isArray(keys)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, '缺少有效的 keys 参数', 400);
      return;
    }
    const configs = await configService.getConfigs(keys);
    sendSuccess(res, { configs });
  } catch {
    sendError(res, ErrorCodes.INTERNAL_ERROR, '服务器错误', 500);
  }
});

// PUT /config/:key - 管理员：更新配置
router.put('/config/:key', requireAuth, requireAdmin, async (req, res) => {
  try {
    const key = req.params.key as string;
    const { value } = req.body;
    if (value === undefined) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, '缺少 value 参数', 400);
      return;
    }
    const updatedBy = req.player?.playerId?.toString() || 'admin';
    await configService.updateConfig(key, value, updatedBy);
    sendSuccess(res, { key, updated: true });
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '更新失败',
      appErr.statusCode || 500,
    );
  }
});

export default router;
