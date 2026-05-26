import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { wechatLogin, getUserById, getWechatSession } from '../services/auth.service';
import { updateUserProfile } from '../services/user.service';
import { requireAuth } from '../middleware/auth';
import { decryptWechatData } from '../lib/wechat-crypto';
import type { ApiResponse } from '../types/api';

const router = Router();

// ============================================================
// 头像上传 Multer 配置
// ============================================================
const avatarUploadDir = path.resolve(process.cwd(), 'uploads/avatars');
try {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
} catch {
  // 目录创建失败（如 Docker 容器中非 root 用户权限不足），
  // 头像上传仍可工作：multer 会在写入时 throw，路由 catch 块会清理并返回 500
  console.warn('[auth] 无法创建头像上传目录，头像上传功能可能不可用:', avatarUploadDir);
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarUploadDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as Request & { user?: { userId: number } }).user?.userId ?? 'unknown';
    const ext = path.extname(file.originalname) || '.jpg';
    const timestamp = Date.now();
    cb(null, `avatar_${userId}_${timestamp}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPG/PNG/GIF/WebP 格式的图片'));
    }
  },
});

/**
 * POST /api/v1/auth/login
 * Body: { code: string }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      const response: ApiResponse = {
        success: false,
        errCode: 1001,
        errMsg: '缺少参数 code',
        data: null,
      };
      res.status(400).json(response);
      return;
    }

    const result = await wechatLogin(code);
    const response: ApiResponse = {
      success: true,
      errCode: 0,
      errMsg: '登录成功',
      data: result,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      errCode: 1000,
      errMsg: (error as Error).message,
      data: null,
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/v1/auth/me
 * Requires authentication
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.user!.uuid);
    if (!user) {
      const response: ApiResponse = {
        success: false,
        errCode: 2001,
        errMsg: '用户不存在',
        data: null,
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      errCode: 0,
      errMsg: 'ok',
      data: { user },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      errCode: 1000,
      errMsg: (error as Error).message,
      data: null,
    };
    res.status(500).json(response);
  }
});

/**
 * PATCH /api/v1/auth/me
 * Update current user's profile (nickname, avatarUrl)
 * Requires authentication
 */
router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const { nickname, avatarUrl } = req.body;

    // Validate types
    if (nickname !== undefined && typeof nickname !== 'string') {
      res.status(400).json({ success: false, errCode: 1001, errMsg: 'nickname 必须是字符串', data: null });
      return;
    }
    if (avatarUrl !== undefined && typeof avatarUrl !== 'string') {
      res.status(400).json({ success: false, errCode: 1001, errMsg: 'avatarUrl 必须是字符串', data: null });
      return;
    }

    const updatedUser = await updateUserProfile(req.user!.uuid, { nickname, avatarUrl });
    if (!updatedUser) {
      res.status(200).json({ success: true, errCode: 0, errMsg: '未提供需要更新的字段', data: null });
      return;
    }

    const response: ApiResponse = {
      success: true,
      errCode: 0,
      errMsg: 'ok',
      data: { user: updatedUser },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      errCode: 1000,
      errMsg: (error as Error).message,
      data: null,
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/auth/avatar
 * Upload avatar image (multipart/form-data, field name: "avatar")
 * Requires authentication
 */
router.post('/avatar', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  // 手动调用 multer，捕获 MulterError 并返回友好错误信息
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // Multer 特定错误（文件过大、字段名错误等）
        const messages: Record<string, string> = {
          LIMIT_FILE_SIZE: '头像文件不能超过 5MB',
          LIMIT_FILE_COUNT: '一次只能上传一个头像文件',
          LIMIT_UNEXPECTED_FILE: '上传字段名不正确，请使用 "avatar" 字段',
        };
        const msg = messages[err.code] || err.message;
        res.status(400).json({
          success: false,
          errCode: 1001,
          errMsg: msg,
          data: null,
        } as ApiResponse);
        return;
      }
      // 其他错误（如文件格式不正确，由 fileFilter 抛出）
      res.status(400).json({
        success: false,
        errCode: 1001,
        errMsg: err.message,
        data: null,
      } as ApiResponse);
      return;
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        errCode: 1001,
        errMsg: '未提供头像文件',
        data: null,
      } as ApiResponse);
      return;
    }

    // 构建 API 路径的 URL（通过 /api/v1/ 代理，避免微信小程序对静态文件的跨域限制）
    const avatarUrl = `${req.protocol}://${req.get('host')}/api/ftl/api/v1/auth/avatar/view/${req.file.filename}`;

    // 更新用户资料中的 avatarUrl
    if (!req.user) {
      res.status(401).json({ success: false, errCode: 2000, errMsg: '请先登录', data: null } satisfies ApiResponse);
      return;
    }
    await updateUserProfile(req.user.userId, { avatarUrl });

    const response: ApiResponse = {
      success: true,
      errCode: 0,
      errMsg: '头像上传成功',
      data: { avatarUrl },
    };
    res.json(response);
  } catch (error) {
    // 清理可能已保存的文件
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    const response: ApiResponse = {
      success: false,
      errCode: 1000,
      errMsg: (error as Error).message,
      data: null,
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/v1/auth/avatar/view/:filename
 * Serve avatar image file through API path（绕过微信小程序对静态文件 URL 的限制）
 * No authentication required（Image 组件无法携带 JWT）
 */
router.get('/avatar/view/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    // 安全校验：防止路径穿越攻击
    if (!filename || typeof filename !== 'string' || !/^[\w.-]+$/.test(filename)) {
      res.status(400).json({ success: false, errCode: 1001, errMsg: 'Invalid filename', data: null } satisfies ApiResponse);
      return;
    }

    const filePath = path.resolve(avatarUploadDir, filename);

    // 确保文件在 avatars 目录内（二次校验）
    if (!filePath.startsWith(avatarUploadDir)) {
      res.status(400).json({ success: false, errCode: 1001, errMsg: 'Invalid filename', data: null } satisfies ApiResponse);
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, errCode: 2001, errMsg: 'Avatar not found', data: null } satisfies ApiResponse);
      return;
    }

    res.sendFile(filePath);
  } catch {
    res.status(500).json({ success: false, errCode: 1000, errMsg: 'Internal Server Error', data: null } satisfies ApiResponse);
  }
});

