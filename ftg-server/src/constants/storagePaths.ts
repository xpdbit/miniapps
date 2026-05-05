/**
 * 云存储路径模板
 */

/** 云存储目录路径 */
export const STORAGE_PATHS = {
  FOOD_IMAGES: 'food-images',
  THEME_IMAGES: 'theme-images',
  SHARE_CARDS: 'share-cards',
  USER_AVATARS: 'avatars',
  ACHIEVEMENT_ICONS: 'achievement-icons',
} as const;

/** 构建存储路径 */
export function buildStoragePath(base: string, userId: number, category: string): string {
  const ts = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${base}/${userId}/${category}/${ts}_${random}`;
}
