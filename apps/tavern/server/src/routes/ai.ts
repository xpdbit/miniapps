import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { generateText } from '../services/ai-proxy.service';
import { success } from '../utils/response';

const router = Router();

const generateSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })).min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

// POST /api/v1/ai/generate - Non-streaming AI text generation
router.post('/generate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messages, model, temperature } = generateSchema.parse(req.body);
    const text = await generateText({
      userId: req.user!.userId,
      messages,
      model,
      temperature,
    });
    res.json(success({ text }));
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ code: 400, message: '参数错误', data: err.errors });
      return;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'QUOTA_EXCEEDED') {
      res.status(429).json({ code: 429, message: '今日免费额度已用完', data: null });
      return;
    }
    if (message === 'KEY_MISSING') {
      res.status(400).json({ code: 400, message: '未配置 API Key', data: null });
      return;
    }
    console.error('[ai/generate] error:', message);
    res.status(500).json({ code: 500, message: 'AI 服务暂时不可用', data: null });
  }
});

export default router;
