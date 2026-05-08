/**
 * API 相关类型定义
 */

/** 错误码枚举 */
export enum ErrorCode {
  /** 成功 */
  SUCCESS = 0,

  // 通用错误 1xxx
  /** 未知错误 */
  UNKNOWN = 1000,
  /** 参数错误 */
  INVALID_PARAMS = 1001,
  /** 缺少必要参数 */
  MISSING_REQUIRED = 1002,
  /** 资源不存在 */
  NOT_FOUND = 1003,
  /** 无权限 */
  FORBIDDEN = 1004,
  /** 操作过于频繁 */
  RATE_LIMITED = 1005,
  /** 服务不可用 */
  SERVICE_UNAVAILABLE = 1006,

  // 用户相关 2xxx
  /** 用户未登录 */
  USER_NOT_LOGIN = 2000,
  /** 用户不存在 */
  USER_NOT_FOUND = 2001,
  /** 用户已存在 */
  USER_EXISTS = 2002,
  /** 用户被封禁 */
  USER_BANNED = 2003,

  // 食物识别相关 3xxx
  /** 食物识别失败 */
  FOOD_RECOGNIZE_FAILED = 3000,
  /** 未识别到食物 */
  NO_FOOD_DETECTED = 3001,
  /** 图片质量过低 */
  IMAGE_QUALITY_LOW = 3002,
  /** 识别置信度过低 */
  CONFIDENCE_TOO_LOW = 3003,
  /** PP-ShiTuV2 服务不可用 */
  PPSHITU_SERVICE_DOWN = 3004,

  // AI 生成相关 4xxx
  /** AI 文本生成失败 */
  TEXT_GENERATE_FAILED = 4000,
  /** AI 服务超时 */
  AI_SERVICE_TIMEOUT = 4001,
  /** API Key 无效 */
  INVALID_API_KEY = 4002,
  /** API 额度不足 */
  API_QUOTA_EXCEEDED = 4003,
  /** 混元服务不可用 */
  HUNYUAN_SERVICE_DOWN = 4004,

  // 主题合成相关 5xxx
  /** 主题合成失败 */
  COMPOSE_FAILED = 5000,
  /** 主题不存在 */
  THEME_NOT_FOUND = 5001,
  /** Canvas 渲染失败 */
  CANVAS_RENDER_FAILED = 5002,

  // 存储相关 6xxx
  /** 文件上传失败 */
  UPLOAD_FAILED = 6000,
  /** 文件不存在 */
  FILE_NOT_FOUND = 6001,
  /** 文件大小超限 */
  FILE_SIZE_EXCEEDED = 6002,
  /** 文件格式不支持 */
  FILE_FORMAT_INVALID = 6003,

  // 数据库相关 7xxx
  /** 数据库操作失败 */
  DB_OPERATION_FAILED = 7000,
  /** 数据已存在 */
  DUPLICATE_ENTRY = 7001,
  /** 数据验证失败 */
  VALIDATION_FAILED = 7002,
}

/** 通用 API 响应 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  errCode: number;
  errMsg: string;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}
