/**
 * API 与云函数相关类型定义
 */

/** 通用 API 响应 */
export interface ApiResponse<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 响应数据 */
  data: T;
  /** 错误码 (成功时为 0) */
  errCode: number;
  /** 错误信息 */
  errMsg: string;
  /** 请求耗时 (ms) */
  elapsed: number;
}

/** 云函数调用结果 */
export interface CloudFunctionResult<T = unknown> {
  /** 返回数据 */
  result: ApiResponse<T>;
  /** 云函数请求ID */
  requestId: string;
}

/** API Key 配置 */
export interface ApiKeyConfig {
  /** 服务名称 */
  serviceName: string;
  /** API 密钥 (加密存储) */
  apiKey: string;
  /** 是否启用 */
  isActive: boolean;
  /** 创建时间 */
  createdAt: string;
  /** 最后使用时间 */
  lastUsed: string;
}

/** 服务健康状态 */
export interface ServiceStatus {
  /** 服务名称 */
  serviceName: string;
  /** 是否可用 */
  available: boolean;
  /** 响应时间 (ms) */
  responseTime: number;
  /** 最后检查时间 */
  lastChecked: string;
  /** 错误信息 */
  error?: string;
}

/** 分页参数 */
export interface PaginationParams {
  /** 页码 (从1开始) */
  page: number;
  /** 每页数量 */
  pageSize: number;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  /** 数据列表 */
  list: T[];
  /** 总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有更多数据 */
  hasMore: boolean;
}
