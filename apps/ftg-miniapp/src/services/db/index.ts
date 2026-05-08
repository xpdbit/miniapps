/**
 * ============================================================
 * 数据库服务层统一导出
 * ============================================================
 *
 * 使用方法：
 * ```typescript
 * import { userDAL, foodRecordDAL } from '@/services/db';
 *
 * const user = await userDAL.findOrCreate('openid123');
 * const records = await foodRecordDAL.getByOpenId('openid123');
 * ```
 */

// Schema 类型定义
export type {
  // 文档接口
  UserDoc,
  FoodRecordDoc,
  CheckinDoc,
  AchievementDoc,
  UserAchievementDoc,
  ThemeDoc,
  ApiKeyDoc,
  // 创建输入
  CreateUserInput,
  CreateFoodRecordInput,
  CreateCheckinInput,
  CreateAchievementInput,
  CreateUserAchievementInput,
  CreateThemeInput,
  CreateApiKeyInput,
  // 更新输入
  UpdateUserInput,
  UpdateFoodRecordInput,
  UpdateCheckinInput,
  UpdateAchievementInput,
  UpdateUserAchievementInput,
  UpdateThemeInput,
  UpdateApiKeyInput,
} from './schema';

export { COLLECTION_NAMES, ALL_COLLECTIONS } from './schema';

// Base DAL
export {
  BaseDAL,
  DatabaseError,
  nowISO,
  isCloudAvailable,
} from './BaseDAL';
export type { ListQueryOptions } from './BaseDAL';

// User DAL
export { UserDAL, userDAL } from './userDAL';
export type { UserStatsUpdate } from './userDAL';

// Food Record DAL
export { FoodRecordDAL, foodRecordDAL } from './foodRecordDAL';
export type { FoodRecordQueryOptions } from './foodRecordDAL';

// Checkin DAL
export { CheckinDAL, checkinDAL } from './checkinDAL';

// Achievement DAL
export { AchievementDAL, achievementDAL } from './achievementDAL';

// User Achievement DAL
export {
  UserAchievementDAL,
  userAchievementDAL,
} from './userAchievementDAL';
export type { AchievementProgressUpdate } from './userAchievementDAL';

// Theme DAL
export { ThemeDAL, themeDAL } from './themeDAL';

// API Key DAL
export { ApiKeyDAL, apiKeyDAL } from './apiKeyDAL';
