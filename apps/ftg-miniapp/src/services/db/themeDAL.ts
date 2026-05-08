/**
 * ============================================================
 * 主题定义集合 (themes) 数据访问层
 * ============================================================
 *
 * themes 为系统预置数据，由管理员通过后台导入。
 * 客户端主要使用 getActive() 列出可选主题。
 */

import { BaseDAL } from './BaseDAL';
import type {
  ThemeDoc,
  CreateThemeInput,
  UpdateThemeInput,
} from './schema';

// ============================================================
// ThemeDAL
// ============================================================
export class ThemeDAL extends BaseDAL<ThemeDoc> {
  protected collectionName = 'themes' as const;

  /**
   * 获取所有主题
   *
   * @returns 所有主题列表（按 sortOrder 升序）
   */
  async getAllThemes(): Promise<ThemeDoc[]> {
    try {
      const result = await this.collection
        .orderBy('sortOrder', 'asc')
        .get();

      return result.data as unknown as ThemeDoc[];
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 获取所有启用的主题
   *
   * @returns 启用的主题列表（按 sortOrder 升序）
   */
  async getActive(): Promise<ThemeDoc[]> {
    try {
      const result = await this.collection
        .where({ isActive: true })
        .orderBy('sortOrder', 'asc')
        .get();

      return result.data as unknown as ThemeDoc[];
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 根据 themeId 获取主题
   *
   * @param themeId - 主题逻辑 ID
   * @returns 主题或 null
   */
  async getByThemeId(themeId: string): Promise<ThemeDoc | null> {
    try {
      const result = await this.collection
        .where({ themeId })
        .limit(1)
        .get();

      const data = result.data as unknown as ThemeDoc[];
      const doc = data[0];
      return doc ?? null;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 创建主题（管理员用）
   *
   * @param data - 主题数据
   * @returns 新主题 ID
   */
  async createTheme(data: CreateThemeInput): Promise<string> {
    return this.create(data);
  }

  /**
   * 更新主题（管理员用）
   *
   * @param docId - 文档 _id
   * @param data - 需要更新的字段
   */
  async updateTheme(
    docId: string,
    data: UpdateThemeInput,
  ): Promise<void> {
    return this.update(docId, data);
  }

  /**
   * 删除主题（管理员用）
   *
   * @param docId - 文档 _id
   */
  async deleteTheme(docId: string): Promise<void> {
    return this.delete(docId);
  }
}

/** 全局单例 */
export const themeDAL = new ThemeDAL();
