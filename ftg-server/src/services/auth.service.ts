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
 * Call WeChat code2Session API to exchange code for openid
 */
export async function getWechatSession(code: string): Promise<WechatSession> {
  // For testing: if code starts with "test_", return mock data
  if (code.startsWith('test_')) {
    return {
      openid: `mock_openid_${code.replace('test_', '')}`,
      session_key: 'mock_session_key',
    };
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
    throw new Error(`WeChat API error: ${data.errmsg} (code: ${data.errcode})`);
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
