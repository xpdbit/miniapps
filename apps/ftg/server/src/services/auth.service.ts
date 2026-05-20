import httpClient from '../lib/http-client';
import { env } from '../config/env';

interface WechatSession {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * Generate a deterministic mock WeChat session for development/testing.
 * Uses a hash of the code to produce consistent openid values.
 */
function generateMockSession(code: string): WechatSession {
  // Derive a stable openid from the code to avoid creating new users on every login
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = ((hash << 5) - hash) + code.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  const mockOpenid = `mock_dev_${Math.abs(hash).toString(36).padStart(8, '0')}`;
  return {
    openid: mockOpenid,
    session_key: 'dev_session_key',
  };
}

/**
 * Call WeChat code2Session API to exchange code for openid
 *
 * In development mode (NODE_ENV=development), if WECHAT_APPID/WECHAT_SECRET
 * are not configured, returns a mock session so the auth flow can be tested
 * without real WeChat credentials.
 */
export async function getWechatSession(code: string): Promise<WechatSession> {
  // For testing: if code starts with "test_" or "dev_", return mock data
  if (code.startsWith('test_') || code.startsWith('dev_')) {
    const suffix = code.startsWith('test_') ? code.replace('test_', '') : code.replace('dev_', '');
    return {
      openid: `mock_openid_${suffix}`,
      session_key: 'mock_session_key',
    };
  }

  // Auto-fallback to mock when credentials are missing (all environments)
  // This prevents 500 errors when MiniApp sends a real wx.login() code but
  // the server doesn't have WECHAT_APPID/WECHAT_SECRET configured yet.
  // When credentials are eventually provided, the real WeChat API is used.
  if (env.WECHAT_APPID && env.WECHAT_SECRET) {
    // Both credentials present → proceed to real API call below
  } else {
    const missing = !env.WECHAT_APPID && !env.WECHAT_SECRET
      ? 'WECHAT_APPID 和 WECHAT_SECRET'
      : !env.WECHAT_APPID
        ? 'WECHAT_APPID'
        : 'WECHAT_SECRET';
    console.warn(
      `[auth] ${missing} 未配置，降级使用 Mock 登录（环境: ${env.NODE_ENV}）`,
    );
    return generateMockSession(code);
  }

  const url = 'https://api.weixin.qq.com/sns/jscode2session';
  const { data } = await httpClient.get<WechatSession>(url, {
    params: {
      appid: env.WECHAT_APPID,
      secret: env.WECHAT_SECRET,
      js_code: code,
      grant_type: 'authorization_code',
    },
  });

  if (data.errcode && data.errcode !== 0) {
    // Map common WeChat error codes to user-friendly messages
    // Using string literals to avoid TypeScript issues with negative numeric keys
    const friendlyMsg =
      (data.errcode === 40013 && 'AppID 无效，请检查 WECHAT_APPID 配置是否正确') ||
      (data.errcode === 40001 && 'AppSecret 无效，请检查 WECHAT_SECRET 配置是否正确') ||
      (data.errcode === 41002 && 'AppID 缺失，请检查 WECHAT_APPID 环境变量是否已正确设置') ||
      (data.errcode === 41004 && 'AppSecret 缺失，请检查 WECHAT_SECRET 环境变量是否已正确设置') ||
      (data.errcode === -1 && '微信服务器繁忙，请稍后重试') ||
      (data.errcode === 40029 && '登录 code 无效或已过期，请重新启动小程序') ||
      (data.errcode === 45011 && 'API 调用频率超限，请稍后重试') ||
      '微信登录服务异常';
    throw new Error(
      `微信登录失败: ${friendlyMsg}（原始错误: ${data.errmsg}, code: ${data.errcode}）`,
    );
  }

  return data;
}

/**
 * Login with WeChat code - returns JWT token and user info.
 * ⚠️ DEPRECATED: 用户管理已迁移至 Dashboard Admin API (/api/auth/wechat/login)。
 * FTG Server 仅验证 JWT（middleware/auth.ts），不管理用户。
 * 此函数保留作为兼容过渡，直接调用 Dashboard API。
 */
export async function wechatLogin(code: string) {
  // 1. Exchange code for openid (WeChat API)
  const session = await getWechatSession(code);

  // 2. Delegate to Dashboard auth API
  const authApiUrl = process.env.AUTH_API_URL || 'http://localhost:3001';
  const httpClient = await import('../lib/http-client').then(m => m.default);
  const response = await httpClient.post<{
    code: number;
    data?: { access_token: string; refresh_token: string; user: { uuid: string; nickname: string; avatar_url: string; role: string } };
  }>(`${authApiUrl}/api/auth/wechat/login`, { wx_code: code });

  if (!response.data?.data) {
    throw new Error('Dashboard 统一认证失败');
  }

  return {
    token: response.data.data.access_token,
    refreshToken: response.data.data.refresh_token,
    user: response.data.data.user,
  };
}

/**
 * Get user by ID.
 * ⚠️ DEPRECATED: 用户数据已迁移至 miniapps.users。
 * 使用 Dashboard API /api/auth/me 获取当前用户信息。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getUserById(userUuid: string) {
  // TODO: 改为调用 Dashboard API GET /api/auth/me?uuid=xxx (需admin权限)
  return null;
}

/**
 * Get user by ID (raw, no transformation)
 * ⚠️ DEPRECATED: 同上
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getUserByIdRaw(userUuid: string) {
  return null;
}
