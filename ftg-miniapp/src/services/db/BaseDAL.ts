/**
 * ============================================================
 * 数据访问层基类 (BaseDAL)
 * 封装 CloudBase 数据库通用 CRUD 逻辑
 * ============================================================
 *
 * 所有集合 DAL 均继承此类，获得一致的 create / getById / list / update / delete 能力。
 */

import { ErrorCode, ERROR_MESSAGES } from '@/constants/errorCodes';
import type { PaginatedResult } from '@/types/api';
import type { Nullable } from '@/types/common';

// ============================================================
// 自定义数据库错误
// ============================================================
export class DatabaseError extends Error {
  /** 统一错误码 */
  public readonly errCode: ErrorCode;

  constructor(errCode: ErrorCode, message?: string) {
    super(message || ERROR_MESSAGES[errCode]);
    this.name = 'DatabaseError';
    this.errCode = errCode;
  }
}

// ============================================================
// 列表查询选项
// ============================================================
export interface ListQueryOptions {
  /** 页码（从 1 开始，默认 1） */
  page?: number;
  /** 每页数量（默认 20，最大 100） */
  pageSize?: number;
  /** 排序字段 */
  orderBy?: string;
  /** 排序方向 */
  orderDirection?: 'asc' | 'desc';
  /** 查询条件 */
  where?: Record<string, unknown>;
}

// ============================================================
// 工具函数
// ============================================================
/** 获取当前时间的 ISO 字符串 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * 检查云数据库是否可用
 * 在非微信环境或 CloudBase 未初始化时返回 false
 */
export function isCloudAvailable(): boolean {
  try {
    return (
      typeof wx !== 'undefined' &&
      wx.cloud !== undefined &&
      wx.cloud.database !== undefined
    );
  } catch {
    return false;
  }
}

// ============================================================
// CloudBase SDK 边界类型
// 只在此文件中使用，不对外暴露 any
// ============================================================
interface CloudBaseQueryResult<T> {
  data: T[];
  errMsg: string;
}

interface CloudBaseSingleResult<T> {
  data: T;
  errMsg: string;
}

interface CloudBaseAddResult {
  _id: string | number;
  errMsg: string;
}

interface CloudBaseCountResult {
  total: number;
  errMsg: string;
}

// ============================================================
// Base DAL 泛型基类
// ============================================================
/**
 * 数据访问层基类
 *
 * @template T - 文档类型，必须包含 _id: string
 */
export abstract class BaseDAL<T extends { _id: string }> {
  /** 子类必须返回集合名称 */
  protected abstract get collectionName(): string;

  /** CloudBase 数据库实例（懒初始化） */
  private _db: DB.Database | null = null;

  /** 获取数据库实例 */
  protected get db(): DB.Database {
    if (this._db === null) {
      this._db = wx.cloud.database();
    }
    return this._db;
  }

  /** 获取集合引用 */
  protected get collection(): DB.CollectionReference {
    return this.db.collection(this.collectionName);
  }

  // ==========================================================
  // 错误处理
  // ==========================================================

  /**
   * 统一错误处理
   * 将 CloudBase SDK 错误转换为 DatabaseError
   */
  protected handleError(error: unknown): never {
    const errObj = error as { errMsg?: string; errCode?: number };
    const errMsg = errObj.errMsg ?? 'Unknown database error';
    const errCode = errObj.errCode;

    // 根据错误信息推断错误码
    if (errMsg.includes('not found') || errMsg.includes('NOT_FOUND')) {
      throw new DatabaseError(ErrorCode.NOT_FOUND, errMsg);
    }
    if (errMsg.includes('permission') || errMsg.includes('FORBIDDEN')) {
      throw new DatabaseError(ErrorCode.FORBIDDEN, errMsg);
    }
    if (
      errMsg.includes('duplicate') ||
      errCode === 11000 ||
      errCode === -502003
    ) {
      throw new DatabaseError(ErrorCode.DUPLICATE_ENTRY, errMsg);
    }
    if (errMsg.includes('limit') || errCode === -502005) {
      throw new DatabaseError(ErrorCode.RATE_LIMITED, errMsg);
    }
    if (errMsg.includes('validation') || errCode === -502004) {
      throw new DatabaseError(ErrorCode.VALIDATION_FAILED, errMsg);
    }

    throw new DatabaseError(ErrorCode.DB_OPERATION_FAILED, errMsg);
  }

