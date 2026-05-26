/**
 * 分享卡片 & IP 定位路由
 *
 * - POST /share-card -> 生成食物记录分享卡片（需登录）
 * - GET  /location/ip -> 获取客户端 IP 地理位置（可选登录）
 */
import { Router, type Request, type Response } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { generateShareCard } from '../services/share.service';
import { getLocationByIP, getClientIP } from '../services/location.service';
import { ErrorCode } from '../types/api';

const router = Router();

/**
 * POST /api/v1/share-card
 *
 * 生成指定食物记录的分享卡片图片。
 * 必须先校验登录状态和记录所有权。
 *
 * Body: { foodRecordId: number }
 */
router.post('/share-card', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uuid;
    const { foodRecordId } = req.body;

    if (!foodRecordId || typeof foodRecordId !== 'number') {
      res.status(400).json({
        success: false,
        errCode: ErrorCode.INVALID_PARAMS,
        errMsg: '缺少必要参数 foodRecordId',
        data: null,
      });
      return;
    }

    const result = await generateShareCard(foodRecordId, userId);
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: result });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    const statusCode = err.statusCode ?? 500;
    res.status(statusCode).json({
      success: false,
      errCode: ErrorCode.SERVICE_UNAVAILABLE,
      errMsg: err.message,
      data: null,
    });
  }
});

/**
 * GET /api/v1/location/ip
 *
 * 根据客户端 IP 返回所在城市、省份和区县信息。
 * 底层调用 ip-api.com 免费接口，结果仅供参考，
 * 不作为精确地理位置依据。
 *
 * 即使定位失败也会以空字段返回，不阻塞请求。
 */
router.get('/location/ip', optionalAuth, async (req: Request, res: Response) => {
  try {
    const ip = getClientIP(req);
    const location = await getLocationByIP(ip);
    res.json({
      success: true,
      errCode: 0,
      errMsg: 'ok',
      data: { ...location, ip },
    });
  } catch {
    // 定位失败返回空数据
    res.json({
      success: true,
      errCode: 0,
      errMsg: 'ok',
      data: { city: '', province: '', district: '', ip: getClientIP(req) },
    });
  }
});

export default router;
