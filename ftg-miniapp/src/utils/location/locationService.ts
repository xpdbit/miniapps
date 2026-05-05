/**
 * ============================================================
 * 位置服务
 * 提供 IP 定位、GPS 定位、反向地理编码等功能
 * ============================================================
 *
 * 使用方式：
 * ```typescript
 * import { getLocationWithFallback, reverseGeocode } from '@/utils/location/locationService';
 *
 * const { geoPoint, source } = await getLocationWithFallback();
 * const address = await reverseGeocode(geoPoint.latitude, geoPoint.longitude);
 * ```
 */

import Taro from '@tarojs/taro';
import { CLOUD_FUNCTIONS } from '@/constants/apiEndpoints';
import type { IPLocationResult, GeoPoint, Location } from '@/types/location';
import type { ApiResponse } from '@/types/api';

// ============================================================
// 常量
// ============================================================

/** QQ Maps WebService API Key（构建环境注入，也可直接替换为你的 Key） */
const QQ_MAP_KEY: string = process.env.QQ_MAP_KEY || 'YOUR_QQ_MAP_KEY_HERE';

/** QQ Maps 反向地理编码接口地址 */
const QQ_MAP_REVERSE_GEOCODE_URL = 'https://apis.map.qq.com/ws/geocoder/v1';

/** 外部请求超时时间（毫秒） */
const REQUEST_TIMEOUT = 5000;

// ============================================================
// IP 定位
// ============================================================

/**
 * IP 定位
 *
 * 调用 getLocationByIP 云函数，根据请求来源 IP 获取
 * 省份、城市、运营商等信息。
 *
 * @returns IP 定位结果
 * @throws 云函数调用失败或返回失败时抛出错误
 */
export async function getIPLocation(): Promise<IPLocationResult> {
  try {
    const result = await Taro.cloud.callFunction({
      name: CLOUD_FUNCTIONS.GET_LOCATION_BY_IP,
    });

    const response = result.result as ApiResponse<IPLocationResult>;

    if (!response.success) {
      throw new Error(response.errMsg || 'IP 定位失败');
    }

    return response.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'IP 定位请求失败';
    console.error('[LocationService] getIPLocation 调用失败:', message);
    throw error;
  }
}

// ============================================================
// GPS 定位
// ============================================================

/**
 * GPS 定位
 *
 * 调用 Taro.getLocation 获取设备 GPS 经纬度。
 * 需要用户已授权 scope.userLocation。
 *
 * @returns 经纬度坐标（GCJ-02 坐标系）
 * @throws 权限被拒绝或定位失败时抛出错误
 */
export async function getGPSLocation(): Promise<GeoPoint> {
  try {
    const location = await Taro.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 3000,
    });

    return {
      latitude: location.latitude,
      longitude: location.longitude,
    };
  } catch (error) {
    const err = error as { errMsg?: string };

    if (err.errMsg?.includes('auth denied') || err.errMsg?.includes('deny')) {
      console.warn('[LocationService] GPS 定位权限被拒绝');
    } else {
      console.error('[LocationService] GPS 定位失败:', err.errMsg);
    }

    throw error;
  }
}

// ============================================================
// 带降级的定位
// ============================================================

/**
 * 带降级的定位
 *
 * 优先尝试 GPS 定位，失败后自动回退到 IP 定位。
 * IP 定位仅提供城市级别精度，不含经纬度。
 *
 * @returns 定位结果及数据来源
 * @throws 所有定位方式均失败时抛出错误
 */
export async function getLocationWithFallback(): Promise<{
  geoPoint: GeoPoint;
  source: 'gps' | 'ip';
  ipInfo?: IPLocationResult;
}> {
  // 尝试 GPS
  try {
    const geoPoint = await getGPSLocation();
    return { geoPoint, source: 'gps' };
  } catch {
    // GPS 失败，回退 IP
    try {
      const ipInfo = await getIPLocation();
      return {
        geoPoint: { latitude: 0, longitude: 0 },
        source: 'ip',
        ipInfo,
      };
    } catch {
      throw new Error('所有定位方式均失败，无法获取位置信息');
    }
  }
}

// ============================================================
// 位置权限管理
// ============================================================

