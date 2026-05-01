/**
 * ============================================================
 * 食物记录集合 (food_records) 数据访问层
 * ============================================================
 *
 * 提供食物记录的 CRUD 以及按用户、食物类型、时间范围等维度的查询。
 */

import type { PaginatedResult } from '@/types/api';
import type { FoodType } from '@/types/food';
import { BaseDAL } from './BaseDAL';
import type {
  FoodRecordDoc,
  CreateFoodRecordInput,
  UpdateFoodRecordInput,
} from './schema';
import type { ListQueryOptions } from './BaseDAL';

// ============================================================
// 食物记录查询选项
// ============================================================
export interface FoodRecordQueryOptions extends ListQueryOptions {
  /** 按食物类型过滤 */
  foodType?: FoodType;
  /** 开始时间（ISO 字符串） */
  startDate?: string;
  /** 结束时间（ISO 字符串） */
  endDate?: string;
}

// ============================================================
// FoodRecordDAL
// ============================================================
export class FoodRecordDAL extends BaseDAL<FoodRecordDoc> {
  protected collectionName = 'food_records' as const;

  /**
   * 创建食物记录
   *
   * @param data - 食物记录数据
   * @returns 新记录 ID
   */
  async createRecord(
    data: CreateFoodRecordInput,
  ): Promise<string> {
    return this.create(data);
  }

  /**
   * 获取用户的食物记录（分页）
   *
   * @param openid - 用户 openid
   * @param options - 查询选项
   * @returns 分页结果
   */
  async getByOpenId(
    openid: string,
    options: FoodRecordQueryOptions = {},
  ): Promise<PaginatedResult<FoodRecordDoc>> {
    const where: Record<string, unknown> = { openid };

    // 按食物类型过滤
    if (options.foodType !== undefined) {
      where.foodType = options.foodType;
    }

    // 按时间范围过滤
    if (options.startDate !== undefined || options.endDate !== undefined) {
      const timeCondition: Record<string, string> = {};
      if (options.startDate !== undefined) {
        timeCondition.$gte = options.startDate; // CloudBase 支持 $gte/$lte 语法
      }
      // CloudBase client SDK 使用 where 对象语法;
      // CloudBase 支持 MongoDB 风格的查询操作符
      if (options.endDate !== undefined) {
        timeCondition.$lte = options.endDate;
      }
      where.createdAt = timeCondition;
    }

    return this.list({
      ...options,
      where,
      orderBy: options.orderBy ?? 'createdAt',
      orderDirection: options.orderDirection ?? 'desc',
    });
  }

  /**
   * 按食物类型统计用户记录
   *
   * @param openid - 用户 openid
   * @returns 各类型的记录数 Map
   */
  async getTypeCounts(
    openid: string,
  ): Promise<Record<string, number>> {
    // CloudBase 客户端 SDK 暂不支持聚合 pipeline，
    // 此处返回空记录，云函数中可做完整聚合
    void openid;
    return {};
  }

  /**
   * 获取单条食物记录
   *
   * @param recordId - 记录 ID
   * @returns 食物记录或 null
   */
  async getRecordById(
    recordId: string,
  ): Promise<FoodRecordDoc | null> {
    return this.getById(recordId);
  }

  /**
   * 更新食物记录
   *
   * @param recordId - 记录 ID
   * @param data - 需要更新的字段
   */
  async updateRecord(
    recordId: string,
    data: UpdateFoodRecordInput,
  ): Promise<void> {
    return this.update(recordId, data);
  }

  /**
   * 删除食物记录
   *
   * @param recordId - 记录 ID
   */
  async deleteRecord(recordId: string): Promise<void> {
    return this.delete(recordId);
  }

  /**
   * 统计用户某天的记录数
   *
   * @param openid - 用户 openid
   * @param date - 日期（ISO 日期部分，如"2026-05-01"）
   * @returns 记录数
   */
  async countByDate(
    openid: string,
    date: string,
  ): Promise<number> {
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    return this.count({
      openid,
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });
  }
}

/** 全局单例 */
export const foodRecordDAL = new FoodRecordDAL();
