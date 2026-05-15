/**
 * ============================================================
 * 认证服务层
 * 封装 ftg-server 的微信登录和 Token 验证
 * ============================================================
 */

import { httpClient } from '@/services/httpClient';
import type { ApiResponse } from '@/types/api';
import type { AuthUser, LoginResponse } from '@/types/user';

/** POST /auth/me 响应结构 */
interface MeResponseData {
  /** 用户信息 */
  user: AuthUser;
}

/**
 * 使用微信临时 code 登录
 *
 * 调用 ftg-server POST /api/v1/auth/login，
 * 服务端自动 upsert 用户（首次使用自动注册）。
 *
 * @param code - wx.login() 返回的临时 code
 * @param timeout - 可选的自定义超时（毫秒），覆盖 httpClient 默认值
 * @returns JWT token + 用户信息
 */
export async function loginWithWechat(code: string, timeout?: number): Promise<LoginResponse> {
  const res = await httpClient.post<ApiResponse<LoginResponse>>(
    '/auth/login',
    { code },
    undefined,
    timeout,
  );
  if (!res.success) {
    throw new Error(res.errMsg);
  }
  return res.data;
}

/**
 * 获取当前登录用户信息
 *
 * 使用有效的 JWT token 调用 GET /api/v1/auth/me。
 *
 * @param token - JWT 令牌
 * @param timeout - 可选的自定义超时（毫秒），覆盖 httpClient 默认值
 * @returns 用户信息
 */
export async function fetchCurrentUser(token: string, timeout?: number): Promise<AuthUser> {
  const res = await httpClient.get<ApiResponse<MeResponseData>>(
    '/auth/me',
    token,
    timeout,
  );
  if (!res.success) {
    throw new Error(res.errMsg);
  }
  return res.data.user;
}
