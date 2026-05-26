import prisma from '../lib/prisma';

export async function createCheckin(
  userUuid: number,
  foodRecordId: number,
  location?: { latitude?: number; longitude?: number; locationName?: string }
) {
  // 1. Verify food record belongs to user
  const record = await prisma.ftgFoodRecord.findUnique({ where: { id: foodRecordId } });
  if (!record || record.userUuid !== userUuid) {
    throw Object.assign(new Error('记录不存在'), { statusCode: 404 });
  }

  // 2. Check if already checked in today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existingToday = await prisma.ftgCheckin.findFirst({
    where: { userUuid, checkinDate: { gte: today, lt: tomorrow } },
  });
  if (existingToday) {
    throw Object.assign(new Error('今日已打卡'), { statusCode: 409 });
  }

  // 3. Calculate streak
  const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  const yesterdayCheckin = await prisma.ftgCheckin.findFirst({
    where: { userUuid, checkinDate: { gte: new Date(yesterdayStr), lt: today } },
    orderBy: { checkinDate: 'desc' },
  });

  const streakCount = yesterdayCheckin ? (yesterdayCheckin.streakCount + 1) : 1;

  // 4. Create checkin
  const checkin = await prisma.ftgCheckin.create({
    data: {
      userUuid,
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

export async function listByUser(userUuid: number, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.ftgCheckin.findMany({
      where: { userUuid },
      include: { foodRecord: { select: { foodName: true, foodType: true, imageUrl: true } } },
      orderBy: { checkinDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.ftgCheckin.count({ where: { userUuid } }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getTodayStatus(userUuid: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const checkin = await prisma.ftgCheckin.findFirst({
    where: { userUuid, checkinDate: { gte: today, lt: tomorrow } },
    include: { foodRecord: { select: { foodName: true, foodType: true } } },
  });

  return { checkedIn: !!checkin, checkin };
}

export async function getStreak(userUuid: number) {
  const latestCheckin = await prisma.ftgCheckin.findFirst({
    where: { userUuid },
    orderBy: { checkinDate: 'desc' },
    select: { streakCount: true, checkinDate: true },
  });

  if (!latestCheckin) return { currentStreak: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - latestCheckin.checkinDate.getTime()) / 86400000);

  return { currentStreak: diffDays <= 1 ? latestCheckin.streakCount : 0 };
}
