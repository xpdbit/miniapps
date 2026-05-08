/**
 * ============================================================
 * 用户服务层
 * 封装 CloudBase 免登录用户数据获取 + HTTP API 备选路径
 * ============================================================
 *
 * - CloudBase 路径：通过 getOpenId 云函数获取 openid，再通过 userDAL 自动创建/获取
 * - HTTP API 路径：通过 ftg-server REST API 获取用户档案（项目迁移方向）
 */

import { CLOUD_FUNCTIONS } from '@/constants/apiEndpoints';
import { httpClient } from '@/services/httpClient';
import { userDAL } from '@/services/db';
import type { ApiResponse } from '@/types/api';
import type { AuthUser, MeResponse, UserProfile, UserStats } from '@/types/user';

// ============================================================
// 模块级 openid 缓存，避免重复调用云函数
// ============================================================
let cachedOpenId: string | null = null;

/**
 * 获取当前用户的微信 openid
 *
 * 通过 getOpenId 云函数获取，结果缓存在模块级变量中。
 * 首次调用后缓存，后续直接返回缓存值。
 *
 * @returns 用户 openid
 */
async function getOpenId(): Promise<string> {
  if (cachedOpenId !== null) {
    return cachedOpenId;
  }

  const res = await wx.cloud.callFunction({
    name: 'getOpenId',
  });

  const result = res.result as { openid: string };
  const openid = result.openid;

  if (openid === undefined || openid.length === 0) {
    throw new Error('获取用户身份失败');
  }

  cachedOpenId = openid;
  return openid;
}

/**
 * 获取用户统计数据
 *
 * @param openid - 用户 openid
 * @returns 用户统计信息，失败时返回 null
 */
async function fetchUserStats(openid: string): Promise<UserStats | null> {
  try {
    const statsRes = await wx.cloud.callFunction({
      name: CLOUD_FUNCTIONS.GET_USER_STATS,
      data: { openid },
    });

    const statsResult = statsRes.result as ApiResponse<UserStats>;

    if (!statsResult.success) {
      console.warn('[userService] getUserStats 返回失败:', statsResult.errMsg);
      return null;
    }

    return statsResult.data;
  } catch (error) {
    console.warn('[userService] getUserStats 调用异常:', error);
    return null;
  }
}

/**
 * 获取用户档案（含基础统计）
 *
 * 自动完成免登录认证和首次用户创建。
 * 当 getUserStats 云函数未实现或失败时，
 * 使用 userDAL 中的基础统计字段兜底。
 *
 * @returns 用户公开资料
 */
export async function getUserProfile(): Promise<UserProfile> {
  const openid = await getOpenId();

  // 查找或创建用户（首次使用自动创建）
  const user = await userDAL.findOrCreate(openid, {
    nickname: '美食探索者',
  });

  // 获取详细统计（失败时降级使用 userDoc 基础值）
  const stats = await fetchUserStats(openid);

  return {
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    totalRecords: stats?.totalRecords ?? user.totalRecords,
    unlockedAchievements: stats?.achievementsUnlocked ?? 0,
    maxStreak: stats?.maxStreak ?? 0,
  };
}

/**
 * 获取完整的用户统计数据
 *
 * 返回比 UserProfile 更丰富的统计详情，
 * 包括 foodTypeCounts、totalCheckins 等。
 *
 * @returns 完整的用户统计（无统计时返回 null）
 */
export async function getUserStats(): Promise<UserStats | null> {
  const openid = await getOpenId();
  return fetchUserStats(openid);
}

/**
 * 通过 HTTP API 获取用户档案（备选路径）
 *
 * 作为 CloudBase 的替代方案，通过 ftg-server REST API 获取用户信息。
 * 当 CloudBase 不可用时，可切换到此方案。
 * 统计数据字段将在后续通过单独接口获取。
 *
 * @param token - JWT 令牌
 * @returns 用户公开资料
 */
export async function getUserProfileViaHttp(token: string): Promise<UserProfile> {
  const res = await httpClient.get<ApiResponse<MeResponse>>('/auth/me', token);
  if (!res.success) {
    throw new Error(res.errMsg);
  }
  const authUser: AuthUser = res.data.user;

  return {
    nickname: authUser.nickname ?? '美食探索者',
    avatarUrl: authUser.avatarUrl ?? '',
    totalRecords: 0,
    unlockedAchievements: 0,
    maxStreak: 0,
  };
}

/**
 * 清除缓存的 openid
 *
 * 在用户登出或切换账号时调用。
 */
export function clearUserCache(): void {
  cachedOpenId = null;
}

// ============================================================
// HTTP API 路径（替代 CloudBase，避免超时）
// ============================================================

