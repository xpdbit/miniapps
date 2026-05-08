/**
 * ============================================================
 * 数据库集合 Schema 定义
 * 7 个集合的 TypeScript 文档接口
 * ============================================================
 *
 * 所有集合均使用 CloudBase 默认 _id 作为主键。
 * users 集合使用 _id 直接存储微信 openid。
 */

// ----- 引用领域类型 -----
import type {
  CalorieInfo,
  AIFoodDescription,
  FoodType,
} from '@/types/food';
import type { ThemeConfig } from '@/types/theme';
import type { AchievementCondition } from '@/types/achievement';

// ============================================================
// 1. 用户集合 (users)
// ============================================================
/** users 集合文档结构 */
export interface UserDoc {
  /** _id = 微信 openid */
  _id: string;
  /** 用户昵称 */
  nickname: string;
  /** 头像云文件 ID */
  avatarUrl: string;
  /** 注册时间 (ISO 8601) */
  createdAt: string;
  /** 总食物记录数 */
  totalRecords: number;
  /** 总打卡数 */
  totalCheckins: number;
  /** 主题偏好 (themeId) */
  themePreference: string;
}

/** 创建用户所需字段（不含 _id） */
export type CreateUserInput = Omit<UserDoc, '_id'>;

/** 更新用户的可选字段（不含 _id） */
export type UpdateUserInput = Partial<Omit<UserDoc, '_id'>>;

// ============================================================
// 2. 食物记录集合 (food_records)
// ============================================================
/** food_records 集合文档结构 */
export interface FoodRecordDoc {
  /** 记录 ID（自动生成） */
  _id: string;
  /** 用户 openid */
  openid: string;
  /** 食物原图云文件 ID */
  imageFileID: string;
  /** 主题合成图云文件 ID */
  themeImageFileID: string;
  /** 食物名称 */
  foodName: string;
  /** 食物类型（枚举值字符串） */
  foodType: FoodType;
  /** 卡路里信息 */
  calories: CalorieInfo;
  /** AI 生成的食物描述 */
  aiDescription: AIFoodDescription;
  /** 游戏化描述 */
  gameDescription: string;
  /** 纬度 */
  latitude: number;
  /** 经度 */
  longitude: number;
  /** 位置名称 */
  locationName: string;
  /** IP 定位结果 */
  ipLocation: string;
  /** 创建时间 (ISO 8601) */
  createdAt: string;
  /** 使用的主题 ID */
  themeId: string;
  /** 用户备注 */
  remark?: string;
  /** 是否已删除（软删除） */
  isDeleted?: boolean;
  /** 删除时间 (ISO 8601) */
  deletedAt?: string;
}

/** 创建食物记录所需字段（不含 _id） */
export type CreateFoodRecordInput = Omit<FoodRecordDoc, '_id'>;

/** 更新食物记录的可选字段（不含 _id） */
export type UpdateFoodRecordInput = Partial<Omit<FoodRecordDoc, '_id'>>;

// ============================================================
// 3. 打卡集合 (checkins)
// ============================================================
/** checkins 集合文档结构 */
export interface CheckinDoc {
  /** 打卡记录 ID（自动生成） */
  _id: string;
  /** 用户 openid */
  openid: string;
  /** 关联食物记录 ID */
  foodRecordId: string;
  /** 打卡位置名称 */
  locationName: string;
  /** 纬度 */
  latitude: number;
  /** 经度 */
  longitude: number;
  /** 打卡时间 (ISO 8601) */
  timestamp: string;
  /** 连续打卡天数 */
  streakCount: number;
}

/** 创建打卡记录所需字段（不含 _id） */
export type CreateCheckinInput = Omit<CheckinDoc, '_id'>;

/** 更新打卡记录的可选字段（不含 _id） */
export type UpdateCheckinInput = Partial<Omit<CheckinDoc, '_id'>>;

