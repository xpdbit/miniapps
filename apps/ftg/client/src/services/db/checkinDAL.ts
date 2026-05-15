/**
 * ============================================================
 * 打卡集合 (checkins) 数据访问层
 * ============================================================
 *
 * 处理用户打卡记录，支持连续打卡天数计算。
 */

import type { PaginatedResult } from '@/types/api';
import { BaseDAL, nowISO } from './BaseDAL';
import type { CheckinDoc, CreateCheckinInput } from './schema';
import type { ListQueryOptions } from './BaseDAL';

// ============================================================
// CheckinDAL
// ============================================================
export class CheckinDAL extends BaseDAL<CheckinDoc> {
  protected collectionName = 'checkins' as const;

  /**
   * 创建打卡记录
   *
   * 自动计算连续打卡天数：查询用户最新打卡记录，
   * 若上次打卡是昨天则 streakCount + 1，否则从 1 开始。
   *
   * @param openid - 用户 openid
   * @param foodRecordId - 关联食物记录 ID
   * @param options - 额外打卡数据（位置等）
   * @returns 新打卡记录 ID
   */
  async createCheckin(
    openid: string,
    foodRecordId: string,
    options?: {
      locationName?: string;
      latitude?: number;
      longitude?: number;
    },
  ): Promise<{ checkinId: string; streakCount: number }> {
    // 获取最新打卡记录以计算连续天数
    const latestCheckin = await this.getLatestByOpenId(openid);

    let streakCount = 1;

    if (latestCheckin !== null) {
      const lastDate = new Date(latestCheckin.timestamp);
      const today = new Date();
      const diffDays = Math.floor(
        (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 1) {
        // 昨天打的卡 → 连续
        streakCount = latestCheckin.streakCount + 1;
      } else if (diffDays === 0) {
        // 今天已打过卡 → 保持原连续天数
        streakCount = latestCheckin.streakCount;
      }
      // diffDays > 1 → 断签，从 1 开始
    }

    const data: CreateCheckinInput = {
      openid,
      foodRecordId,
      locationName: options?.locationName ?? '',
      latitude: options?.latitude ?? 0,
      longitude: options?.longitude ?? 0,
      timestamp: nowISO(),
      streakCount,
    };

    const checkinId = await this.create(data);
    return { checkinId, streakCount };
  }

  /**
   * 获取用户最新的打卡记录
   *
   * @param openid - 用户 openid
   * @returns 最新打卡记录或 null
   */
  async getLatestByOpenId(
    openid: string,
  ): Promise<CheckinDoc | null> {
    try {
      const result = await this.collection
        .where({ openid })
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      const data = result.data as unknown as CheckinDoc[];
      const doc = data[0];
      return doc ?? null;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 获取用户打卡记录列表（分页）
   *
   * @param openid - 用户 openid
   * @param options - 查询选项
   * @returns 分页结果
   */
  async getByOpenId(
    openid: string,
    options: ListQueryOptions = {},
  ): Promise<PaginatedResult<CheckinDoc>> {
    return this.list({
      ...options,
      where: { openid },
      orderBy: options.orderBy ?? 'timestamp',
      orderDirection: options.orderDirection ?? 'desc',
    });
  }

  /**
   * 获取用户最近 N 条打卡记录（用于统计）
   *
   * @param openid - 用户 openid
   * @param limit - 限制条数
   * @returns 打卡记录列表
   */
  async getRecent(
    openid: string,
    limit: number = 30,
  ): Promise<CheckinDoc[]> {
    try {
      const result = await this.collection
        .where({ openid })
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return result.data as unknown as CheckinDoc[];
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 获取用户当前连续打卡天数
   *
   * @param openid - 用户 openid
   * @returns 当前连续打卡天数
   */
  async getCurrentStreak(openid: string): Promise<number> {
    const latest = await this.getLatestByOpenId(openid);
    if (latest === null) {
      return 0;
    }

    const today = new Date();
    const lastDate = new Date(latest.timestamp);

    // 计算最后打卡距今天数
    const todayStr = today.toISOString().slice(0, 10);
    const lastStr = lastDate.toISOString().slice(0, 10);

    if (lastStr === todayStr) {
      // 今天打过卡
      return latest.streakCount;
    }

    // 检查昨天是否打过卡
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (lastStr === yesterdayStr) {
      return latest.streakCount;
    }

    // 断签
    return 0;
  }

  /**
   * 统计用户今日打卡次数
   *
   * @param openid - 用户 openid
   * @returns 今日打卡次数
   */
  async countToday(openid: string): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;

    return this.count({
      openid,
      timestamp: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });
  }
}

/** 全局单例 */
export const checkinDAL = new CheckinDAL();
