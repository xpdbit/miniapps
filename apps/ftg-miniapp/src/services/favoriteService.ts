/**
 * 收藏服务
 *
 * 对接 ftg-server REST API 的收藏功能
 */

import { httpClient } from './httpClient';
import { useAuthStore } from '@/stores/authStore';

// ============================================================
// 类型定义
// ============================================================

export interface FavoriteRecord {
  favoriteId: number;
  favoritedAt: string;
  record: {
    id: number;
    foodName: string;
    foodType: string;
    imageUrl: string | null;
    themeImageUrl: string | null;
    caloriesTotal: number | null;
    createdAt: string;
  };
}

export interface FavoriteListResult {
  list: FavoriteRecord[];
  total: number;
  page: number;
  limit: number;
}

/** API 返回结构 */
interface ApiResponse<T> {
  success: boolean;
  errCode: number;
  errMsg: string;
  data: T;
}

// ============================================================
// Token 获取辅助
// ============================================================

function getToken(): string {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error('未登录');
  }
  return token;
}

// ============================================================
// API
// ============================================================

/**
 * 收藏一条食物记录
 */
export async function addFavorite(recordId: number): Promise<void> {
  const token = getToken();
  await httpClient.post<ApiResponse<null>>('/favorites', { recordId }, token);
}

/**
 * 取消收藏
 */
export async function removeFavorite(recordId: number): Promise<void> {
  const token = getToken();
  await httpClient.del<ApiResponse<null>>(`/favorites/${recordId}`, token);
}

/**
 * 获取收藏列表（分页）
 */
export async function fetchFavorites(
  page: number = 1,
  limit: number = 20,
): Promise<FavoriteListResult> {
  const token = getToken();
  const res = await httpClient.get<ApiResponse<FavoriteListResult>>(
    `/favorites?page=${page}&limit=${limit}`,
    token,
  );
  return res.data;
}

/**
 * 批量检查是否已收藏
 * @returns Record<recordId, boolean>
 */
export async function checkFavorited(
  recordIds: number[],
): Promise<Record<number, boolean>> {
  if (recordIds.length === 0) {
    return {};
  }
  const token = getToken();
  const idsParam = recordIds.join(',');
  const res = await httpClient.get<ApiResponse<Record<number, boolean>>>(
    `/favorites/check?ids=${idsParam}`,
    token,
  );
  return res.data;
}
