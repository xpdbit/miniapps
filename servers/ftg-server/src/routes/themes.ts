/**
 * 主题路由 - 公开查询 & 管理端 CRUD
 *
 * GET  /                           公开查询主题列表（支持 isActive/projectId 过滤）
 * GET  /by-short/:shortName        通过短命名查询（公开）
 * GET  /:themeId                   公开查询单个主题详情
 * GET  /:themeId/stats             主题使用统计
 * POST /                           创建主题（管理端）
 * PUT  /:themeId                   更新主题（管理端）
 * PATCH /:themeId/toggle           切换启用/禁用状态（管理端）
 * DELETE /:themeId                 删除主题（管理端）
 * POST /:themeId/usage             记录使用次数（MiniApp 调用）
 */
import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { ErrorCode } from '../types/api';
import * as themeService from '../services/theme.service';

const router = Router();

// ============================================================
// 公开接口 - 无需登录
// ============================================================

/**
 * GET /api/v1/themes
 * 查询主题列表
 * Query: ?isActive=true  只返回启用中的主题
 *        ?isActive=false 只返回已禁用的主题
 *        ?projectId=ftg  过滤项目
 *        不传则返回全部
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { isActive, projectId } = req.query as Record<string, string | undefined>;
    const isActiveFilter = isActive !== undefined ? isActive === 'true' : undefined;
    const themes = await themeService.getAll(isActiveFilter, projectId);
    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: themes });
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
 * GET /api/v1/themes/by-short/:shortName
 * 通过短命名查询主题
 */
router.get('/by-short/:shortName', async (req: Request, res: Response) => {
  try {
    const shortName = req.params.shortName as string;
    const theme = await themeService.getByShortName(shortName);
    if (!theme) {
      res.status(404).json({
        success: false,
        errCode: ErrorCode.THEME_NOT_FOUND,
        errMsg: '主题不存在',
        data: null,
      });
      return;
    }
    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: theme });
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
 * GET /api/v1/themes/:themeId
 * 查询单个主题详情（含 templateMarkup, cssClasses 等）
 */
router.get('/:themeId', async (req: Request, res: Response) => {
  try {
    const themeId = req.params.themeId as string;
    const theme = await themeService.getById(themeId);
    if (!theme) {
      res.status(404).json({
        success: false,
        errCode: ErrorCode.THEME_NOT_FOUND,
        errMsg: '主题不存在',
        data: null,
      });
      return;
    }
    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: theme });
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
 * GET /api/v1/themes/:themeId/stats
 * 主题使用统计
 */
router.get('/:themeId/stats', async (req: Request, res: Response) => {
  try {
    const themeId = req.params.themeId as string;
    const stats = await themeService.getUsageStats(themeId);
    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: stats });
  } catch (error) {
    const message = (error as Error).message;
    if (message === '主题不存在') {
      res.status(404).json({
        success: false,
        errCode: ErrorCode.THEME_NOT_FOUND,
        errMsg: message,
        data: null,
      });
      return;
    }
    res.status(500).json({
      success: false,
      errCode: ErrorCode.DB_OPERATION_FAILED,
      errMsg: message,
      data: null,
    });
  }
});

// ============================================================
// 管理接口 - 需要登录
// ============================================================

/**
 * POST /api/v1/themes
 * 创建新主题
 * Body: { name, description?, shortName?, gameName, templateMarkup?, cssClasses?, configJson?, previewImageUrl?, isActive?, sortOrder? }
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      name, description, shortName, projectId, gameName,
      configJson, templateMarkup, cssClasses,
      previewImageUrl, isActive, sortOrder,
    } = req.body;

    if (!name || !gameName) {
      res.status(400).json({
        success: false,
        errCode: ErrorCode.INVALID_PARAMS,
        errMsg: '缺少必要参数 name / gameName',
        data: null,
      });
      return;
    }

    const theme = await themeService.create({
      name, description, shortName, projectId,
      gameName, configJson, templateMarkup, cssClasses,
      previewImageUrl, isActive, sortOrder,
    });
    res.status(201).json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: theme });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('configJson') || message.includes('base64') || message.includes('shortName')) {
      res.status(400).json({
        success: false,
        errCode: ErrorCode.INVALID_PARAMS,
        errMsg: message,
        data: null,
      });
      return;
    }
    res.status(500).json({
      success: false,
      errCode: ErrorCode.DB_OPERATION_FAILED,
      errMsg: message,
      data: null,
    });
  }
});

/**
 * PUT /api/v1/themes/:themeId
 * 更新主题
 */
router.put('/:themeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const themeId = req.params.themeId as string;
    const {
      name, description, shortName, projectId, gameName,
      configJson, templateMarkup, cssClasses,
      previewImageUrl, isActive, sortOrder,
    } = req.body;

    const theme = await themeService.update(themeId, {
      name, description, shortName, projectId, gameName,
      configJson, templateMarkup, cssClasses,
      previewImageUrl, isActive, sortOrder,
    });
    if (!theme) {
      res.status(404).json({
        success: false,
        errCode: ErrorCode.THEME_NOT_FOUND,
        errMsg: '主题不存在',
        data: null,
      });
      return;
    }
    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: theme });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('configJson') || message.includes('base64') || message.includes('shortName')) {
      res.status(400).json({
        success: false,
        errCode: ErrorCode.INVALID_PARAMS,
        errMsg: message,
        data: null,
      });
      return;
    }
    res.status(500).json({
      success: false,
      errCode: ErrorCode.DB_OPERATION_FAILED,
      errMsg: message,
      data: null,
    });
  }
});

/**
 * PATCH /api/v1/themes/:themeId/toggle
 * 切换主题启用/禁用状态
 */
router.patch('/:themeId/toggle', requireAuth, async (req: Request, res: Response) => {
  try {
    const themeId = req.params.themeId as string;
    const theme = await themeService.toggleActive(themeId);
    if (!theme) {
      res.status(404).json({
        success: false,
        errCode: ErrorCode.THEME_NOT_FOUND,
        errMsg: '主题不存在',
        data: null,
      });
      return;
    }
    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: theme });
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
 * DELETE /api/v1/themes/:themeId
 * 删除主题
 */
router.delete('/:themeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const themeId = req.params.themeId as string;
    const deleted = await themeService.deleteByThemeId(themeId);
    if (!deleted) {
      res.status(404).json({
        success: false,
        errCode: ErrorCode.THEME_NOT_FOUND,
        errMsg: '主题不存在',
        data: null,
      });
      return;
    }
    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: null });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('引用')) {
      res.status(409).json({
        success: false,
        errCode: ErrorCode.DB_OPERATION_FAILED,
        errMsg: message,
        data: null,
      });
      return;
    }
    res.status(500).json({
      success: false,
      errCode: ErrorCode.DB_OPERATION_FAILED,
      errMsg: message,
      data: null,
    });
  }
});

/**
 * POST /api/v1/themes/:themeId/usage
 * 记录主题使用次数
 * Body: { recordId: string, userId: number }
 */
router.post('/:themeId/usage', async (req: Request, res: Response) => {
  try {
    const themeId = req.params.themeId as string;
    const { recordId, userId } = req.body;

    if (!recordId || userId === undefined) {
      res.status(400).json({
        success: false,
        errCode: ErrorCode.INVALID_PARAMS,
        errMsg: '缺少必要参数 recordId / userId',
        data: null,
      });
      return;
    }

    await themeService.recordUsage(themeId, recordId, userId);
    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: null });
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
