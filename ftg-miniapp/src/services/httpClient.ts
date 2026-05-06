/**
 * ============================================================
 * 统一 HTTP 客户端
 * 封装 Taro.request，支持 JWT 自动携带
 * ============================================================
 */

import Taro from '@tarojs/taro';

/** 服务端 API 基础 URL（需配置域名白名单） */
export const API_BASE =
  process.env.TARO_APP_API_BASE || 'http://localhost:3000/api/v1';

/** 默认请求超时时间（毫秒）: 30 秒 */
export const REQUEST_TIMEOUT = 30000;

/** 超时错误判断 */
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
 * HTTP 客户端类
 *
 * 提供统一的 GET/POST 方法，支持可选的 JWT Authorization header。
 */
export class HttpClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = API_BASE, timeout: number = REQUEST_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * GET 请求
   *
   * @param path - API 路径（不含 baseUrl）
   * @param token - 可选的 JWT 令牌
   * @returns 响应数据
   */
  async get<T>(path: string, token?: string): Promise<T> {
    return this.request<T>(path, 'GET', undefined, token);
  }

  /**
   * POST 请求
   *
   * @param path - API 路径（不含 baseUrl）
   * @param data - 请求体数据
   * @param token - 可选的 JWT 令牌
   * @returns 响应数据
   */
  async post<T>(
    path: string,
    data?: Record<string, unknown>,
    token?: string,
  ): Promise<T> {
    return this.request<T>(path, 'POST', data, token);
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST',
    data?: Record<string, unknown>,
    token?: string,
  ): Promise<T> {
    const header: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await Taro.request({
        url: `${this.baseUrl}${path}`,
        method,
        header,
        data,
        timeout: this.timeout,
      });
      return res.data as T;
    } catch (err) {
      if (isTimeoutError(err)) {
        throw new Error(`请求超时（${this.timeout / 1000}秒）: ${method} ${path}`);
      }

      // 网络连接失败（服务器未启动、DNS 解析失败等）
      const errStr = typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err);
      if (
        errStr.includes('request:fail') ||
        errStr.includes('ERR_CONNECTION_REFUSED') ||
        errStr.includes('Network Error') ||
        errStr.includes('NSURLErrorDomain')
      ) {
        throw new Error(`无法连接到服务器（${this.baseUrl}），请确认服务已启动`);
      }

      // 其他未知错误，保留原始信息
      throw err;
    }
  }
}

/** 全局单例 */
export const httpClient = new HttpClient();
