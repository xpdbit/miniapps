/**
 * Theme Class 路由 - 管理端 CRUD
 *
 * GET    /                           获取 class 列表
 * GET    /:classId                   获取单个 class
 * POST   /                           创建 class
 * PUT    /:classId                   更新 class
 * DELETE /:classId                   删除 class
 * GET    /allowed-properties         获取 CSS 属性白名单
 */
import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { ErrorCode } from '../types/api';
import * as themeClassService from '../services/theme-class.service';

const router = Router();

/**
 * GET /api/v1/theme-classes
 * 获取 class 列表
 * Query: ?projectId=ftg&category=official
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, category } = req.query as Record<string, string | undefined>;
    const classes = await themeClassService.getAll(projectId, category);
    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: classes });
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
 * GET /api/v1/theme-classes/allowed-properties
 * 获取 CSS 属性白名单
 */
router.get('/allowed-properties', async (_req: Request, res: Response) => {
  try {
    const properties = themeClassService.getAllowedCssProperties();
    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: properties });
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
 * GET /api/v1/theme-classes/:classId
 */
router.get('/:classId', async (req: Request, res: Response) => {
  try {
    const classId = req.params.classId as string;
    const cls = await themeClassService.getById(classId);
    if (!cls) {
      res.status(404).json({
        success: false,
        errCode: ErrorCode.NOT_FOUND,
        errMsg: 'Class 不存在',
        data: null,
      });
      return;
    }
    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: cls });
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
 * POST /api/v1/theme-classes
 * Body: { name, cssProperties, category?, description?, projectId? }
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, cssProperties, category, description, projectId } = req.body;

    if (!name || !cssProperties) {
      res.status(400).json({
        success: false,
        errCode: ErrorCode.INVALID_PARAMS,
        errMsg: '缺少必要参数 name / cssProperties',
        data: null,
      });
      return;
    }

    const cls = await themeClassService.create({ name, cssProperties, category, description, projectId });
    res.status(201).json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: cls });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('CSS 属性校验失败')) {
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
 * PUT /api/v1/theme-classes/:classId
 */
router.put('/:classId', requireAuth, async (req: Request, res: Response) => {
  try {
    const classId = req.params.classId as string;
    const { name, cssProperties, category, description, isActive } = req.body;

    const cls = await themeClassService.update(classId, { name, cssProperties, category, description, isActive });
    if (!cls) {
      res.status(404).json({
        success: false,
        errCode: ErrorCode.NOT_FOUND,
        errMsg: 'Class 不存在',
        data: null,
      });
      return;
    }
    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: cls });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('CSS 属性校验失败')) {
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
 * DELETE /api/v1/theme-classes/:classId
 */
router.delete('/:classId', requireAuth, async (req: Request, res: Response) => {
  try {
    const classId = req.params.classId as string;
    const deleted = await themeClassService.deleteByClassId(classId);
    if (!deleted) {
      res.status(404).json({
        success: false,
        errCode: ErrorCode.NOT_FOUND,
        errMsg: 'Class 不存在',
        data: null,
      });
      return;
    }
    res.json({ success: true, errCode: ErrorCode.SUCCESS, errMsg: 'ok', data: null });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('已被主题引用')) {
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

export default router;