  // ==========================================================
  // CRUD 基础方法
  // ==========================================================

  /**
   * 创建文档
   * @param data - 不包含 _id 的文档数据
   * @returns 新文档的 _id
   */
  async create(data: Omit<T, '_id'>): Promise<string> {
    try {
      const result: CloudBaseAddResult = (await this.collection.add({
        data: data as unknown as DB.IDocumentData,
      })) as unknown as CloudBaseAddResult;
      return String(result._id);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 根据 _id 获取文档
   * @param id - 文档 _id
   * @returns 文档或 null（未找到时）
   */
  async getById(id: string): Promise<Nullable<T>> {
    try {
      const result: CloudBaseSingleResult<T> =
        (await this.collection.doc(id).get()) as unknown as CloudBaseSingleResult<T>;
      return result.data;
    } catch (error) {
      const errObj = error as { errMsg?: string };
      if (
        errObj.errMsg?.includes('not found') ||
        errObj.errMsg?.includes('NOT_FOUND')
      ) {
        return null;
      }
      return this.handleError(error);
    }
  }

  /**
   * 分页查询文档列表
   * @param options - 查询选项（分页、排序、过滤）
   * @returns 分页结果
   */
  async list(options: ListQueryOptions = {}): Promise<PaginatedResult<T>> {
    try {
      const {
        page = 1,
        pageSize = 20,
        orderBy,
        orderDirection = 'desc',
        where,
      } = options;

      // 限制分页参数
      const safePage = Math.max(1, page);
      const safePageSize = Math.min(100, Math.max(1, pageSize));

      // 构建查询链
      let query: DB.Query = this.collection;

      if (where !== undefined && Object.keys(where).length > 0) {
        query = query.where(where);
      }

      if (orderBy !== undefined && orderBy.length > 0) {
        query = query.orderBy(orderBy, orderDirection);
      }

      // 获取总数
      const countResult: CloudBaseCountResult =
        (await query.count()) as unknown as CloudBaseCountResult;
      const total = countResult.total;

      // 获取分页数据
      const skip = (safePage - 1) * safePageSize;
      const dataResult: CloudBaseQueryResult<T> =
        (await query
          .skip(skip)
          .limit(safePageSize)
          .get()) as unknown as CloudBaseQueryResult<T>;

      return {
        list: dataResult.data,
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.ceil(total / safePageSize),
        hasMore: skip + safePageSize < total,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 更新文档（部分更新）
   * @param id - 文档 _id
   * @param data - 需要更新的字段（不含 _id）
   */
  async update(id: string, data: Partial<Omit<T, '_id'>>): Promise<void> {
    try {
      await this.collection.doc(id).update({
        data: data as unknown as DB.IUpdateCondition,
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 删除文档
   * @param id - 文档 _id
   */
  async delete(id: string): Promise<void> {
    try {
      await this.collection.doc(id).remove();
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 按条件统计文档数量
   * @param where - 查询条件
   * @returns 符合条件的文档数
   */
  async count(where?: Record<string, unknown>): Promise<number> {
    try {
      let query: DB.Query = this.collection;

      if (where !== undefined && Object.keys(where).length > 0) {
        query = query.where(where);
      }

      const result: CloudBaseCountResult =
        (await query.count()) as unknown as CloudBaseCountResult;
      return result.total;
    } catch (error) {
      return this.handleError(error);
    }
  }
}
