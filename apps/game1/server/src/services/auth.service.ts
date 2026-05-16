import { AppError } from '../utils/errors';
import { signToken } from '../lib/jwt';
import { prisma } from './db';

export async function wechatLogin(code: string): Promise<{
  token: string;
  playerId: string;
  isNewPlayer: boolean;
}> {
  if (!code || typeof code !== 'string') {
    throw new AppError(2002, '缺少微信登录 code', 400);
  }

  // 在开发/测试环境下，使用 mock uuid
  const isDev = process.env.NODE_ENV !== 'production';
  const clientUuid = isDev ? `mock_uuid_dev` : await getWeChatOpenId(code);

  let isNewPlayer = false;
  const today = new Date();

  const existingPlayer = await prisma.game1Player.findUnique({
    where: { uuid: clientUuid },
    select: { id: true, last_login_date: true, created_at: true },
  });

  let loginDaysIncrement = 0;
  if (!existingPlayer) {
    loginDaysIncrement = 1;
  } else if (existingPlayer.last_login_date) {
    const lastDateStr = existingPlayer.last_login_date.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);
    if (lastDateStr !== todayStr) {
      loginDaysIncrement = 1;
    }
  } else {
    loginDaysIncrement = 1;
  }

  const player = await prisma.game1Player.upsert({
    where: { uuid: clientUuid },
    update: {
      last_login_at: today,
      last_login_date: today,
      last_sync_at: today,
      login_days: loginDaysIncrement > 0 ? { increment: loginDaysIncrement } : undefined,
    },
    create: {
      uuid: clientUuid,
      last_login_at: today,
      last_login_date: today,
      last_sync_at: today,
      login_days: 1,
    },
  });

  if (!existingPlayer) {
    isNewPlayer = true;
  }

  const token = signToken({
    playerId: player.id,
    uuid: player.uuid,
    role: 'player',
  });

  return { token, playerId: player.id, isNewPlayer };
}

export async function getPlayerById(playerId: string) {
  const player = await prisma.game1Player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      nickname: true,
      avatar_url: true,
      level: true,
      exp: true,
      gold: true,
      gems: true,
      total_mileage: true,
      play_time: true,
      prestige_count: true,
      login_days: true,
      last_login_at: true,
      created_at: true,
    },
  });
  if (!player) return null;

  // 游玩时间 = 当前UTC时间 - 注册UTC时间（秒）
  const computedPlayTime = Math.floor((Date.now() - player.created_at.getTime()) / 1000);

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
