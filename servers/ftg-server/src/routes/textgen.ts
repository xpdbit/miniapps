/**
 * AI 文本生成路由 - 生成食物主题描述
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { generateDescription } from '../services/textgen.service';
import { ErrorCode } from '../types/api';

const router = Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  try {
    const { foodName, foodType, themeId } = req.body;
    if (!foodName || !themeId) {
      res.status(400).json({ success: false, errCode: ErrorCode.INVALID_PARAMS, errMsg: '缺少参数', data: null });
      return;
    }

    const result = await generateDescription({ foodName, foodType: foodType || 'other', themeId });
    res.json({ success: true, errCode: 0, errMsg: 'ok', data: result });
  } catch (error) {
    res.status(500).json({ success: false, errCode: ErrorCode.TEXT_GENERATE_FAILED, errMsg: (error as Error).message, data: null });
  }
});

export default router;
