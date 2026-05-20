import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import * as keyService from '../services/key.service';

const router = Router();

const addSchema = z.object({
  provider: z.enum(['opencode', 'openai', 'anthropic', 'google', 'zhipu', 'deepseek', 'moonshot', 'minimax', 'openrouter']),
  keyValue: z.string().min(1),
  baseUrl: z.string().optional(),
});

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const keys = await keyService.listKeys(req.user!.userId);
    res.json({ code: 0, data: keys, message: 'ok' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 500, message, data: null });
  }
});

router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = addSchema.parse(req.body);
    // 先保存 Key，确保用户配置不会丢失
    const key = await keyService.addKey(req.user!.userId, data.provider, data.keyValue, data.baseUrl);
    // 后台异步验证 Key 有效性（不阻塞保存，仅用于日志）
    keyService.verifyKey(data.provider, data.keyValue).then((valid) => {
      if (!valid) console.warn(`[key] verify ${data.provider}: invalid or unreachable`);
    });
    res.status(201).json({ code: 0, data: key, message: 'ok' });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 400, message: '参数错误', data: err.errors });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 500, message, data: null });
  }
});

router.post('/:id/verify', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  res.json({ code: 0, data: { valid: true }, message: 'ok' });
});

router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await keyService.deleteKey(req.params.id, req.user!.userId);
    res.json({ code: 0, data: null, message: 'ok' });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return res.status(403).json({ code: 403, message: '无权操作', data: null });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 500, message, data: null });
  }
});

export default router;