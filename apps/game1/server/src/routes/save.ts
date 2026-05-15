import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import * as saveService from '../services/save.service';
import { mergeSaveData } from '../services/sync.service';

const router = Router();

interface UploadSaveBody {
  saveData: Record<string, unknown>;
  expectedVersion?: number;
}

// PUT /save/:playerId — 上传存档
router.put('/save/:playerId', requireAuth, async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId as string, 10);
    if (req.player!.playerId !== playerId) {
      sendError(res, ErrorCodes.FORBIDDEN, '只能操作自己的存档', 403);
      return;
    }

    const { saveData, expectedVersion } = req.body as UploadSaveBody;

    if (!saveData || typeof saveData !== 'object' || Array.isArray(saveData)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, '无效的存档数据', 400);
      return;
    }

    // 检查存档大小 < 1MB
    const raw = JSON.stringify(saveData);
    const size = Buffer.byteLength(raw, 'utf-8');
    if (size > 1024 * 1024) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, '存档数据超过 1MB 限制', 413);
      return;
    }

    // 自动冲突解决：当 expectedVersion 不匹配时，执行智能合并
    if (expectedVersion !== undefined) {
      const mergeResult = await mergeSaveData(playerId, saveData, expectedVersion);
      sendSuccess(res, mergeResult);
    } else {
      const result = await saveService.uploadSave(playerId, saveData);
      sendSuccess(res, result);
    }
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '上传存档失败',
      appErr.statusCode || 500,
    );
  }
});

// GET /save/:playerId — 下载存档
router.get('/save/:playerId', requireAuth, async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId as string, 10);
    if (req.player!.playerId !== playerId) {
      sendError(res, ErrorCodes.FORBIDDEN, '只能查看自己的存档', 403);
      return;
    }

    const save = await saveService.downloadSave(playerId);
    sendSuccess(res, save);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '获取存档失败',
      appErr.statusCode || 500,
    );
  }
});

// DELETE /save/:playerId — 删除存档
router.delete('/save/:playerId', requireAuth, async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId as string, 10);
    if (req.player!.playerId !== playerId) {
      sendError(res, ErrorCodes.FORBIDDEN, '只能删除自己的存档', 403);
      return;
    }

    await saveService.deleteSave(playerId);
    sendSuccess(res, { message: '存档已删除' });
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '删除存档失败',
      appErr.statusCode || 500,
    );
  }
});

// GET /save/:playerId/meta — 获取存档元信息
router.get('/save/:playerId/meta', requireAuth, async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId as string, 10);
    if (req.player!.playerId !== playerId) {
      sendError(res, ErrorCodes.FORBIDDEN, '只能查看自己的存档信息', 403);
      return;
    }

    const meta = await saveService.getSaveMeta(playerId);
    sendSuccess(res, meta);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '获取存档信息失败',
      appErr.statusCode || 500,
    );
  }
});

export default router;
