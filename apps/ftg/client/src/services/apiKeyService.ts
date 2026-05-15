/**
 * ============================================================
 * API Key 管理服务层
 * 封装 manageApiKey 云函数调用，提供类型安全接口
 * ============================================================
 */

import { CLOUD_FUNCTIONS } from '@/constants/apiEndpoints';
import type { ApiResponse } from '@/types/api';

// ============================================================
// 类型定义
// ============================================================

/** 服务状态信息 */
export interface ServiceStatusInfo {
  /** 是否可用 */
  available: boolean;
  /** 最后检查时间 (ISO 8601) */
  lastChecked: string;
}

/** Hunyuan Key 状态信息 */
export interface HunyuanKeyInfo {
  /** 是否存在 Key */
  hasKey: boolean;
  /** 脱敏后的 Key（如 sk-****abcd） */
  maskedKey: string | null;
  /** 最后使用时间 */
  lastUsed: string | null;
  /** 最后检查时间 */
  lastChecked: string;
}

/** getKeyStatus 返回结果 */
export interface KeyStatusResult {
  /** PP-ShiTuV2 食物识别服务状态 */
  ppshiTuStatus: ServiceStatusInfo;
  /** 混元AI Key 状态 */
  hunyuanStatus: HunyuanKeyInfo;
}

/** testConnection 返回结果 */
export interface TestConnectionResult {
  /** 是否连接成功 */
  success: boolean;
  /** 提示消息 */
  message: string;
}

/** saveKey 返回结果 */
export interface SaveKeyResult {
  /** 是否保存成功 */
  saved: boolean;
  /** 服务名称 */
  serviceName: string;
}

/** deleteKey 返回结果 */
export interface DeleteKeyResult {
  /** 是否删除成功 */
  deleted: boolean;
  /** 服务名称 */
  serviceName: string;
}

// ============================================================
// 云函数调用封装
// ============================================================

/** manageApiKey 云函数名称 */
const CLOUD_FN = CLOUD_FUNCTIONS.MANAGE_API_KEY;

/**
 * 通用云函数调用
 * @param action - 操作类型
 * @param data - 附加参数
 * @returns API 响应
 */
async function callManageApiKey<T>(
  action: string,
  data?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  // 云函数仅在微信小程序环境可用
  if (process.env.TARO_ENV !== 'weapp') {
    return { success: false, errMsg: 'CloudBase not available on H5' } as ApiResponse<T>;
  }
  const res = await wx.cloud.callFunction({
    name: CLOUD_FN,
    data: {
      action,
      ...(data ?? {}),
    },
  });

  return res.result as ApiResponse<T>;
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 获取服务状态和 API Key 信息
 * 查询 PP-ShiTuV2 食物识别服务可用状态，以及混元AI Key 绑定情况
 */
export async function getKeyStatus(): Promise<KeyStatusResult> {
  const response = await callManageApiKey<KeyStatusResult>('getKey');

  if (!response.success) {
    throw new Error(response.errMsg || '获取服务状态失败');
  }

  return response.data;
}

/**
 * 保存混元AI API Key
 * 加密后存储至云数据库
 *
 * @param apiKey - 用户输入的 API Key（明文）
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('API Key 不能为空');
  }

  const response = await callManageApiKey<SaveKeyResult>('saveKey', {
    apiKey: apiKey.trim(),
  });

  if (!response.success) {
    throw new Error(response.errMsg || '保存 API Key 失败');
  }
}

/**
 * 删除自定义混元AI API Key
 */
export async function deleteApiKey(): Promise<void> {
  const response = await callManageApiKey<DeleteKeyResult>('deleteKey');

  if (!response.success) {
    throw new Error(response.errMsg || '删除 API Key 失败');
  }
}

/**
 * 测试混元AI API Key 连接
 * 向混元 API 发送测试请求，验证 Key 的有效性
 *
 * @returns 连接结果
 */
export async function testConnection(): Promise<TestConnectionResult> {
  const response = await callManageApiKey<TestConnectionResult>('testConnection');

  if (!response.success) {
    return {
      success: false,
      message: response.errMsg || '连接测试请求失败',
    };
  }

  return response.data;
}
