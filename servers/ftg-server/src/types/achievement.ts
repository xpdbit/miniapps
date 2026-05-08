/**
 * 成就系统相关类型定义
 */

/** 成就解锁条件类型 */
export enum AchievementConditionType {
  /** 总记录数达到 */
  TOTAL_RECORDS = 'total_records',
  /** 连续打卡天数达到 */
  STREAK_DAYS = 'streak_days',
  /** 特定食物类型记录数 */
  FOOD_TYPE_COUNT = 'food_type_count',
  /** 使用主题次数 */
  THEME_USAGE = 'theme_usage',
  /** 位置打卡数 */
  CHECKIN_COUNT = 'checkin_count',
}

/** 成就条件定义 */
export interface AchievementCondition {
  type: AchievementConditionType;
  value: number;
  param?: string;
}

/** 成就数据库模型 */
export interface Achievement {
  id: number;
  achievementId: string;
  name: string;
  description: string;
  iconUrl: string;
  conditionType: AchievementConditionType;
  conditionValue: number;
  conditionParam?: string;
  themeId: string;
  createdAt: Date;
}

/** 用户成就记录 */
export interface UserAchievement {
  id: number;
  userId: number;
  achievementId: string;
  unlockedAt: Date;
  progress: number;
  isUnlocked: boolean;
}
