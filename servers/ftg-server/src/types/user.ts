/**
 * 用户相关类型定义
 */

/** 用户数据库模型 */
export interface User {
  id: number;
  openid: string;
  nickname: string;
  avatarUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 用户公开资料 */
export interface UserProfile {
  nickname: string;
  avatarUrl: string;
  totalRecords: number;
  unlockedAchievements: number;
  maxStreak: number;
}

/** 用户统计数据 */
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
