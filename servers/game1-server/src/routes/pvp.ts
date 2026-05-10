import { Router, type Request, type Response } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import * as pvpService from '../services/pvp.service';

const router = Router();

const VALID_RESULTS = ['victory', 'defeat', 'draw'];

// ─── 提交对战结果 ───
router.post('/pvp/result', requireAuth, async (req: Request, res: Response) => {
  try {
    const { opponentId, result, battleLog } = req.body;

    if (!opponentId || typeof opponentId !== 'number') {
      sendError(res, ErrorCodes.VALIDATION_ERROR, '缺少有效的对手ID', 400);
      return;
    }

    if (!VALID_RESULTS.includes(result)) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, '无效的对战结果，必须为 victory/defeat/draw', 400);
      return;
    }

    const matchResult = await pvpService.submitMatchResult({
      playerId: req.player!.playerId,
      opponentId,
      result,
      battleLog: battleLog ?? undefined,
    });

    sendSuccess(res, matchResult, 201);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '提交对战结果失败',
      appErr.statusCode || 500,
    );
  }
});

// ─── PVP 排行榜 ───
router.get('/pvp/leaderboard', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await pvpService.getLeaderboard(limit, offset);
    sendSuccess(res, result);
  } catch {
    sendError(res, ErrorCodes.INTERNAL_ERROR, '服务器错误', 500);
  }
});

// ─── 玩家排行信息 ───
router.get('/pvp/rank/:playerId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId as string, 10);
    const rank = await pvpService.getPlayerRank(playerId);

    if (!rank) {
      sendSuccess(res, null);
      return;
    }

    sendSuccess(res, rank);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '服务器错误',
      appErr.statusCode || 500,
    );
  }
});

// ─── 对战历史 ───
router.get('/pvp/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const history = await pvpService.getMatchHistory(req.player!.playerId, limit, offset);
    sendSuccess(res, history);
  } catch (err: unknown) {
    const appErr = err as { errCode?: number; message?: string; statusCode?: number };
    sendError(
      res,
      appErr.errCode || ErrorCodes.INTERNAL_ERROR,
      appErr.message || '获取对战历史失败',
      appErr.statusCode || 500,
    );
  }
});

export default router;
