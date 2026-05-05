/**
 * 云存储路径模板
 */

/** 云存储目录路径 */
export const STORAGE_PATHS = {
  /** 食物原图存储路径 */
  foodImages: (openid: string, timestamp: string): string =>
    `food-images/${openid}/${timestamp}.jpg`,

  /** 主题合成图存储路径 */
  themeImages: (openid: string, themeId: string, timestamp: string): string =>
    `theme-images/${openid}/${themeId}/${timestamp}.png`,

  /** 用户头像存储路径 */
  avatars: (openid: string): string =>
    `avatars/${openid}.jpg`,

  /** 主题边框素材存储路径 */
  themeFrames: (themeId: string): string =>
    `theme-frames/${themeId}/`,

  /** 主题预览图存储路径 */
  themePreviews: (themeId: string): string =>
    `theme-previews/${themeId}.png`,

  /** 成就图标存储路径 */
  achievementIcons: (achievementId: string): string =>
    `achievement-icons/${achievementId}.png`,

  /** 分享卡片存储路径 */
  shareCards: (openid: string, recordId: string): string =>
    `share-cards/${openid}/${recordId}.png`,
} as const;

/** 云存储根目录列表 */
export const STORAGE_ROOT_DIRS = [
  'food-images/',
  'theme-images/',
  'avatars/',
  'theme-frames/',
  'theme-previews/',
  'achievement-icons/',
  'share-cards/',
] as const;
