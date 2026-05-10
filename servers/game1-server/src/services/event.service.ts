import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * 记录游戏事件（通过 logger 输出，后续可扩展为数据库持久化）。
 */
export async function recordGameEvent(
  playerId: number,
  eventType: string,
  eventData?: Record<string, unknown>,
): Promise<void> {
  logger.info('游戏事件记录', {
    playerId,
    eventType,
    eventData,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 获取指定天数内的活跃玩家统计数据。
 * - totalPlayers: 玩家总数
 * - activePlayers: 期间内登录过的玩家数
 * - newPlayers: 期间内注册的新玩家数
 */
export async function getActivePlayerStats(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [totalPlayers, activePlayers, newPlayers] = await Promise.all([
    prisma.game1Player.count(),
    prisma.game1Player.count({
      where: { lastLoginAt: { gte: since } },
    }),
    prisma.game1Player.count({
      where: { createdAt: { gte: since } },
    }),
  ]);

  return {
    totalPlayers,
    activePlayers,
    newPlayers,
    periodDays: days,
  };
}
