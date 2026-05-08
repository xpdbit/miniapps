/**
 * ============================================================
 * 通用图片上传路由
 * POST /api/v1/upload - 上传图片到服务器本地存储
 * ============================================================
 *
 * 替代旧的 wx.cloud.uploadFile 方案（云开发环境未配置），
 * 使用 base64 JSON 上传以规避微信 Taro.uploadFile 返回云权限错误的问题。
 *
 * 客户端编码流程（小程序端）：
 *   fs.readFileSync(filePath, 'base64') → POST { image: base64data }
 *
 * 服务端解码流程：
 *   Buffer.from(base64data, 'base64') → storage.upload()
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getStorageProvider, buildStoragePath } from '../lib/storage-factory';

const router = Router();

router.use(requireAuth);

/**
 * POST /api/v1/upload
 * 上传单张图片（base64 JSON），返回可公开访问的 URL
 *
 * Request:  { image: "<base64 encoded image data>" }
 * Response: { success: true, data: { url: "/uploads/..." } }
 */
router.post('/', async (req, res) => {
  try {
    const { image: base64Data } = req.body as { image?: string };

    if (!base64Data || typeof base64Data !== 'string' || base64Data.length === 0) {
      res.status(400).json({
        success: false,
        errCode: 400,
        errMsg: '请上传图片（base64 JSON）',
        data: null,
      });
      return;
    }

    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length === 0) {
      res.status(400).json({
        success: false,
        errCode: 400,
        errMsg: '图片数据为空',
        data: null,
      });
      return;
    }

    const userId = req.user?.userId ?? 0;
    const key = buildStoragePath(userId, 'food-images', 'jpg');
    const storage = getStorageProvider();
    const imageUrl = await storage.upload(key, buffer, 'image/jpeg');

    res.json({
      success: true,
      errCode: 0,
      errMsg: 'ok',
      data: { url: imageUrl },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      errCode: 500,
      errMsg: `图片上传失败: ${message}`,
      data: null,
    });
  }
});

export default router;
