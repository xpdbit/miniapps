/**
 * 食物识别路由
 * POST /api/v1/recognize - 上传图片进行食物识别
 */
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { recognizeFood } from '../services/recognition.service';
import { ErrorCode } from '../types/api';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.use(requireAuth);

/** 单张图片食物识别 */
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        errCode: ErrorCode.INVALID_PARAMS,
        errMsg: '请上传图片',
        data: null,
      });
      return;
    }

    const result = await recognizeFood(req.file.buffer);
    res.json({
      success: true,
      errCode: 0,
      errMsg: 'ok',
      data: result,
    });
  } catch (error: any) {
    const errCode = error.errCode || ErrorCode.FOOD_RECOGNIZE_FAILED;
    const status = errCode === ErrorCode.NO_FOOD_DETECTED ? 200 : 500;
    res.status(status).json({
      success: false,
      errCode,
      errMsg: error.message,
      data: null,
    });
  }
});

export default router;
