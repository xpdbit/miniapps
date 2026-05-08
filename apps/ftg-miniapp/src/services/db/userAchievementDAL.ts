/**
 * ============================================================
 * 用户成就关联集合 (user_achievements) 数据访问层
 * ============================================================
 *
 * 记录每个用户的成就解锁状态和进度。
 */

import { BaseDAL, nowISO } from './BaseDAL';
import type {
  UserAchievementDoc,
  CreateUserAchievementInput,
  UpdateUserAchievementInput,
} from './schema';

// ============================================================
// 用户成就进度更新参数
// ============================================================
export interface AchievementProgressUpdate {
  /** 当前进度值 */
  progress: number;
  /** 是否已解锁 */
  isUnlocked: boolean;
}

// ============================================================
// UserAchievementDAL
// ============================================================
export class UserAchievementDAL extends BaseDAL<UserAchievementDoc> {
  protected collectionName = 'user_achievements' as const;

  /**
   * 获取用户所有成就记录
   *
   * @param openid - 用户 openid
   * @returns 用户成就列表
   */
  async getByOpenId(
    openid: string,
  ): Promise<UserAchievementDoc[]> {
    try {
      const result = await this.collection
        .where({ openid })
        .orderBy('achievementId', 'asc')
        .get();

      return result.data as unknown as UserAchievementDoc[];
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 获取用户已解锁的成就
   *
   * @param openid - 用户 openid
   * @returns 已解锁成就列表
   */
  async getUnlockedByOpenId(
    openid: string,
  ): Promise<UserAchievementDoc[]> {
    try {
      const result = await this.collection
        .where({ openid, isUnlocked: true })
        .orderBy('unlockedAt', 'desc')
        .get();

      return result.data as unknown as UserAchievementDoc[];
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 获取用户特定成就的记录
   *
   * @param openid - 用户 openid
   * @param achievementId - 成就 ID
   * @returns 用户成就记录或 null
   */
  async getByOpenIdAndAchievementId(
    openid: string,
    achievementId: string,
  ): Promise<UserAchievementDoc | null> {
    try {
      const result = await this.collection
        .where({ openid, achievementId })
        .limit(1)
        .get();

      const data = result.data as unknown as UserAchievementDoc[];
      const doc = data[0];
      return doc ?? null;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 创建或更新用户成就进度
   *
   * 若该用户成就记录已存在则更新进度，
   * 否则创建新记录。
   *
   * @param openid - 用户 openid
   * @param achievementId - 成就 ID
   * @param progress - 当前进度值
   * @param isUnlocked - 是否已解锁
   * @returns 用户成就记录
   */
  async upsertProgress(
    openid: string,
    achievementId: string,
    progress: number,
    isUnlocked: boolean,
  ): Promise<UserAchievementDoc> {
    const existing = await this.getByOpenIdAndAchievementId(
      openid,
      achievementId,
    );

    if (existing !== null) {
      // 更新现有记录
      const updateData: UpdateUserAchievementInput = {
        progress,
        isUnlocked,
      };

      if (isUnlocked && !existing.isUnlocked) {
        // 首次解锁，记录解锁时间
        updateData.unlockedAt = nowISO();
      }

      await this.update(existing._id, updateData);

      // 返回更新后的记录
      const updated = await this.getById(existing._id);
      if (updated === null) {
        throw new Error(
          `更新用户成就后无法读取: ${openid}/${achievementId}`,
        );
      }
      return updated;
    }

    // 创建新记录
    const now = nowISO();
    const data: CreateUserAchievementInput = {
      openid,
      achievementId,
      unlockedAt: isUnlocked ? now : '',
      progress,
      isUnlocked,
    };

    const newId = await this.create(data);

    // 返回新创建的记录
    const created = await this.getById(newId);
    if (created === null) {
      throw new Error(
        `创建用户成就后无法读取: ${openid}/${achievementId}`,
      );
    }
    return created;
  }

  /**
   * 批量获取用户的成就状态
   *
   * @param openid - 用户 openid
   * @param achievementIds - 要查询的成就 ID 列表
   * @returns 成就状态 Map（achievementId -> isUnlocked）
   */
  async getUnlockedStatusMap(
    openid: string,
    achievementIds: string[],
  ): Promise<Map<string, boolean>> {
    const statusMap = new Map<string, boolean>();

    try {
      const result = await this.collection
        .where({
          openid,
          achievementId: this.db.command.in(achievementIds),
        })
        .get();

      const data = result.data as unknown as UserAchievementDoc[];

      // 初始化所有成就为未解锁
      for (const id of achievementIds) {
        statusMap.set(id, false);
      }

      // 标记已解锁的成就
      for (const doc of data) {
        statusMap.set(doc.achievementId, doc.isUnlocked);
      }
    } catch (error) {
      return this.handleError(error);
    }

    return statusMap;
  }

  /**
   * 统计用户已解锁的成就数
   *
   * @param openid - 用户 openid
   * @returns 已解锁成就数
   */
  async countUnlocked(openid: string): Promise<number> {
    return this.count({ openid, isUnlocked: true });
  }
}

/** 全局单例 */
export const userAchievementDAL = new UserAchievementDAL();
