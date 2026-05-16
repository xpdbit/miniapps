import { NotFoundError } from '../utils/errors';
import { validateSyncGrowth } from './sync.service';
import { prisma } from './db';

export async function getPlayer(playerId: string) {
  const player = await prisma.game1Player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      nickname: true,
      avatar_url: true,
      level: true,
      exp: true,
      gold: true,
      gems: true,
      total_mileage: true,
      play_time: true,
      prestige_count: true,
      login_days: true,
      last_login_at: true,
      created_at: true,
    },
  });
  if (!player) throw new NotFoundError('玩家不存在');

  const computedPlayTime = Math.floor((Date.now() - player.created_at.getTime()) / 1000);

  return {
    ...player,
    playTime: computedPlayTime,
  };
}

export async function updatePlayerProfile(
  playerId: number,
  data: { nickname?: string; avatarUrl?: string },
) {
  return prisma.game1Player.update({
    where: { id: playerId },
    data,
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      level: true,
      totalMileage: true,
    },
  });
}

/**
 * 同步玩家数据（带增速校验）
 * 返回服务端权威数据 + 纠偏日志
 */
export async function syncPlayerStats(
  playerId: number,
  stats: {
    level: number;
    exp: number;
    gold: number;
    gems: number;
    totalMileage: number;
    playTime: number;
    prestigeCount: number;
  },
) {
  // 1. 增速校验
  const validation = await validateSyncGrowth(playerId, stats);

  // 2. 写入数据库（使用纠偏后的值）
  const player = await prisma.game1Player.update({
    where: { id: playerId },
    data: {
      level: validation.correctedStats.level,
      exp: validation.correctedStats.exp,
      gold: validation.correctedStats.gold,
      gems: validation.correctedStats.gems,
      totalMileage: validation.correctedStats.totalMileage,
      playTime: validation.correctedStats.playTime,
      prestigeCount: validation.correctedStats.prestigeCount,
      lastSyncAt: new Date(),
    },
    select: {
      id: true,
      level: true,
      exp: true,
      gold: true,
      gems: true,
      totalMileage: true,
      playTime: true,
      prestigeCount: true,
    },
  });

  return {
    player,
    corrected: !validation.valid,
    corrections: validation.corrections,
  };
}

export async function getPlayerStats(playerId: number) {
  const [player, wins, losses, ranking, achievementCount] = await Promise.all([
    prisma.game1Player.findUnique({ where: { id: playerId } }),
    prisma.game1PvpMatch.count({ where: { playerId, result: 'victory' } }),
    prisma.game1PvpMatch.count({ where: { playerId, result: 'defeat' } }),
    prisma.game1PvpRanking.findUnique({ where: { playerId } }),
    prisma.game1Achievement.count({ where: { playerId } }),
  ]);

  if (!player) throw new NotFoundError('玩家不存在');

  const totalMatches = wins + losses;

  return {
    totalPlayTime: player.playTime,
    totalMatches,
    wins,
    losses,
    currentRating: ranking?.rating ?? 1000,
    currentRank: ranking?.rank ?? 'Bronze',
    totalMileage: player.totalMileage,
    achievementCount,
    level: player.level,
    prestigeCount: player.prestigeCount,
  };
}

export async function getLeaderboard(
  sortBy: 'totalMileage' | 'level' = 'totalMileage',
  limit = 50,
  offset = 0,
) {
  const orderBy: Record<string, 'desc'>[] =
    sortBy === 'level'
      ? [{ level: 'desc' }, { exp: 'desc' }]
      : [{ totalMileage: 'desc' }];

  const [players, total] = await Promise.all([
    prisma.game1Player.findMany({
      where: { isDeleted: false },
      orderBy,
      take: limit,
      skip: offset,
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        level: true,
        totalMileage: true,
        playTime: true,
      },
    }),
    prisma.game1Player.count({ where: { isDeleted: false } }),
  ]);

  return {
    items: players.map((p, i) => ({
      rank: offset + i + 1,
      ...p,
    })),
    total,
    limit,
    offset,
  };
}
