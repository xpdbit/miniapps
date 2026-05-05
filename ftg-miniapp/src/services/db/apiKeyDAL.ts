/**
 * ============================================================
 * API 密钥集合 (api_keys) 数据访问层
 * ============================================================
 *
 * 存储用户绑定的第三方 API 密钥（加密后存储）。
 * 每个用户每项服务最多一条记录。
 */

import { BaseDAL, nowISO } from './BaseDAL';
import type { ApiKeyDoc, CreateApiKeyInput, UpdateApiKeyInput } from './schema';

// ============================================================
// ApiKeyDAL
// ============================================================
export class ApiKeyDAL extends BaseDAL<ApiKeyDoc> {
  protected collectionName = 'api_keys' as const;

  /**
   * 获取用户的所有 API 密钥
   *
   * @param openid - 用户 openid
   * @returns API 密钥列表
   */
  async getByOpenId(openid: string): Promise<ApiKeyDoc[]> {
    try {
      const result = await this.collection
        .where({ openid })
        .orderBy('createdAt', 'desc')
        .get();

      return result.data as unknown as ApiKeyDoc[];
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 获取用户指定服务的 API 密钥
   *
   * @param openid - 用户 openid
   * @param serviceName - 服务名称（如 hunyuan、ppshitu）
   * @returns API 密钥或 null
   */
  async getByService(
    openid: string,
    serviceName: string,
  ): Promise<ApiKeyDoc | null> {
    try {
      const result = await this.collection
        .where({ openid, serviceName })
        .limit(1)
        .get();

      const data = result.data as unknown as ApiKeyDoc[];
      const doc = data[0];
      return doc ?? null;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 创建或更新 API 密钥
   *
   * 若该用户的服务密钥已存在则更新，否则新建。
   *
   * @param openid - 用户 openid
   * @param serviceName - 服务名称
   * @param apiKey - API 密钥（应已加密）
   * @returns 文档 ID
   */
  async upsertKey(
    openid: string,
    serviceName: string,
    apiKey: string,
  ): Promise<string> {
    const existing = await this.getByService(openid, serviceName);

    if (existing !== null) {
      // 更新现有密钥
      await this.update(existing._id, {
        apiKey,
        lastUsed: nowISO(),
      });

      return existing._id;
    }

    // 创建新密钥
    const data: CreateApiKeyInput = {
      openid,
      serviceName,
      apiKey,
      isActive: true,
      createdAt: nowISO(),
      lastUsed: nowISO(),
    };

    return this.create(data);
  }

  /**
   * 更新密钥最后使用时间
   *
   * @param openid - 用户 openid
   * @param serviceName - 服务名称
   */
  async updateLastUsed(
    openid: string,
    serviceName: string,
  ): Promise<void> {
    const existing = await this.getByService(openid, serviceName);
    if (existing === null) {
      return;
    }

    await this.update(existing._id, { lastUsed: nowISO() });
  }

  /**
   * 启用/禁用 API 密钥
   *
   * @param openid - 用户 openid
   * @param serviceName - 服务名称
   * @param isActive - 是否启用
   */
  async setActive(
    openid: string,
    serviceName: string,
    isActive: boolean,
  ): Promise<void> {
    const existing = await this.getByService(openid, serviceName);
    if (existing === null) {
      return;
    }

    await this.update(existing._id, { isActive } as UpdateApiKeyInput);
  }

  /**
   * 删除 API 密钥
   *
   * @param openid - 用户 openid
   * @param serviceName - 服务名称
   */
  async deleteKey(
    openid: string,
    serviceName: string,
  ): Promise<void> {
    const existing = await this.getByService(openid, serviceName);
    if (existing === null) {
      return;
    }

    await this.delete(existing._id);
  }
}

/** 全局单例 */
export const apiKeyDAL = new ApiKeyDAL();