/**
 * 请求位置权限
 *
 * 检查并申请 scope.userLocation 权限。
 * 若用户拒绝授权，弹窗引导前往系统设置页面开启。
 *
 * @returns 是否已获得位置权限
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    // 先检查当前授权状态
    const setting = await Taro.getSetting();

    if (setting.authSetting['scope.userLocation']) {
      return true;
    }

    // 尚未授权，发起授权请求
    try {
      await Taro.authorize({ scope: 'scope.userLocation' });
      return true;
    } catch {
      // 用户拒绝授权，引导到设置页
      const modalResult = await Taro.showModal({
        title: '需要位置权限',
        content: '打卡功能需要获取您的位置信息，请在设置中允许获取位置',
        cancelText: '暂不',
        confirmText: '去设置',
      });

      if (modalResult.confirm) {
        await Taro.openSetting();
        const updatedSetting = await Taro.getSetting();
        return Boolean(updatedSetting.authSetting['scope.userLocation']);
      }

      return false;
    }
  } catch (error) {
    console.error('[LocationService] 请求位置权限失败:', error);
    return false;
  }
}

// ============================================================
// 反向地理编码
// ============================================================

/**
 * QQ Maps 反向地理编码响应结构
 */
interface QQMapReverseGeocodeResponse {
  status: number;
  message: string;
  result?: {
    address: string;
    address_component: {
      province: string;
      city: string;
      district: string;
    };
  };
}

/**
 * 反向地理编码结果
 */
export interface ReverseGeocodeResult {
  /** 详细地址 */
  address: string;
  /** 省份 */
  province: string;
  /** 城市 */
  city: string;
  /** 区县 */
  district: string;
}

/**
 * 反向地理编码
 *
 * 根据经纬度调用 QQ Maps WebService API 获取地址信息。
 *
 * @param latitude - 纬度
 * @param longitude - 经度
 * @returns 地址信息（详细地址、省份、城市、区县）
 * @throws API 调用失败或返回异常时抛出错误
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> {
  if (latitude === 0 && longitude === 0) {
    throw new Error('无效的经纬度坐标，无法进行反向地理编码');
  }

  try {
    const response = await Taro.request({
      url: QQ_MAP_REVERSE_GEOCODE_URL,
      data: {
        location: `${latitude},${longitude}`,
        key: QQ_MAP_KEY,
        get_poi: 0,
        output: 'json',
      },
      timeout: REQUEST_TIMEOUT,
    });

    const data = response.data as QQMapReverseGeocodeResponse;

    if (data.status !== 0) {
      throw new Error(data.message || '反向地理编码请求失败');
    }

    const result = data.result;

    if (result === undefined || result === null) {
      throw new Error('反向地理编码无返回结果');
    }

    return {
      address: result.address,
      province: result.address_component.province,
      city: result.address_component.city,
      district: result.address_component.district,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '反向地理编码调用失败';
    console.error('[LocationService] reverseGeocode 失败:', message);
    throw error;
  }
}

// ============================================================
// 综合获取位置信息
// ============================================================

/**
 * 获取完整位置信息（含地址描述）
 *
 * 获取定位后自动反向地理编码，组装为 Location 类型。
 * 若 GPS 失败则回退 IP，IP 定位不调用反向地理编码。
 *
 * @returns 完整位置信息
 * @throws 所有方式均失败时抛出错误
 */
export async function getFullLocation(): Promise<Location> {
  const { geoPoint, source, ipInfo } = await getLocationWithFallback();

  if (source === 'gps') {
    const addr = await reverseGeocode(geoPoint.latitude, geoPoint.longitude);
    return {
      latitude: geoPoint.latitude,
      longitude: geoPoint.longitude,
      name: `${addr.province}${addr.city}${addr.district}`,
      address: addr.address,
      province: addr.province,
      city: addr.city,
      district: addr.district,
    };
  }

  // IP 定位结果
  return {
    latitude: 0,
    longitude: 0,
    name: ipInfo ? `${ipInfo.province}${ipInfo.city}` : '未知位置',
    address: ipInfo ? `${ipInfo.province}${ipInfo.city}` : '未知位置',
    province: ipInfo?.province ?? '',
    city: ipInfo?.city ?? '',
    district: '',
  };
}
