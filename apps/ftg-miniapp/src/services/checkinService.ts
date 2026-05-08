/**
 * 打卡 HTTP 服务
 * 对接 ftg-server REST API，替代 CloudBase DAL
 */

import { httpClient } from './httpClient';
import { useAuthStore } from '@/stores/authStore';

// ============================================================
// 类型定义
// ============================================================

interface ApiResponse<T> {
  success: boolean;
  errCode: number;
  errMsg: string;
  data: T;
}

interface TodayStatus {
  checkedIn: boolean;
  streakCount: number;
}

// ============================================================
// Token 获取
// ============================================================

function getToken(): string {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('未登录');
  return token;
}

// ============================================================
// API
// ============================================================

/**
 * 获取今日打卡状态（是否已打卡 + 连续天数）
 */
export async function fetchTodayStatus(): Promise<TodayStatus> {
  try {
    const token = getToken();
    const res = await httpClient.get<ApiResponse<TodayStatus>>('/checkins/today', token);
    return res.data;
  } catch {
    return { checkedIn: false, streakCount: 0 };
  }
}

/**
 * 获取当前连续打卡天数
 */
export async function fetchCheckinStreak(): Promise<number> {
  try {
    const token = getToken();
    const res = await httpClient.get<ApiResponse<number>>('/checkins/streak', token);
    return res.data;
  } catch {
    return 0;
  }
}

/**
 * 创建检查打卡
 */
export async function createCheckin(
  foodRecordId: number,
  options?: { latitude?: number; longitude?: number; locationName?: string },
): Promise<void> {
  const token = getToken();
  await httpClient.post<ApiResponse<null>>(
    '/checkins',
    { foodRecordId, ...options },
    token,
  );
}
