import prisma from '../lib/prisma';
import getRedisClient from '../lib/redis'; // for possible caching

export interface UserStats {
  totalRecords: number;
  totalCheckins: number;
  currentStreak: number;
  maxStreak: number;
  achievementsUnlocked: number;
  foodTypeCounts: Record<string, number>;
  recordsThisMonth: number;
  recordsToday: number;
  totalCalories: number;
}

/** Get user by ID */
export async function getUserById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

/** Get user by openid */
export async function getUserByOpenid(openid: string) {
  return prisma.user.findUnique({ where: { openid } });
}

/** Create or update user (upsert) */
export async function upsertUser(openid: string, data?: { nickname?: string; avatarUrl?: string }) {
  return prisma.user.upsert({
    where: { openid },
    update: { ...data, updatedAt: new Date() },
    create: { openid, ...data },
  });
}

/** Get aggregated user statistics */
export async function getUserStats(userId: number): Promise<UserStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalRecords,
    totalCheckins,
    achievements,
    foodTypeCountsResult,
    recordsThisMonth,
    recordsToday,
    totalCalories,
    checkins,
  ] = await Promise.all([
    prisma.foodRecord.count({ where: { userId, isDeleted: false } }),
    prisma.checkin.count({ where: { userId } }),
    prisma.userAchievement.count({ where: { userId, isUnlocked: true } }),
    prisma.foodRecord.groupBy({ by: ['foodType'], where: { userId, isDeleted: false }, _count: true }),
    prisma.foodRecord.count({ where: { userId, isDeleted: false, createdAt: { gte: startOfMonth } } }),
    prisma.foodRecord.count({ where: { userId, isDeleted: false, createdAt: { gte: startOfToday } } }),
    prisma.foodRecord.aggregate({ where: { userId, isDeleted: false }, _sum: { caloriesTotal: true } }),
    prisma.checkin.findMany({ where: { userId }, orderBy: { checkinDate: 'desc' }, select: { checkinDate: true }, take: 365 }),
  ]);

  // Calculate streak from checkin dates
  const { currentStreak, maxStreak } = calculateStreak(checkins.map(c => c.checkinDate));

  const foodTypeCounts: Record<string, number> = {};
  for (const entry of foodTypeCountsResult) {
    foodTypeCounts[entry.foodType] = entry._count;
  }

  return {
    totalRecords,
    totalCheckins,
    currentStreak,
    maxStreak,
    achievementsUnlocked: achievements,
    foodTypeCounts,
    recordsThisMonth,
    recordsToday,
    totalCalories: totalCalories._sum.caloriesTotal || 0,
  };
}

/** Calculate current and max consecutive-day streak from sorted dates (newest first) */
function calculateStreak(dates: Date[]): { currentStreak: number; maxStreak: number } {
  if (dates.length === 0) return { currentStreak: 0, maxStreak: 0 };

  const dayStrings = [...new Set(dates.map(d => d.toISOString().slice(0, 10)))].sort().reverse();
  let currentStreak = 1;
  let maxStreak = 1;
  let runningStreak = 1;

  // Check if the streak is still active (most recent date is today or yesterday)
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const isActive = dayStrings[0] === today || dayStrings[0] === yesterday;

  for (let i = 1; i < dayStrings.length; i++) {
    const prevDate = new Date(dayStrings[i - 1]!);
    const currDate = new Date(dayStrings[i]!);
    const diffDays = (prevDate.getTime() - currDate.getTime()) / 86400000;

    if (diffDays === 1) {
      runningStreak++;
    } else {
      if (i === 1 && isActive) currentStreak = runningStreak;
      if (runningStreak > maxStreak) maxStreak = runningStreak;
      runningStreak = 1;
    }
  }

  if (isActive) currentStreak = runningStreak;
  if (runningStreak > maxStreak) maxStreak = runningStreak;

  return { currentStreak, maxStreak };
}

export interface UserListItem {
  id: number;
  nickname: string;
  openid: string;
  avatar: string;
  foodRecordCount: number;
  checkInCount: number;
  registeredAt: string;
  status: 'active' | 'disabled';
}

export interface UserListResult {
  list: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

/** List users with pagination, search, and date filtering (admin) */
export async function listUsers(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}): Promise<UserListResult> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (params.keyword) {
    where.OR = [
      { nickname: { contains: params.keyword } },
      { openid: { contains: params.keyword } },
    ];
  }

  if (params.startDate || params.endDate) {
    const createdAt: Record<string, Date> = {};
    if (params.startDate) createdAt.gte = new Date(params.startDate);
    if (params.endDate) createdAt.lte = new Date(params.endDate + 'T23:59:59.999Z');
    where.createdAt = createdAt;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: where as any,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            foodRecords: { where: { isDeleted: false } },
            checkins: true,
          },
        },
      },
    }),
    prisma.user.count({ where: where as any }),
  ]);

  return {
    list: users.map((user) => ({
      id: user.id,
      nickname: user.nickname || '',
      openid: user.openid,
      avatar: user.avatarUrl || '',
      foodRecordCount: user._count.foodRecords,
      checkInCount: user._count.checkins,
      registeredAt: user.createdAt.toISOString(),
      status: 'active' as const,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    hasMore: page * pageSize < total,
  };
}

/** Update user profile (nickname, avatarUrl) */
export async function updateUserProfile(
  userId: number,
  data: { nickname?: string | null; avatarUrl?: string | null },
) {
  const updateData: Record<string, unknown> = {};
  if (data.nickname !== undefined) updateData.nickname = data.nickname;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
  if (Object.keys(updateData).length === 0) return null;

  return prisma.user.update({
    where: { id: userId },
    data: { ...updateData, updatedAt: new Date() },
    select: { id: true, openid: true, nickname: true, avatarUrl: true, createdAt: true, updatedAt: true },
  });
}

/**
 * 将旧版头像 URL（https://xxx/uploads/avatars/...）转为新版 API 路径 URL
 */
function transformAvatarUrl(avatarUrl: string | null): string {
  if (!avatarUrl) return '';
  const match = avatarUrl.match(/^(https?:\/\/[^/]+)\/uploads\/avatars\/([\w.-]+)$/);
  if (match && match[1] && match[2]) {
    return `${match[1]}/api/v1/auth/avatar/view/${match[2]}`;
  }
  return avatarUrl;
}

/** Get user public profile */
export async function getUserProfile(userId: number) {
  const [user, totalRecords, achievements, maxCheckin] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { nickname: true, avatarUrl: true } }),
    prisma.foodRecord.count({ where: { userId, isDeleted: false } }),
    prisma.userAchievement.count({ where: { userId, isUnlocked: true } }),
    prisma.checkin.findFirst({ where: { userId }, orderBy: { streakCount: 'desc' }, select: { streakCount: true } }),
  ]);

  if (!user) return null;

  return {
    nickname: user.nickname || '',
    avatarUrl: transformAvatarUrl(user.avatarUrl),
    totalRecords,
    unlockedAchievements: achievements,
    maxStreak: maxCheckin?.streakCount || 0,
  };
}