/**
 * POST /api/v1/auth/decrypt-user-info
 * Decrypt WeChat encrypted user info (nickname, avatarUrl) and update user profile
 * Requires authentication
 * Body: { code: string, encryptedData: string, iv: string }
 */
router.post('/decrypt-user-info', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, errCode: 2000, errMsg: '请先登录', data: null } satisfies ApiResponse);
      return;
    }

    const { code, encryptedData, iv } = req.body;

    // Validate required fields
    if (!code || !encryptedData || !iv) {
      const missing: string[] = [];
      if (!code) missing.push('code');
      if (!encryptedData) missing.push('encryptedData');
      if (!iv) missing.push('iv');
      res.status(400).json({
        success: false,
        errCode: 1001,
        errMsg: `缺少必要参数: ${missing.join(', ')}`,
        data: null,
      } satisfies ApiResponse);
      return;
    }

    if (typeof code !== 'string' || typeof encryptedData !== 'string' || typeof iv !== 'string') {
      res.status(400).json({
        success: false,
        errCode: 1001,
        errMsg: 'code、encryptedData、iv 必须为字符串',
        data: null,
      } satisfies ApiResponse);
      return;
    }

    // 1. Exchange code for fresh session_key and openid
    const session = await getWechatSession(code);

    // 2. Decrypt user info using WeChat's AES-128-CBC
    const userInfo = decryptWechatData(encryptedData, iv, session.session_key);

    // 3. Update user profile with decrypted data
    const updatedUser = await updateUserProfile(req.user.userId, {
      nickname: userInfo.nickName,
      avatarUrl: userInfo.avatarUrl,
    });

    res.json({
      success: true,
      errCode: 0,
      errMsg: 'ok',
      data: { user: updatedUser },
    } satisfies ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      errCode: 1000,
      errMsg: (error as Error).message,
      data: null,
    } satisfies ApiResponse);
  }
});

export default router;
