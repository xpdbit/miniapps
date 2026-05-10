/**
 * 主题 HTTP API 服务层
 *
 * 通过 Taro.request 调用 ftg-server 的 REST API。
 * 在小程序中使用需要先在微信公众平台配置 request 域名白名单。
 *
 * 如果无法使用 HTTP，回退到云函数/云数据库方案（当前系统默认）。
 */
import Taro from '@tarojs/taro';
import type {
  Theme,
  RenderResult,
  ThemeClassData,
  ThemeUsageStats,
} from '@/types/theme';

import { API_BASE, REQUEST_TIMEOUT } from '@/services/httpClient';

/** 超时/网络错误自动重试次数（缓解微信基础库 3.15.x WAServiceMainContext timeout Bug） */
const MAX_RETRIES = 1;
/** 重试间隔（毫秒） */
const RETRY_DELAY = 1000;

/** PError 超时判断 — 兼容 Taro 不同版本的 error 格式 */
function isTimeoutError(err: unknown): boolean {
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
 * 通用的 Taro.request 包装，统一处理超时等错误，含 1 次重试
 */
async function taroRequest<T>(
  url: string,
  method: 'GET' | 'POST',
  data?: Record<string, unknown>,
): Promise<T> {
  const maxAttempts = 1 + MAX_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await Taro.request({
        url,
        method,
        header: {
          'Content-Type': 'application/json',
        },
        data,
        timeout: REQUEST_TIMEOUT,
      });
      return res.data as T;
    } catch (err) {
      lastError = err;

      if (attempt < maxAttempts - 1 && isTimeoutError(err)) {
        console.warn(
          `[ThemeApi] ${method} ${url} 超时，${RETRY_DELAY}ms 后重试 (${attempt + 1}/${MAX_RETRIES})`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        continue;
      }
      break;
    }
  }

  if (isTimeoutError(lastError)) {
    throw new Error(`请求超时（${REQUEST_TIMEOUT / 1000}秒）: ${method} ${url}`);
  }
  throw lastError;
}

/**
 * 通用 GET 请求
 */
async function get<T>(path: string): Promise<T> {
  return taroRequest<T>(`${API_BASE}${path}`, 'GET');
}

/**
 * 通用 POST 请求
 */
async function post<T>(path: string, data: Record<string, unknown>): Promise<T> {
  return taroRequest<T>(`${API_BASE}${path}`, 'POST', data);
}

// ============================================================
// 主题 API
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  errCode: number;
  errMsg: string;
}

/**
 * 获取主题列表
 */
export async function fetchThemes(isActive?: boolean): Promise<Theme[]> {
  const query = isActive !== undefined ? `?isActive=${isActive}` : '';
  const res = await get<ApiResponse<Theme[]>>(`/themes${query}`);
  return res.data;
}

/**
 * 获取主题详情
 */
export async function fetchThemeById(themeId: string): Promise<Theme | null> {
  const res = await get<ApiResponse<Theme>>(`/themes/${themeId}`);
  return res.data;
}

/**
 * 通过短命名获取主题
 */
export async function fetchThemeByShortName(shortName: string): Promise<Theme | null> {
  const res = await get<ApiResponse<Theme>>(`/themes/by-short/${shortName}`);
  return res.data;
}

/**
 * 获取主题渲染结果
 */
export async function renderTheme(
  themeMarkup: string,
  cssClasses: ThemeClassData[],
  data: Record<string, string>,
  mode: 'miniapp' | 'h5' = 'miniapp',
): Promise<RenderResult> {
  const res = await post<ApiResponse<RenderResult>>('/theme/render', {
    templateMarkup: themeMarkup,
    cssClasses,
    data,
    mode,
  });
  return res.data;
}

/**
 * 主题预览（管理端用）
 */
export async function renderThemePreview(
  templateMarkup: string,
  cssClassIds?: string[],
  data?: Record<string, string>,
): Promise<string> {
  const res = await post<ApiResponse<{ html: string }>>('/theme/render-preview', {
    templateMarkup,
    cssClassIds: cssClassIds ?? [],
    data: data ?? {},
    mode: 'h5',
  });
  return res.data.html;
}

/**
 * 获取主题使用统计
 */
export async function fetchThemeStats(themeId: string): Promise<ThemeUsageStats> {
  const res = await get<ApiResponse<ThemeUsageStats>>(`/themes/${themeId}/stats`);
  return res.data;
}

/**
 * 记录主题使用
 */
export async function recordThemeUsage(
  themeId: string,
  recordId: string,
  userId: number,
): Promise<void> {
  await post(`/themes/${themeId}/usage`, { recordId, userId });
}
