import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import * as keyService from '../services/key.service';

const router = Router();

const addSchema = z.object({
  provider: z.enum(['openai', 'deepseek', 'openrouter']),
  keyValue: z.string().min(1),
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
    const valid = await keyService.verifyKey(data.provider, data.keyValue);
    if (!valid) {
      return res.status(400).json({ code: 400, message: 'API Key 无效', data: null });
    }
    const key = await keyService.addKey(req.user!.userId, data.provider, data.keyValue);
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