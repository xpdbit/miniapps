/**
 * AI 流水线路由
 *
 * POST /api/v1/pipeline/start       - 启动流水线（上传图片 → 识别 → 生成描述）
 * GET  /api/v1/pipeline/:id/status  - 查询流水线状态
 */
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { startPipeline, getPipelineStatus } from '../services/pipeline.service';
import { ErrorCode } from '../types/api';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.use(requireAuth);

/**
 * POST /start
 * 上传食物图片启动 AI 流水线
 * 返回 pipelineId，后台异步执行识别 + 生成
 */
router.post('/start', upload.single('image'), async (req, res) => {
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

    const themeId = (req.body.themeId as string) || 'theme_classic';
    const result = await startPipeline(req.user!.uuid, req.file.buffer, themeId);

    res.status(202).json({
      success: true,
      errCode: ErrorCode.SUCCESS,
      errMsg: '流水线已启动',
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({
      success: false,
      errCode: ErrorCode.UNKNOWN,
      errMsg: message,
      data: null,
    });
  }
});

/**
 * GET /:id/status
 * 查询流水线当前状态
 */
router.get('/:id/status', async (req, res) => {
  try {
    const status = await getPipelineStatus(req.params.id, req.user!.uuid);

    if (!status) {
      res.status(404).json({
        success: false,
        errCode: ErrorCode.NOT_FOUND,
        errMsg: '流水线不存在',
        data: null,
      });
      return;
    }

    res.json({
      success: true,
      errCode: ErrorCode.SUCCESS,
      errMsg: 'ok',
      data: status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({
      success: false,
      errCode: ErrorCode.UNKNOWN,
      errMsg: message,
      data: null,
    });
  }
});

export default router;
