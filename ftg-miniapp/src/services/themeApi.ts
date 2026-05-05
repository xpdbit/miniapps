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

/** 服务端 API 基础 URL（需配置域名白名单） */
const API_BASE = process.env.TARO_APP_API_BASE || 'http://localhost:3000/api/v1';

/** 通用请求头 */
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  return headers;
}

/**
 * 通用 GET 请求
 */
async function get<T>(path: string): Promise<T> {
  const res = await Taro.request({
    url: `${API_BASE}${path}`,
    method: 'GET',
    header: getHeaders(),
    timeout: 10000,
  });
  return res.data as T;
}

/**
 * 通用 POST 请求
 */
async function post<T>(path: string, data: Record<string, unknown>): Promise<T> {
  const res = await Taro.request({
    url: `${API_BASE}${path}`,
    method: 'POST',
    header: getHeaders(),
    data,
    timeout: 10000,
  });
  return res.data as T;
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
