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

/** 成就条件 */
export interface AchievementCondition {
  /** 条件类型 */
  type: AchievementConditionType;
  /** 条件目标值 */
  value: number;
  /** 额外参数 (如食物类型) */
  param?: string;
}

/** 成就定义 */
export interface Achievement {
  /** 成就ID */
  achievementId: string;
  /** 成就名称 */
  name: string;
  /** 成就描述 */
  description: string;
  /** 成就图标云文件ID */
  iconUrl: string;
  /** 解锁条件 */
  unlockCondition: AchievementCondition;
  /** 关联主题ID */
  themeId: string;
}

/** 用户成就记录 */
export interface UserAchievement {
  /** 用户 openid */
  openid: string;
  /** 成就ID */
  achievementId: string;
  /** 解锁时间 */
  unlockedAt: string;
  /** 当前进度值 */
  progress: number;
  /** 是否已解锁 */
  isUnlocked: boolean;
}
