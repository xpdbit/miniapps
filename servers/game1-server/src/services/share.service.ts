import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type ShareType = 'pvp_victory' | 'prestige' | 'achievement' | 'normal';

const VALID_SHARE_TYPES: ReadonlySet<string> = new Set([
  'pvp_victory',
  'prestige',
  'achievement',
  'normal',
]);

/**
 * 校验分享类型是否合法
 */
export function isValidShareType(type: string): type is ShareType {
  return VALID_SHARE_TYPES.has(type);
}

/**
 * 记录分享事件
 */
export async function recordShare(playerId: number, shareType: ShareType) {
  return prisma.game1ShareLog.create({
    data: {
      playerId,
      shareType,
    },
  });
}

/**
 * 获取玩家的分享统计
 */
export async function getPlayerShareStats(playerId: number) {
  const [totalShares, sharesByType] = await Promise.all([
    prisma.game1ShareLog.count({
      where: { playerId },
    }),
    prisma.game1ShareLog.groupBy({
      by: ['shareType'],
      where: { playerId },
      _count: { shareType: true },
    }),
  ]);

  const typeBreakdown: Record<string, number> = {};
  for (const entry of sharesByType) {
    typeBreakdown[entry.shareType] = entry._count.shareType;
  }

  return {
    totalShares,
    sharesByType: typeBreakdown,
  };
}

/**
 * 获取全局分享统计（总分享数 + 分享最多的前 10 名玩家）
 */
export async function getGlobalShareStats() {
  const [totalShares, topPlayers] = await Promise.all([
    prisma.game1ShareLog.count(),
    prisma.game1ShareLog.groupBy({
      by: ['playerId'],
      _count: { playerId: true },
      orderBy: { _count: { playerId: 'desc' } },
      take: 10,
    }),
  ]);

  // 获取 top 玩家的基本信息
  const playerIds = topPlayers.map((p) => p.playerId);
  const players = await prisma.game1Player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, nickname: true, avatarUrl: true },
  });

  const playerMap = new Map(players.map((p) => [p.id, p]));

  return {
    totalShares,
    topPlayers: topPlayers.map((entry, index) => ({
      rank: index + 1,
      playerId: entry.playerId,
      nickname: playerMap.get(entry.playerId)?.nickname ?? null,
      avatarUrl: playerMap.get(entry.playerId)?.avatarUrl ?? null,
      shareCount: entry._count.playerId,
    })),
  };
}
