import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

export async function getPlayer(playerId: number) {
  const player = await prisma.game1Player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      level: true,
      exp: true,
      totalMileage: true,
      playTime: true,
      prestigeCount: true,
      loginDays: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!player) throw new NotFoundError('玩家不存在');

  // 游玩时间 = 当前UTC时间 - 注册UTC时间（秒）
  const computedPlayTime = Math.floor((Date.now() - player.createdAt.getTime()) / 1000);

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

export async function syncPlayerStats(
  playerId: number,
  stats: {
    level?: number;
    exp?: number;
    totalMileage?: number;
    playTime?: number;
    prestigeCount?: number;
  },
) {
  return prisma.game1Player.update({
    where: { id: playerId },
    data: stats,
  });
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
