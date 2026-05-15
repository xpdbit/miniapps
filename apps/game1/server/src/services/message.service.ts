import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * 微信订阅消息模板 ID（占位符，需替换为真实模板 ID）
 */
export const SUBSCRIBE_TEMPLATES = {
  PVP_RESULT: 'TEMPLATE_PVP_RESULT',
  ACHIEVEMENT_UNLOCK: 'TEMPLATE_ACHIEVEMENT_UNLOCK',
  DAILY_REWARD: 'TEMPLATE_DAILY_REWARD',
  PRESTIGE_COMPLETE: 'TEMPLATE_PRESTIGE_COMPLETE',
} as const;

export type SubscribeTemplateId = (typeof SUBSCRIBE_TEMPLATES)[keyof typeof SUBSCRIBE_TEMPLATES];

interface AccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface SubscribeSendResponse {
  errcode: number;
  errmsg: string;
}

export interface SendSubscribeMessageParams {
  openid: string;
  templateId: string;
  page?: string;
  data: Record<string, { value: string }>;
  miniprogramState?: 'formal' | 'trial' | 'developer';
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * 获取微信 access_token（带缓存，过期前 5 分钟刷新）
 */
async function getAccessToken(): Promise<string | null> {
  // 检查缓存是否有效
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) {
    return cachedToken.token;
  }

  try {
    const { appId, appSecret } = config.wechat;

    if (!appId || !appSecret) {
      logger.error('微信配置缺失：appId 或 appSecret 为空');
      return null;
    }

    const url = 'https://api.weixin.qq.com/cgi-bin/token';
    const response = await axios.get<AccessTokenResponse>(url, {
      params: {
        grant_type: 'client_credential',
        appid: appId,
        secret: appSecret,
      },
    });

    const data = response.data;

    if (data.errcode || !data.access_token) {
      logger.error('获取微信 access_token 失败', {
        errcode: data.errcode,
        errmsg: data.errmsg,
      });
      return null;
    }

    // 缓存 token，提前 5 分钟过期
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    };

    return data.access_token;
  } catch (err) {
    logger.error('请求微信 access_token 异常', { err });
    return null;
  }
}

/**
 * 发送微信订阅消息
 * 不抛出异常，以布尔值表示发送结果
 */
export async function sendSubscribeMessage(
  params: SendSubscribeMessageParams,
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      logger.warn('发送订阅消息失败：无法获取 access_token');
      return false;
    }

    const url = 'https://api.weixin.qq.com/cgi-bin/message/subscribe/send';
    const response = await axios.post<SubscribeSendResponse>(url, {
      touser: params.openid,
      template_id: params.templateId,
      page: params.page,
      data: params.data,
      miniprogram_state: params.miniprogramState ?? 'formal',
    }, {
      params: { access_token: accessToken },
    });

    const result = response.data;

    if (result.errcode !== 0) {
      logger.warn('发送订阅消息失败', {
        errcode: result.errcode,
        errmsg: result.errmsg,
        openid: params.openid,
        templateId: params.templateId,
      });
      return false;
    }

    return true;
  } catch (err) {
    logger.error('发送订阅消息异常', {
      err,
      openid: params.openid,
      templateId: params.templateId,
    });
    return false;
  }
}
