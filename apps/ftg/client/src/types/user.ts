/**
 * 用户相关类型定义
 */

/** 用户基本信息 */
export interface User {
  /** 用户 openid */
  _id: string;
  /** 昵称 */
  nickname: string;
  /** 头像云文件ID */
  avatarUrl: string;
  /** 注册时间 */
  createdAt: string;
  /** 总记录数 */
  totalRecords: number;
  /** 总打卡数 */
  totalCheckins: number;
  /** 主题偏好 */
  themePreference: string;
}

/** 用户公开资料 */
export interface UserProfile {
  /** 昵称 */
  nickname: string;
  /** 头像URL */
  avatarUrl: string;
  /** 总记录数 */
  totalRecords: number;
  /** 解锁成就数 */
  unlockedAchievements: number;
  /** 最长连续打卡天数 */
  maxStreak: number;
}

/** 用户统计数据 */
export interface UserStats {
  /** 总记录数 */
  totalRecords: number;
  /** 总打卡数 */
  totalCheckins: number;
  /** 当前连续打卡 */
  currentStreak: number;
  /** 最长连续打卡 */
  maxStreak: number;
  /** 解锁成就数 */
  achievementsUnlocked: number;
  /** 各食物类型记录统计 */
  foodTypeCounts: Record<string, number>;
  /** 本月记录数 */
  recordsThisMonth: number;
  /** 今日记录数 */
  recordsToday: number;
  /** 总摄入热量估算 */
  totalCalories: number;
}

/** 服务端认证用户 (来自 Prisma User model) */
export interface AuthUser {
  /** 用户 ID (MySQL autoincrement) */
  id: number;
  /** 微信 openid */
  openid: string;
  /** 昵称 */
  nickname: string | null;
  /** 头像 URL */
  avatarUrl: string | null;
  /** 注册时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** POST /auth/login 响应数据 */
export interface LoginResponse {
  /** JWT 令牌 */
  token: string;
  /** 用户信息 */
  user: AuthUser;
}

/** GET /auth/me 响应数据 */
export interface MeResponse {
  /** 用户信息 */
  user: AuthUser;
}

/** 用户设置 */
export interface UserSettings {
  /** 默认主题ID */
  defaultThemeId: string;
  /** 是否开启位置记录 */
  enableLocation: boolean;
  /** 通知偏好 */
  notificationPref: 'on' | 'off';
}
