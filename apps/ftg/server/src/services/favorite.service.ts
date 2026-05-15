/**
 * 收藏服务
 *
 * 管理用户对食物记录的收藏/取消收藏
 */
import prisma from '../lib/prisma';

/**
 * 收藏一条食物记录
 */
export async function addFavorite(userId: number, recordId: number): Promise<void> {
  await prisma.favorite.create({
    data: { userId, recordId },
  });
}

/**
 * 取消收藏
 */
export async function removeFavorite(userId: number, recordId: number): Promise<void> {
  await prisma.favorite.delete({
    where: { userId_recordId: { userId, recordId } },
  });
}

/**
 * 获取用户收藏列表（分页，含食物记录详情）
 */
export async function listFavorites(
  userId: number,
  options: { page: number; limit: number },
) {
  const { page, limit } = options;
  const skip = (page - 1) * limit;

  const [favorites, total] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId },
      include: {
        foodRecord: {
          include: { user: { select: { openid: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.favorite.count({ where: { userId } }),
  ]);

  const list = favorites.map((f) => ({
    favoriteId: f.id,
    favoritedAt: f.createdAt,
    record: {
      id: f.foodRecord.id,
      foodName: f.foodRecord.foodName,
      foodType: f.foodRecord.foodType,
      imageUrl: f.foodRecord.imageUrl,
      themeImageUrl: f.foodRecord.themeImageUrl,
      caloriesTotal: f.foodRecord.caloriesTotal,
      createdAt: f.foodRecord.createdAt,
    },
  }));

  return { list, total, page, limit };
}

/**
 * 检查是否已收藏
 */
export async function isFavorited(userId: number, recordId: number): Promise<boolean> {
  const count = await prisma.favorite.count({
    where: { userId, recordId },
  });
  return count > 0;
}

/**
 * 批量检查收藏状态
 */
export async function batchCheckFavorited(
  userId: number,
  recordIds: number[],
): Promise<Record<number, boolean>> {
  const favorites = await prisma.favorite.findMany({
    where: { userId, recordId: { in: recordIds } },
    select: { recordId: true },
  });
  const favoritedSet = new Set(favorites.map((f) => f.recordId));
  const result: Record<number, boolean> = {};
  for (const id of recordIds) {
    result[id] = favoritedSet.has(id);
  }
  return result;
}
