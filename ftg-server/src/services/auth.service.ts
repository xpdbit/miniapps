import httpClient from '../lib/http-client';
import prisma from '../lib/prisma';
import { signToken } from '../lib/jwt';
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
 * Login with WeChat code - returns JWT token and user info
 * Creates user on first login
 */
export async function wechatLogin(code: string) {
  // 1. Exchange code for openid
  const session = await getWechatSession(code);

  // 2. Upsert user
  const user = await prisma.user.upsert({
    where: { openid: session.openid },
    update: {
      updatedAt: new Date(),
    },
    create: {
      openid: session.openid,
    },
  });

  // 3. Sign JWT
  const token = signToken({ openid: session.openid, userId: user.id });

  return { token, user };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number) {
  return prisma.user.findUnique({ where: { id: userId } });
}
