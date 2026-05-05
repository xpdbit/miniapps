/**
 * 统一错误码定义
 */

import { ErrorCode } from '../types/api';

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

export { ErrorCode } from '../types/api';
