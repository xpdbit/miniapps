import { AppError } from '../utils/errors';
import { signToken } from '../lib/jwt';
import { prisma } from './db';

export async function wechatLogin(code: string): Promise<{
  token: string;
  playerId: number;
  isNewPlayer: boolean;
}> {
  if (!code || typeof code !== 'string') {
    throw new AppError(2002, '缺少微信登录 code', 400);
  }

  // 在开发/测试环境下，使用 mock openid
  const isDev = process.env.NODE_ENV !== 'production';
  const openid = isDev ? `mock_openid_dev` : await getWeChatOpenId(code);

  let isNewPlayer = false;
  const today = new Date();

  const existingPlayer = await prisma.game1Player.findUnique({
    where: { openid },
    select: { id: true, lastLoginDate: true, createdAt: true },
  });

  let loginDaysIncrement = 0;
  if (!existingPlayer) {
    loginDaysIncrement = 1;
  } else if (existingPlayer.lastLoginDate) {
    const lastDateStr = existingPlayer.lastLoginDate.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);
    if (lastDateStr !== todayStr) {
      loginDaysIncrement = 1;
    }
  } else {
    loginDaysIncrement = 1;
  }

  const player = await prisma.game1Player.upsert({
    where: { openid },
    update: {
      lastLoginAt: today,
      lastLoginDate: today,
      lastSyncAt: today,
      loginDays: loginDaysIncrement > 0 ? { increment: loginDaysIncrement } : undefined,
    },
    create: {
      openid,
      lastLoginAt: today,
      lastLoginDate: today,
      lastSyncAt: today,
      loginDays: 1,
    },
  });

  if (!existingPlayer) {
    isNewPlayer = true;
  }

  const token = signToken({
    playerId: player.id,
    openid: player.openid,
    role: 'player',
  });

  return { token, playerId: player.id, isNewPlayer };
}

export async function getPlayerById(playerId: number) {
  const player = await prisma.game1Player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      level: true,
      exp: true,
      gold: true,
      gems: true,
      totalMileage: true,
      playTime: true,
      prestigeCount: true,
      loginDays: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!player) return null;

  // 游玩时间 = 当前UTC时间 - 注册UTC时间（秒）
  const computedPlayTime = Math.floor((Date.now() - player.createdAt.getTime()) / 1000);

  return {
    ...player,
    playTime: computedPlayTime,
  };
}

async function getWeChatOpenId(code: string): Promise<string> {
  const axios = require('axios');
  const { config } = require('../config');

  const url = 'https://api.weixin.qq.com/sns/jscode2session';
  const params = {
    appid: config.wechat.appId,
    secret: config.wechat.appSecret,
    js_code: code,
    grant_type: 'authorization_code',
  };

  try {
    const res = await axios.get(url, { params });
    const session = res.data;
    if (session.errcode) {
      throw new AppError(1002, `微信登录失败: ${session.errmsg}`, 401);
    }
    return session.openid as string;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(1002, '微信 API 调用失败', 502);
  }
}
