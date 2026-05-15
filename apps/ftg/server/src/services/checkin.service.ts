import prisma from '../lib/prisma';

export async function createCheckin(
  userId: number,
  foodRecordId: number,
  location?: { latitude?: number; longitude?: number; locationName?: string }
) {
  // 1. Verify food record belongs to user
  const record = await prisma.foodRecord.findUnique({ where: { id: foodRecordId } });
  if (!record || record.userId !== userId) {
    throw Object.assign(new Error('记录不存在'), { statusCode: 404 });
  }

  // 2. Check if already checked in today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existingToday = await prisma.checkin.findFirst({
    where: { userId, checkinDate: { gte: today, lt: tomorrow } },
  });
  if (existingToday) {
    throw Object.assign(new Error('今日已打卡'), { statusCode: 409 });
  }

  // 3. Calculate streak
  const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  const yesterdayCheckin = await prisma.checkin.findFirst({
    where: { userId, checkinDate: { gte: new Date(yesterdayStr), lt: today } },
    orderBy: { checkinDate: 'desc' },
  });

  const streakCount = yesterdayCheckin ? (yesterdayCheckin.streakCount + 1) : 1;

  // 4. Create checkin
  const checkin = await prisma.checkin.create({
    data: {
      userId,
      foodRecordId,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      locationName: location?.locationName ?? null,
      checkinDate: today,
      streakCount,
    },
    include: { foodRecord: { select: { foodName: true, foodType: true, themeImageUrl: true } } },
  });

  return checkin;
}

export async function listByUser(userId: number, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.checkin.findMany({
      where: { userId },
      include: { foodRecord: { select: { foodName: true, foodType: true, imageUrl: true } } },
      orderBy: { checkinDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.checkin.count({ where: { userId } }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getTodayStatus(userId: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const checkin = await prisma.checkin.findFirst({
    where: { userId, checkinDate: { gte: today, lt: tomorrow } },
    include: { foodRecord: { select: { foodName: true, foodType: true } } },
  });

  return { checkedIn: !!checkin, checkin };
}

export async function getStreak(userId: number) {
  const latestCheckin = await prisma.checkin.findFirst({
    where: { userId },
    orderBy: { checkinDate: 'desc' },
    select: { streakCount: true, checkinDate: true },
  });

  if (!latestCheckin) return { currentStreak: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - latestCheckin.checkinDate.getTime()) / 86400000);

  return { currentStreak: diffDays <= 1 ? latestCheckin.streakCount : 0 };
}
