/**
 * 主题渲染路由
 *
 * POST /render-preview      模板预览（管理端，返回渲染 HTML）
 * POST /render              模板渲染（通用，返回结构化的 html + css）
 */
import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { ErrorCode } from '../types/api';
import { render, renderPreview } from '../services/theme-render.service';
import { getById as getClassById } from '../services/theme-class.service';
import type { ThemeClassData } from '../types/template';

const router = Router();

/**
 * POST /api/v1/theme/render-preview
 * 模板预览（管理端）
 * Body: { templateMarkup, cssClassIds[], data{}, mode }
 */
router.post('/render-preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const { templateMarkup, cssClassIds, data, mode } = req.body;

    if (!templateMarkup) {
      res.status(400).json({
        success: false,
        errCode: ErrorCode.INVALID_PARAMS,
        errMsg: '缺少必要参数 templateMarkup',
        data: null,
      });
      return;
    }

    // 按 classId 获取 class 定义
    const cssClasses: ThemeClassData[] = [];
    if (Array.isArray(cssClassIds)) {
      for (const classId of cssClassIds) {
        const cls = await getClassById(classId);
        if (cls) {
          cssClasses.push(cls);
        }
      }
    }

    const previewHtml = await renderPreview({
      templateMarkup,
      cssClasses,
      data: data ?? {},
      mode: mode ?? 'h5',
    });

    res.json({
      success: true,
      errCode: ErrorCode.SUCCESS,
      errMsg: 'ok',
      data: { html: previewHtml },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      errCode: ErrorCode.DB_OPERATION_FAILED,
      errMsg: (error as Error).message,
      data: null,
    });
  }
});

/**
 * POST /api/v1/theme/render
 * 通用模板渲染
 * Body: { templateMarkup, cssClasses[], data{}, mode }
 * cssClasses 为完整的 class 数据（从主题定义中传来）
 */
router.post('/render', async (req: Request, res: Response) => {
  try {
    const { templateMarkup, cssClasses, data, mode } = req.body;

    if (!templateMarkup) {
      res.status(400).json({
        success: false,
        errCode: ErrorCode.INVALID_PARAMS,
        errMsg: '缺少必要参数 templateMarkup',
        data: null,
      });
      return;
    }

    const result = await render({
      templateMarkup,
      cssClasses: cssClasses ?? [],
      data: data ?? {},
      mode: mode ?? 'h5',
    });

    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      errCode: ErrorCode.DB_OPERATION_FAILED,
      errMsg: (error as Error).message,
      data: null,
    });
  }
});

export default router;
