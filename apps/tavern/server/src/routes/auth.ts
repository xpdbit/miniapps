import { Router, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import { config } from '../config';
import { signToken } from '../lib/jwt';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

// POST /api/v1/auth/login - WeChat login
router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ code: 400, message: '缺少登录凭证 code', data: null });
      return;
    }

    // Exchange code for openid with WeChat API
    let openid: string;
    try {
      const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
        params: {
          appid: config.wechatAppId,
          secret: config.wechatAppSecret,
          js_code: code,
          grant_type: 'authorization_code',
        },
        timeout: 5000,
      });
      if (wxRes.data.errcode) {
        res.status(400).json({ code: 400, message: '微信登录失败: ' + (wxRes.data.errmsg || 'code 无效'), data: null });
        return;
      }
      openid = wxRes.data.openid;
    } catch {
      res.status(502).json({ code: 502, message: '微信服务暂不可用', data: null });
      return;
    }

    // Find or create user
    const user = await prisma.sharedUser.upsert({
      where: { openid: openid! },
      create: {
        uuid: crypto.randomUUID(),
        openid,
        nickname: '用户_' + openid.slice(-6),
        dailyQuota: 20,
        usedQuota: 0,
        quotaDate: new Date(),
      },
      update: {},
    });

    // Sign JWT
    const token = signToken({ userId: user.id, role: user.role as 'USER' | 'ADMIN' });

    res.json({
      code: 0,
      message: 'ok',
      data: {
        token,
        user: {
          id: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          dailyQuota: user.dailyQuota,
          usedQuota: user.usedQuota,
          role: user.role,
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ code: 500, message: '服务器内部错误', data: null });
  }
});

// GET /api/v1/auth/me - Get current user info
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.sharedUser.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        uuid: true,
        nickname: true,
        avatar: true,
        dailyQuota: true,
        usedQuota: true,
        role: true,
        createdAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ code: 404, message: '用户不存在', data: null });
      return;
    }
    res.json({ code: 0, message: 'ok', data: user });
  } catch {
    res.status(500).json({ code: 500, message: '服务器内部错误', data: null });
  }
});

export default router;