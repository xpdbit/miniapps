/**
 * ============================================================
 * 成就定义集合 (achievements) 数据访问层
 * ============================================================
 *
 * achievements 为系统预置数据（静态配置），
 * 由管理员通过 db_init 云函数或后台导入。
 */

import { BaseDAL } from './BaseDAL';
import type {
  AchievementDoc,
  CreateAchievementInput,
  UpdateAchievementInput,
} from './schema';

// ============================================================
// AchievementDAL
// ============================================================
export class AchievementDAL extends BaseDAL<AchievementDoc> {
  protected collectionName = 'achievements' as const;

  /**
   * 获取所有成就定义
   *
   * @returns 所有成就列表
   */
  async getAllAchievements(): Promise<AchievementDoc[]> {
    try {
      const result = await this.collection
        .orderBy('achievementId', 'asc')
        .get();

      return result.data as unknown as AchievementDoc[];
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 根据 achievementId 获取成就定义
   *
   * @param achievementId - 成就逻辑 ID
   * @returns 成就定义或 null
   */
  async getByAchievementId(
    achievementId: string,
  ): Promise<AchievementDoc | null> {
    try {
      const result = await this.collection
        .where({ achievementId })
        .limit(1)
        .get();

      const data = result.data as unknown as AchievementDoc[];
      const doc = data[0];
      return doc ?? null;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 获取关联某个主题的成就
   *
   * @param themeId - 主题 ID
   * @returns 成就列表
   */
  async getByThemeId(themeId: string): Promise<AchievementDoc[]> {
    try {
      const result = await this.collection
        .where({ themeId })
        .orderBy('achievementId', 'asc')
        .get();

      return result.data as unknown as AchievementDoc[];
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 创建成就定义（管理员用）
   *
   * @param data - 成就数据
   * @returns 新成就 ID
   */
  async createAchievement(
    data: CreateAchievementInput,
  ): Promise<string> {
    return this.create(data);
  }

  /**
   * 更新成就定义（管理员用）
   *
   * @param docId - 文档 _id
   * @param data - 需要更新的字段
   */
  async updateAchievement(
    docId: string,
    data: UpdateAchievementInput,
  ): Promise<void> {
    return this.update(docId, data);
  }

  /**
   * 删除成就定义（管理员用）
   *
   * @param docId - 文档 _id
   */
  async deleteAchievement(docId: string): Promise<void> {
    return this.delete(docId);
  }
}

/** 全局单例 */
export const achievementDAL = new AchievementDAL();
