/**
 * IP定位服务
 *
 * 使用 ip-api.com 免费接口进行 IP 地理位置查询。
 *
 * ⚠️ 注意：IP 定位数据基于 IP 归属地数据库，精度有限，
 * 不可作为精确地理位置的权威依据。
 */
import type { Request } from 'express';
import httpClient from '../lib/http-client';
import { isAxiosError } from 'axios';
import logger from '../utils/logger';

// ============================================================
// 类型定义
// ============================================================

/** IP 定位结果 */
export interface IpLocation {
  /** 城市 */
  city: string;
  /** 省份 / 州 */
  province: string;
  /** 区 / 县 */
  district: string;
}

/** ip-api.com 响应结构 */
interface IpApiResponse {
  status: 'success' | 'fail';
  country: string;
  regionName: string;
  city: string;
  district: string;
  query: string;
}

// ============================================================
// 常量
// ============================================================

const IP_API_BASE = 'http://ip-api.com/json';
const REQUEST_TIMEOUT = 5000; // 5s

// ============================================================
// 公开函数
// ============================================================

/**
 * 根据 IP 地址获取地理位置信息
 *
 * 调用 ip-api.com 免费接口，每天限制约 45 次/分钟。
 * 返回城市、省份、区县三级信息，空字段表示不可用。
 *
 * @param ip - 客户端 IP 地址
 * @returns 定位结果
 * @throws 当 IP 无效或 API 请求失败时抛出错误
 */
export async function getLocationByIP(ip: string): Promise<IpLocation> {
  // 处理 IPv6 映射的 IPv4 地址 (::ffff:xxx.xxx.xxx.xxx)
  const cleanIP = ip.replace(/^::ffff:/, '').trim();

  if (!cleanIP || cleanIP === 'unknown' || cleanIP === '127.0.0.1' || cleanIP === '::1') {
    throw new Error('无效的 IP 地址');
  }

  try {
    const response = await httpClient.get<IpApiResponse>(`${IP_API_BASE}/${cleanIP}`, {
      params: { fields: 'status,country,regionName,city,district,query' },
      timeout: REQUEST_TIMEOUT,
    });

    if (response.data.status !== 'success') {
      logger.warn('IP 定位接口返回失败', { ip: cleanIP, response: response.data });
      throw new Error('IP 定位失败');
    }

    return {
      city: response.data.city || '',
      province: response.data.regionName || '',
      district: response.data.district || '',
    };
  } catch (error) {
    if (isAxiosError(error)) {
      logger.warn('IP 定位请求异常', {
        ip: cleanIP,
        status: error.response?.status,
        message: error.message,
      });
    }
    throw error;
  }
}

/**
 * 从 Express 请求中提取客户端真实 IP
 *
 * 提取优先级：
 * 1. X-Forwarded-For 请求头 → 取第一个 IP（反向代理场景）
 * 2. X-Real-IP 请求头（Nginx 常用）
 * 3. req.ip（Express 解析的直连 IP）
 * 4. req.socket.remoteAddress
 *
 * @param req - Express 请求对象
 * @returns 客户端 IP 地址
 */
export function getClientIP(req: Request): string {
  // 1. 检查 X-Forwarded-For（逗号分隔的代理链，首个为客户端真实 IP）
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return forwarded[0].split(',')[0].trim();
  }

  // 2. 检查 X-Real-IP（Nginx 常用）
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // 3. 回退到 Express 直连 IP
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
