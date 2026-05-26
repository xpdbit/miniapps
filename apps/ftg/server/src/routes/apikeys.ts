/**
 * API Key 管理路由
 *
 * POST   /              - 设置 API Key（加密存储）
 * GET    /:serviceName  - 检查指定服务的 API Key 是否存在
 * DELETE /:serviceName  - 删除指定服务的 API Key
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { ErrorCode } from '../types/api';
import {
  setApiKey,
  getApiKey,
  deleteApiKey,
} from '../services/apikey.service';

const router = Router();

// 所有路由需要登录认证
router.use(requireAuth);

/**
 * POST /api/v1/api-keys
 * 设置 API Key
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.uuid;
    const { serviceName, apiKey } = req.body;

    if (!serviceName || typeof serviceName !== 'string') {
      res.status(400).json({
        success: false,
        errCode: ErrorCode.INVALID_PARAMS,
        errMsg: '缺少参数 serviceName',
        data: null,
      });
      return;
    }

    if (!apiKey || typeof apiKey !== 'string') {
      res.status(400).json({
        success: false,
        errCode: ErrorCode.INVALID_PARAMS,
        errMsg: '缺少参数 apiKey',
        data: null,
      });
      return;
    }

    await setApiKey(userId, serviceName.trim(), apiKey.trim());

    res.json({
      success: true,
      errCode: ErrorCode.SUCCESS,
      errMsg: 'ok',
      data: null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      errCode: ErrorCode.UNKNOWN,
      errMsg: (error as Error).message,
      data: null,
    });
  }
});

/**
 * GET /api/v1/api-keys/:serviceName
 * 检查 API Key 是否存在
 */
router.get('/:serviceName', async (req, res) => {
  try {
    const userId = req.user!.uuid;
    const { serviceName } = req.params;

    if (!serviceName) {
      res.status(400).json({
        success: false,
        errCode: ErrorCode.INVALID_PARAMS,
        errMsg: '缺少参数 serviceName',
        data: null,
      });
      return;
    }

    const result = await getApiKey(userId, serviceName);

    res.json({
      success: true,
      errCode: ErrorCode.SUCCESS,
      errMsg: 'ok',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      errCode: ErrorCode.UNKNOWN,
      errMsg: (error as Error).message,
      data: null,
    });
  }
});

/**
 * DELETE /api/v1/api-keys/:serviceName
 * 删除 API Key
 */
router.delete('/:serviceName', async (req, res) => {
  try {
    const userId = req.user!.uuid;
    const { serviceName } = req.params;

    if (!serviceName) {
      res.status(400).json({
        success: false,
        errCode: ErrorCode.INVALID_PARAMS,
        errMsg: '缺少参数 serviceName',
        data: null,
      });
      return;
    }

    const deleted = await deleteApiKey(userId, serviceName);

    if (!deleted) {
      res.status(404).json({
        success: false,
        errCode: ErrorCode.NOT_FOUND,
        errMsg: 'API Key 不存在',
        data: null,
      });
      return;
    }

    res.json({
      success: true,
      errCode: ErrorCode.SUCCESS,
      errMsg: 'ok',
      data: null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      errCode: ErrorCode.UNKNOWN,
      errMsg: (error as Error).message,
      data: null,
    });
  }
});

export default router;