// ============================================================
// 4. 成就定义集合 (achievements)
// ============================================================
/** achievements 集合文档结构（系统预置数据） */
export interface AchievementDoc {
  /** 文档 ID（自动生成） */
  _id: string;
  /** 成就逻辑 ID */
  achievementId: string;
  /** 成就名称 */
  name: string;
  /** 成就描述 */
  description: string;
  /** 成就图标云文件 ID */
  iconUrl: string;
  /** 解锁条件 */
  unlockCondition: AchievementCondition;
  /** 关联主题 ID（可为空字符串） */
  themeId: string;
}

/** 创建成就所需字段（不含 _id） */
export type CreateAchievementInput = Omit<AchievementDoc, '_id'>;

/** 更新成就的可选字段（不含 _id） */
export type UpdateAchievementInput = Partial<Omit<AchievementDoc, '_id'>>;

// ============================================================
// 5. 用户成就关联集合 (user_achievements)
// ============================================================
/** user_achievements 集合文档结构 */
export interface UserAchievementDoc {
  /** 文档 ID（自动生成） */
  _id: string;
  /** 用户 openid */
  openid: string;
  /** 成就 ID */
  achievementId: string;
  /** 解锁时间 (ISO 8601) */
  unlockedAt: string;
  /** 当前进度值（0-目标值） */
  progress: number;
  /** 是否已完全解锁 */
  isUnlocked: boolean;
}

/** 创建用户成就所需字段（不含 _id） */
export type CreateUserAchievementInput = Omit<UserAchievementDoc, '_id'>;

/** 更新用户成就的可选字段（不含 _id） */
export type UpdateUserAchievementInput = Partial<
  Omit<UserAchievementDoc, '_id'>
>;

// ============================================================
// 6. 主题定义集合 (themes)
// ============================================================
/** themes 集合文档结构（系统预置数据） */
export interface ThemeDoc {
  /** 文档 ID（自动生成） */
  _id: string;
  /** 主题逻辑 ID */
  themeId: string;
  /** 主题名称 */
  name: string;
  /** 游戏名称（如"塞尔达传说"） */
  gameName: string;
  /** 主题合成配置 */
  frameConfig: ThemeConfig;
  /** 预览图云文件 ID */
  previewImageUrl: string;
  /** 是否启用 */
  isActive: boolean;
  /** 排序序号（升序） */
  sortOrder: number;
}

/** 创建主题所需字段（不含 _id） */
export type CreateThemeInput = Omit<ThemeDoc, '_id'>;

/** 更新主题的可选字段（不含 _id） */
export type UpdateThemeInput = Partial<Omit<ThemeDoc, '_id'>>;

// ============================================================
// 7. API 密钥集合 (api_keys)
// ============================================================
/** api_keys 集合文档结构 */
export interface ApiKeyDoc {
  /** 文档 ID（自动生成） */
  _id: string;
  /** 用户 openid */
  openid: string;
  /** 服务名称（如 hunyuan、ppshitu） */
  serviceName: string;
  /** API 密钥（加密存储） */
  apiKey: string;
  /** 是否启用 */
  isActive: boolean;
  /** 创建时间 (ISO 8601) */
  createdAt: string;
  /** 最后使用时间 (ISO 8601) */
  lastUsed: string;
}

/** 创建 API 密钥所需字段（不含 _id） */
export type CreateApiKeyInput = Omit<ApiKeyDoc, '_id'>;

/** 更新 API 密钥的可选字段（不含 _id、openid、serviceName） */
export type UpdateApiKeyInput = Partial<
  Omit<ApiKeyDoc, '_id' | 'openid' | 'serviceName'>
>;

// ============================================================
// 集合名称常量
// ============================================================
export const COLLECTION_NAMES = {
  USERS: 'users',
  FOOD_RECORDS: 'food_records',
  CHECKINS: 'checkins',
  ACHIEVEMENTS: 'achievements',
  USER_ACHIEVEMENTS: 'user_achievements',
  THEMES: 'themes',
  API_KEYS: 'api_keys',
} as const;

/** 所有集合名称列表 */
export const ALL_COLLECTIONS: readonly string[] = Object.values(
  COLLECTION_NAMES,
);
