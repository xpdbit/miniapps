/**
 * Game1 API 客户端
 * 封装 Taro.request，支持 JWT 自动携带、超时重试
 */

import Taro from '@tarojs/taro';

/**
 * API 基础 URL
 * 小程序环境没有全局 process 对象，需通过 typeof 守卫避免 ReferenceError。
 * 实际值通过 Taro 构建配置的 defineConstants 注入。
 */
function getApiBase(): string {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.TARO_APP_API_BASE) {
      return process.env.TARO_APP_API_BASE;
    }
  } catch {
    // process 未定义时忽略
  }
  return 'http://localhost:3004/api/v1/game1';
}

export const API_BASE = getApiBase();

/** 请求超时（毫秒） */
const REQUEST_TIMEOUT = 15000;
const MAX_RETRIES = 1;
const RETRY_DELAY = 1000;

/** Token 存储 key */
const TOKEN_KEY = 'g1_auth_token';

// ============================================================
// Token 管理
// ============================================================

export function getToken(): string | null {
  try {
    return Taro.getStorageSync(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    Taro.setStorageSync(TOKEN_KEY, token);
  } catch {
    // 静默失败
  }
}

export function removeToken(): void {
  try {
    Taro.removeStorageSync(TOKEN_KEY);
  } catch {
    // 静默失败
  }
}

// ============================================================
// 响应类型
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  errCode?: number;
  errMsg?: string;
}

export interface PlayerData {
  id: number;
  nickname: string | null;
  avatarUrl: string | null;
  level: number;
  exp: number;
  gold: number;
  gems: number;
  totalMileage: number;
  playTime: number;
  prestigeCount: number;
  loginDays: number;
  lastLoginAt: string;
  createdAt: string;
}

export interface LoginResult {
  token: string;
  playerId: number;
  isNewPlayer: boolean;
}

export interface SyncPayload {
  level: number;
  exp: number;
  gold: number;
  gems: number;
  totalMileage: number;
  playTime: number;
  prestigeCount: number;
}

export interface SyncResult {
  player: PlayerData;
  corrected: boolean;
  corrections: string[];
}

export interface ReconcileResult {
  player: {
    id: number;
    level: number;
    exp: number;
    gold: number;
    gems: number;
    totalMileage: number;
    playTime: number;
    prestigeCount: number;
  };
  offlineRewards: {
    gold: number;
    exp: number;
    mileage: number;
    combatClears: number;
    elapsedSeconds: number;
    decayMultiplier: number;
  } | null;
  serverTime: number;
}

export interface CloudSaveData {
  id: number;
  playerId: number;
  saveData: Record<string, unknown>;
  version: number;
  checksum: string | null;
  updatedAt: string;
}

// ============================================================
// HTTP 请求
// ============================================================

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  data?: Record<string, unknown>,
  skipAuth = false,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;

  const header: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!skipAuth) {
    const token = getToken();
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await Taro.request({
        url,
        method,
        data,
        header,
        timeout: REQUEST_TIMEOUT,
        dataType: 'json',
      });

      const body = res.data as ApiResponse<T>;

      if (body.success) {
        return body;
      }

      // 401 → token 过期，清除登录态
      if (body.errCode === 401 || res.statusCode === 401) {
        removeToken();
        Taro.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
      }

      return body;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
      }
    }
  }

  Taro.showToast({ title: '网络连接失败', icon: 'none' });
  return { success: false, errCode: -1, errMsg: '网络连接失败' };
}

// ============================================================
// API 方法
// ============================================================

/** 微信登录 */
export async function login(code: string): Promise<ApiResponse<LoginResult>> {
  return request<LoginResult>('POST', '/auth/login', { code }, true);
}

/** 获取当前玩家信息 */
export async function getMe(): Promise<ApiResponse<PlayerData>> {
  return request<PlayerData>('GET', '/auth/me');
}

/** 获取玩家详情 */
export async function getPlayer(playerId: number): Promise<ApiResponse<PlayerData>> {
  return request<PlayerData>('GET', `/players/${playerId}`);
}

/** 同步游戏数据到服务器（带增速校验，返回纠偏信息） */
export async function syncPlayer(
  playerId: number,
  payload: SyncPayload,
): Promise<ApiResponse<SyncResult>> {
  return request<SyncResult>('PUT', `/players/${playerId}/sync`, payload as unknown as Record<string, unknown>);
}

/** 登录调协：服务端计算离线收益，返回权威数据 */
export async function reconcilePlayer(
  playerId: number,
): Promise<ApiResponse<ReconcileResult>> {
  return request<ReconcileResult>('POST', `/players/${playerId}/reconcile`);
}

/** 加载云端存档 */
export async function loadSave(
  playerId: number,
): Promise<ApiResponse<CloudSaveData>> {
  return request<CloudSaveData>('GET', `/save/${playerId}`);
}

/** 更新玩家资料 */
export async function updateProfile(
  playerId: number,
  data: { nickname?: string; avatarUrl?: string },
): Promise<ApiResponse<PlayerData>> {
  return request<PlayerData>('PUT', `/players/${playerId}/profile`, data as unknown as Record<string, unknown>);
}

/** 上传云端存档 */
export async function uploadSave(
  playerId: number,
  saveData: Record<string, unknown>,
  expectedVersion?: number,
): Promise<ApiResponse<unknown>> {
  return request<unknown>('PUT', `/save/${playerId}`, {
    saveData,
    expectedVersion,
  } as unknown as Record<string, unknown>);
}

/** 删除玩家云端存档 */
export async function deleteSave(playerId: number): Promise<ApiResponse<unknown>> {
  return request<unknown>('DELETE', `/save/${playerId}`);
}
