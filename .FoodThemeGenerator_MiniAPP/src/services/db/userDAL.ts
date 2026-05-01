/**
 * ============================================================
 * 用户集合 (users) 数据访问层
 * ============================================================
 *
 * users 集合使用 _id 直接存储微信 openid，
 * findOrCreate 是核心入口：首次使用自动创建用户档案。
 */

import { ErrorCode } from '@/constants/errorCodes';
import { BaseDAL, nowISO, DatabaseError } from './BaseDAL';
import type { UserDoc, CreateUserInput, UpdateUserInput } from './schema';

// ============================================================
// 用户统计更新参数
// ============================================================
export interface UserStatsUpdate {
  /** 记录数增量（可为负数） */
  totalRecordsDelta?: number;
  /** 打卡数增量（可为负数） */
  totalCheckinsDelta?: number;
}

// ============================================================
// UserDAL
// ============================================================
export class UserDAL extends BaseDAL<UserDoc> {
  protected collectionName = 'users' as const;

  /**
   * 查找或创建用户
   *
   * 首次登录时自动创建用户档案。
   *
   * @param openid - 微信 openid（同时作为 _id）
   * @param defaultData - 初始用户数据（可选）
   * @returns 用户文档
   */
  async findOrCreate(
    openid: string,
    defaultData?: Partial<CreateUserInput>,
  ): Promise<UserDoc> {
    const existing = await this.getById(openid);
    if (existing !== null) {
      return existing;
    }

    const now = nowISO();
    const newUser: CreateUserInput = {
      nickname: defaultData?.nickname ?? '微信用户',
      avatarUrl: defaultData?.avatarUrl ?? '',
      createdAt: defaultData?.createdAt ?? now,
      totalRecords: 0,
      totalCheckins: 0,
      themePreference: defaultData?.themePreference ?? '',
    };

    await this.create(newUser);

    // 返回刚创建的完整文档
    const created = await this.getById(openid);
    if (created === null) {
      throw new DatabaseError(
        ErrorCode.DB_OPERATION_FAILED,
        '创建用户后无法读取',
      );
    }
    return created;
  }

  /**
   * 更新用户基本资料
   *
   * @param openid - 用户 openid
   * @param data - 需要更新的字段
   */
  async updateProfile(
    openid: string,
    data: UpdateUserInput,
  ): Promise<void> {
    await this.update(openid, data);
  }

  /**
   * 原子递增用户统计字段
   *
   * 使用 CloudBase 的 db.command.inc 实现原子递增，
   * 避免并发操作导致的计数不一致。
   *
   * @param openid - 用户 openid
   * @param stats - 需要更新的统计字段
   */
  async updateStats(
    openid: string,
    stats: UserStatsUpdate,
  ): Promise<void> {
    const updateData: Record<string, unknown> = {};

    if (stats.totalRecordsDelta !== undefined) {
      updateData.totalRecords =
        this.db.command.inc(stats.totalRecordsDelta);
    }
    if (stats.totalCheckinsDelta !== undefined) {
      updateData.totalCheckins =
        this.db.command.inc(stats.totalCheckinsDelta);
    }

    if (Object.keys(updateData).length === 0) {
      return;
    }

    try {
      await this.collection.doc(openid).update({
        data: updateData as unknown as DB.IUpdateCondition,
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 更新用户主题偏好
   *
   * @param openid - 用户 openid
   * @param themeId - 主题 ID
   */
  async updateThemePreference(
    openid: string,
    themeId: string,
  ): Promise<void> {
    await this.update(openid, { themePreference: themeId });
  }
}

/** 全局单例 */
export const userDAL = new UserDAL();
