import { Prisma, PrismaClient } from '@prisma/client';
import { NotFoundError } from '../utils/errors';
import { getActivePlayerStats } from './event.service';
import { ACHIEVEMENT_DEFINITIONS } from './achievement.service';

const prisma = new PrismaClient();

interface PlayerListParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const VALID_SORT_FIELDS: Array<keyof Prisma.Game1PlayerOrderByWithRelationInput> = [
  'level',
  'totalMileage',
  'playTime',
  'lastLoginAt',
  'createdAt',
];

/**
 * 获取玩家列表（分页 + 搜索 + 排序）
 */
export async function getPlayerList(params: PlayerListParams) {
  const { page, pageSize, search, sortBy, sortOrder } = params;
  const skip = (page - 1) * pageSize;

  // 构建查询条件
  const where: Prisma.Game1PlayerWhereInput = { isDeleted: false };
  if (search) {
    where.OR = [
      { nickname: { contains: search } },
      { openid: { contains: search } },
    ];
  }

  // 构建排序
  const orderField = sortBy && VALID_SORT_FIELDS.includes(sortBy as keyof Prisma.Game1PlayerOrderByWithRelationInput)
    ? sortBy
    : 'createdAt';
  const orderDir: Prisma.SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
  const orderBy: Prisma.Game1PlayerOrderByWithRelationInput = { [orderField]: orderDir };

  const [items, total] = await Promise.all([
    prisma.game1Player.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        openid: true,
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
    }),
    prisma.game1Player.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 管理后台仪表盘数据
 */
export async function getAdminDashboard() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalPlayers,
    todayNewPlayers,
    weekNewPlayers,
    totalPvpMatches,
    todayPvpMatches,
    totalCloudSaves,
    activeStats,
  ] = await Promise.all([
    prisma.game1Player.count({ where: { isDeleted: false } }),
    prisma.game1Player.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.game1Player.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.game1PvpMatch.count(),
    prisma.game1PvpMatch.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.game1CloudSave.count(),
    getActivePlayerStats(7),
  ]);

  return {
    totalPlayers,
    todayNewPlayers,
    weekNewPlayers,
    totalPvpMatches,
    todayPvpMatches,
    totalCloudSaves,
    activeStats,
  };
}

/**
 * 软删除玩家
 */
export async function softDeletePlayer(playerId: number) {
  const player = await prisma.game1Player.findUnique({ where: { id: playerId } });
  if (!player) throw new NotFoundError('玩家不存在');

  return prisma.game1Player.update({
    where: { id: playerId },
    data: { isDeleted: true },
    select: {
      id: true,
      nickname: true,
      isDeleted: true,
    },
  });
}

/**
 * 获取成就统计（各成就解锁人数 + 解锁率）
 */
export async function getAchievementStats() {
  const [unlockCounts, totalPlayers] = await Promise.all([
    prisma.game1Achievement.groupBy({
      by: ['achievementId'],
      _count: { playerId: true },
      where: { progress: { gte: 1.0 } },
    }),
    prisma.game1Player.count({ where: { isDeleted: false } }),
  ]);

  const unlockMap = new Map(unlockCounts.map((u) => [u.achievementId, u._count.playerId]));

  return Object.values(ACHIEVEMENT_DEFINITIONS).map((def) => {
    const unlockedCount = unlockMap.get(def.id) ?? 0;
    return {
      achievementId: def.id,
      title: def.title,
      description: def.description,
      condition: def.condition,
      unlockedCount,
      totalPlayers,
      unlockRate: totalPlayers > 0 ? unlockedCount / totalPlayers : 0,
    };
  });
}
