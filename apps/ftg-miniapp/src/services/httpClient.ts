/**
 * ============================================================
 * 统一 HTTP 客户端
 * 封装 Taro.request，支持 JWT 自动携带
 * ============================================================
 */

import Taro from '@tarojs/taro';

/** 服务端 API 基础 URL（生产构建时通过 defineConstants 替换，开发时默认连接已部署的服务器） */
export const API_BASE =
  process.env.TARO_APP_API_BASE || 'https://mnapp.top/api/ftl/api/v1';

/** 默认请求超时时间（毫秒）: 30 秒 */
export const REQUEST_TIMEOUT = 30000;

/** 超时/网络错误自动重试次数（缓解微信基础库 3.15.x WAServiceMainContext timeout Bug） */
const MAX_RETRIES = 1;
/** 重试间隔（毫秒） */
const RETRY_DELAY = 1000;

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
   * @param customTimeout - 可选的自定义超时（毫秒），覆盖默认值
   * @returns 响应数据
   */
  async get<T>(path: string, token?: string, customTimeout?: number): Promise<T> {
    return this.request<T>(path, 'GET', undefined, token, customTimeout);
  }

  /**
   * POST 请求
   *
   * @param path - API 路径（不含 baseUrl）
   * @param data - 请求体数据
   * @param token - 可选的 JWT 令牌
   * @param customTimeout - 可选的自定义超时（毫秒），覆盖默认值
   * @returns 响应数据
   */
  async post<T>(
    path: string,
    data?: Record<string, unknown>,
    token?: string,
    customTimeout?: number,
  ): Promise<T> {
    return this.request<T>(path, 'POST', data, token, customTimeout);
  }

  /**
   * PATCH 请求
   *
   * @param path - API 路径（不含 baseUrl）
   * @param data - 请求体数据
   * @param token - 可选的 JWT 令牌
   * @param customTimeout - 可选的自定义超时（毫秒），覆盖默认值
   * @returns 响应数据
   */
  async patch<T>(
    path: string,
    data?: Record<string, unknown>,
    token?: string,
    customTimeout?: number,
  ): Promise<T> {
    return this.request<T>(path, 'PATCH', data, token, customTimeout);
  }

  /**
   * DELETE 请求
   *
   * @param path - API 路径（不含 baseUrl）
   * @param token - 可选的 JWT 令牌
   * @param customTimeout - 可选的自定义超时（毫秒），覆盖默认值
   */
  async del<T>(path: string, token?: string, customTimeout?: number): Promise<T> {
    return this.request<T>(path, 'DELETE', undefined, token, customTimeout);
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    data?: Record<string, unknown>,
    token?: string,
    customTimeout?: number,
  ): Promise<T> {
    const header: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }

    const effectiveTimeout = customTimeout ?? this.timeout;
    const maxAttempts = 1 + MAX_RETRIES;

    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await Taro.request({
          url: `${this.baseUrl}${path}`,
          method,
          header,
          data,
          timeout: effectiveTimeout,
        });
        return res.data as T;
      } catch (err) {
        lastError = err;

        // 仅对超时类错误重试（网络瞬时不稳定、微信基础库 3.15.x Bug 导致）
        const shouldRetry =
          attempt < maxAttempts - 1 && isTimeoutError(err);

        if (shouldRetry) {
          console.warn(
            `[HttpClient] ${method} ${path} 超时，${RETRY_DELAY}ms 后重试 (${attempt + 1}/${MAX_RETRIES})`,
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          continue;
        }

        // 最后一次尝试失败或非超时错误 → 抛出
        break;
      }
    }

    // 错误分类与抛出
    if (isTimeoutError(lastError)) {
      throw new Error(`请求超时（${effectiveTimeout / 1000}秒）: ${method} ${path}`);
    }

    // ★ 网络连接失败诊断 — 根据错误特征区分不同故障类型
    const errStr = typeof lastError === 'object' && lastError !== null ? JSON.stringify(lastError) : String(lastError);

    // SSL/TLS 证书错误（微信小程序拒绝自签名/过期证书）
    if (
      errStr.includes('request:fail') &&
      (errStr.includes('ssl') || errStr.includes('SSL') || errStr.includes('cert') || errStr.includes('certificate') ||
       errStr.includes('tls') || errStr.includes('TLS') || errStr.includes('handshake') ||
       errStr.includes('ERR_SSL') || errStr.includes('CERT_'))
    ) {
      throw new Error(
        `SSL 证书验证失败（${this.baseUrl}），请确认使用了权威 CA 签发的证书。` +
        `微信小程序不接受自签名证书。参考：bash deploy/scripts/setup-ssl.sh`,
      );
    }

    // DNS 解析失败（域名无法解析）
    if (
      errStr.includes('request:fail') &&
      (errStr.includes('ENOTFOUND') || errStr.includes('EAI_AGAIN') || errStr.includes('Could not resolve') ||
       errStr.includes('getaddrinfo') || errStr.includes('DNS') || errStr.includes('name not resolved'))
    ) {
      throw new Error(`DNS 解析失败（${this.baseUrl}），请检查域名是否正确解析到服务器 IP`);
    }

    // 连接被拒绝（服务器端口未开放或 Nginx 未运行）
    if (
      errStr.includes('ERR_CONNECTION_REFUSED') ||
      errStr.includes('Connection refused') ||
      errStr.includes('ECONNREFUSED')
    ) {
      throw new Error(`服务器连接被拒绝（${this.baseUrl}），请确认服务已启动且端口可访问`);
    }

    // 通用连接失败（iOS NSURLErrorDomain 等）
    if (
      errStr.includes('request:fail') ||
      errStr.includes('Network Error') ||
      errStr.includes('NSURLErrorDomain')
    ) {
      throw new Error(`无法连接到服务器（${this.baseUrl}），请检查网络连接、HTTPS 证书或稍后重试`);
    }

    // 其他未知错误，保留原始信息
    throw lastError;
  }
}

/** 全局单例 */
export const httpClient = new HttpClient();