/** GET /users/me/stats 响应结构 */
interface StatsResponseData {
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

/**
 * 通过 HTTP API 获取用户统计
 *
 * 调用 GET /api/v1/users/me/stats，依赖 JWT 认证。
 *
 * @param token - JWT 令牌
 * @returns 用户统计信息
 */
export async function fetchUserStatsHttp(token: string): Promise<UserStats | null> {
  try {
    const res = await httpClient.get<ApiResponse<StatsResponseData>>(
      '/users/me/stats',
      token,
    );
    if (!res.success) {
      console.warn('[userService] /users/me/stats 返回失败:', res.errMsg);
      return null;
    }
    return res.data;
  } catch (error) {
    console.warn('[userService] /users/me/stats HTTP 调用失败:', error);
    return null;
  }
}

/**
 * 通过 HTTP API 更新用户资料（昵称、头像）
 *
 * 调用 PATCH /api/v1/auth/me，依赖 JWT 认证。
 *
 * @param token - JWT 令牌
 * @param data - 需要更新的字段
 */
export async function updateUserProfileHttp(
  token: string,
  data: { nickname?: string | null; avatarUrl?: string | null },
): Promise<void> {
  const res = await httpClient.patch<ApiResponse<{ user: AuthUser }>>(
    '/auth/me',
    data,
    token,
  );
  if (!res.success) {
    throw new Error(res.errMsg);
  }
}

// ============================================================
// HTTP API 食物记录操作
// ============================================================

/** 服务端返回的食物记录字段 */
export interface ServerFoodRecord {
  id: number;
  imageUrl: string | null;
  themeImageUrl: string | null;
  foodName: string;
  foodType: string;
  caloriesTotal: number | null;
  aiDescShort: string | null;
  gameDescription: string | null;
  locationName: string | null;
  themeId: string | null;
  createdAt: string;
}

/** 服务端分页列表响应 */
interface ServerRecordsListResponse {
  list: ServerFoodRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * 将服务端食物记录转换为客户端 FoodRecordDoc 格式
 */
export function serverRecordToFoodDoc(sr: ServerFoodRecord): import('@/services/db/schema').FoodRecordDoc {
  return {
    _id: String(sr.id),
    openid: '',
    imageFileID: sr.imageUrl ?? '',
    themeImageFileID: sr.themeImageUrl ?? '',
    foodName: sr.foodName,
    foodType: sr.foodType as import('@/types/food').FoodType,
    calories: {
      total: sr.caloriesTotal ?? 0,
      per100g: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
    },
    aiDescription: { short: sr.aiDescShort ?? '', gameStyle: '', detail: '' },
    gameDescription: sr.gameDescription ?? '',
    latitude: 0,
    longitude: 0,
    locationName: sr.locationName ?? '',
    ipLocation: '',
    themeId: sr.themeId ?? '',
    createdAt: sr.createdAt,
  };
}

/**
 * 通过 HTTP API 分页获取食物记录
 *
 * 调用 GET /api/v1/records，依赖 JWT 认证。
 * 支持 foodType 筛选。
 *
 * @param token - JWT 令牌
 * @param params - 分页和筛选参数
 * @returns 分页结果，兼容 FoodRecordDoc
 */
export async function fetchRecordsListHttp(
  token: string,
  params: { page?: number; limit?: number; foodType?: string } = {},
) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.foodType) query.set('foodType', params.foodType);

  const res = await httpClient.get<ApiResponse<ServerRecordsListResponse>>(
    `/records?${query.toString()}`,
    token,
  );

  if (!res.success) {
    return { list: [], total: 0, page: 1, pageSize: 20, totalPages: 0, hasMore: false };
  }

  return {
    list: res.data.list.map(serverRecordToFoodDoc),
    total: res.data.total,
    page: res.data.page,
    pageSize: res.data.pageSize,
    totalPages: res.data.totalPages,
    hasMore: res.data.hasMore,
  };
}

/**
 * 通过 HTTP API 搜索食物记录
 *
 * 调用 GET /api/v1/records/search?q=keyword，依赖 JWT 认证。
 *
 * @param token - JWT 令牌
 * @param keyword - 搜索关键词
 * @returns 匹配的记录列表
 */
export async function searchRecordsHttp(
  token: string,
  keyword: string,
) {
  const query = new URLSearchParams({ q: keyword });
  const res = await httpClient.get<ApiResponse<ServerFoodRecord[]>>(
    `/records/search?${query.toString()}`,
    token,
  );

  if (!res.success) {
    return [];
  }

  return res.data.map(serverRecordToFoodDoc);
}
