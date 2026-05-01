/**
 * 统一错误码定义
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

/** 错误码对应消息 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.SUCCESS]: '操作成功',

  [ErrorCode.UNKNOWN]: '未知错误',
  [ErrorCode.INVALID_PARAMS]: '参数格式不正确',
  [ErrorCode.MISSING_REQUIRED]: '缺少必要参数',
  [ErrorCode.NOT_FOUND]: '请求的资源不存在',
  [ErrorCode.FORBIDDEN]: '没有操作权限',
  [ErrorCode.RATE_LIMITED]: '操作过于频繁，请稍后再试',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用',

  [ErrorCode.USER_NOT_LOGIN]: '请先登录',
  [ErrorCode.USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.USER_EXISTS]: '用户已存在',
  [ErrorCode.USER_BANNED]: '账号已被禁用',

  [ErrorCode.FOOD_RECOGNIZE_FAILED]: '食物识别失败',
  [ErrorCode.NO_FOOD_DETECTED]: '未识别到食物，请重新拍摄',
  [ErrorCode.IMAGE_QUALITY_LOW]: '图片质量较低，请重新拍摄',
  [ErrorCode.CONFIDENCE_TOO_LOW]: '识别结果不确定，建议重新拍摄',
  [ErrorCode.PPSHITU_SERVICE_DOWN]: '识别服务暂时不可用，请稍后再试',

  [ErrorCode.TEXT_GENERATE_FAILED]: 'AI文本生成失败',
  [ErrorCode.AI_SERVICE_TIMEOUT]: 'AI服务响应超时，请重试',
  [ErrorCode.INVALID_API_KEY]: 'API密钥无效',
  [ErrorCode.API_QUOTA_EXCEEDED]: 'API调用额度已用完',
  [ErrorCode.HUNYUAN_SERVICE_DOWN]: '混元AI服务暂时不可用',

  [ErrorCode.COMPOSE_FAILED]: '主题合成失败',
  [ErrorCode.THEME_NOT_FOUND]: '主题不存在',
  [ErrorCode.CANVAS_RENDER_FAILED]: '图片渲染失败',

  [ErrorCode.UPLOAD_FAILED]: '文件上传失败',
  [ErrorCode.FILE_NOT_FOUND]: '文件不存在',
  [ErrorCode.FILE_SIZE_EXCEEDED]: '文件大小超过限制',
  [ErrorCode.FILE_FORMAT_INVALID]: '文件格式不支持',

  [ErrorCode.DB_OPERATION_FAILED]: '数据库操作失败',
  [ErrorCode.DUPLICATE_ENTRY]: '数据已存在',
  [ErrorCode.VALIDATION_FAILED]: '数据验证失败',
};
