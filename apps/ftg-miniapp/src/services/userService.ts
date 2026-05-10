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
import { httpClient, API_BASE } from '@/services/httpClient';
import { userDAL } from '@/services/db';
import Taro from '@tarojs/taro';
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
    nickname: '',
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
    nickname: authUser.nickname ?? '',
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
 * @param timeout - 可选的自定义超时（毫秒），覆盖 httpClient 默认值
 * @returns 用户统计信息
 */
export async function fetchUserStatsHttp(token: string, timeout?: number): Promise<UserStats | null> {
  try {
    const res = await httpClient.get<ApiResponse<StatsResponseData>>(
      '/users/me/stats',
      token,
      timeout,
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
// 头像上传 API
// ============================================================

/**
 * 超时/网络错误重试配置
 * 缓解微信基础库 3.15.x WAServiceMainContext timeout Bug
 */
const UPLOAD_MAX_RETRIES = 1;
const UPLOAD_RETRY_DELAY = 1500;

/**
 * 判断上传错误是否为超时类错误
 *
 * 注意：不包含 request:fail 检测 —— request:fail 涵盖 SSL 证书错误、
 * 连接被拒绝、DNS 解析失败等多种非超时故障，不应当作超时来重试。
 * 与 httpClient.ts 的 isTimeoutError 保持一致。
 */
function isUploadTimeoutError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null
        ? String(err)
        : '';
  return (
    msg.includes('timeout') ||
    msg.includes('超时') ||
    msg.includes('Timeout') ||
    msg.includes('ETIMEDOUT')
  );
}

/**
 * 上传用户头像图片
 *
 * 调用 POST /api/v1/auth/avatar (multipart/form-data)，
 * 服务端保存文件并更新用户 avatarUrl。
 *
 * @param token - JWT 令牌
 * @param filePath - 微信临时文件路径（来自 chooseAvatar 的回调）
 * @param timeout - 可选的自定义超时（毫秒），默认 30000
 * @returns 服务端返回的永久头像 URL
 */
export async function uploadAvatar(token: string, filePath: string, timeout = 30000): Promise<string> {
  const maxAttempts = 1 + UPLOAD_MAX_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const uploadRes = await Taro.uploadFile({
        url: `${API_BASE}/auth/avatar`,
        filePath,
        name: 'avatar',
        header: {
          Authorization: `Bearer ${token}`,
        },
        timeout,
      });

      const data = JSON.parse(uploadRes.data) as ApiResponse<{ avatarUrl: string }>;
      if (!data.success) {
        throw new Error(data.errMsg);
      }
      return data.data.avatarUrl;
    } catch (err) {
      lastError = err;

      // 仅对超时类错误重试
      const shouldRetry = attempt < maxAttempts - 1 && isUploadTimeoutError(err);

      if (shouldRetry) {
        console.warn(
          `[uploadAvatar] 头像上传超时，${UPLOAD_RETRY_DELAY}ms 后重试 (${attempt + 1}/${UPLOAD_MAX_RETRIES})`,
        );
        await new Promise((resolve) => setTimeout(resolve, UPLOAD_RETRY_DELAY));
        continue;
      }

      // 最后一次尝试失败或非超时错误 → 抛出友好错误
      break;
    }
  }

  // 错误分类
  if (isUploadTimeoutError(lastError)) {
    throw new Error(`头像上传超时（${timeout / 1000}秒），请检查网络后重试`);
  }
  // 非超时错误直接丢原始错误（保留堆栈，便于定位根因）
  throw lastError;
}

// ============================================================
// 微信加密数据解密（button open-type="getUserInfo" 回调处理）
// ============================================================

/**
 * 解密微信用户加密数据并保存头像/昵称
 *
 * 流程：前端获取 encryptedData + iv → 调用 wx.login() 获取临时 code →
 * 发送到服务端 → 服务端用 code 换 session_key → AES 解密 → 保存昵称和头像 CDN URL
 *
 * @param token - JWT 令牌
 * @param params - 微信加密数据
 * @returns 更新后的用户信息
 */
export async function decryptWechatUserInfo(
  token: string,
  params: { encryptedData: string; iv: string },
): Promise<void> {
  // 获取最新微信登录态（用于服务端换取 session_key 解密）
  const loginRes = await Taro.login({ timeout: 10000 });
  if (!loginRes.code) {
    throw new Error('获取微信登录状态失败');
  }

  const res = await httpClient.post<ApiResponse<unknown>>(
    '/auth/decrypt-user-info',
    { code: loginRes.code, encryptedData: params.encryptedData, iv: params.iv },
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
