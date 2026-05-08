/**
 * 位置与打卡相关类型定义
 */

/** 地理坐标点 */
export interface GeoPoint {
  /** 纬度 */
  latitude: number;
  /** 经度 */
  longitude: number;
}

/** 位置信息 */
export interface Location {
  /** 纬度 */
  latitude: number;
  /** 经度 */
  longitude: number;
  /** 位置名称 (如 "北京市朝阳区") */
  name: string;
  /** 详细地址 */
  address: string;
  /** 省份 */
  province: string;
  /** 城市 */
  city: string;
  /** 区县 */
  district: string;
}

/** IP 定位结果 */
export interface IPLocationResult {
  /** IP 地址 */
  ip: string;
  /** 省份 */
  province: string;
  /** 城市 */
  city: string;
  /** ISP */
  isp: string;
}

/** 打卡记录 */
export interface CheckIn {
  /** 记录ID */
  _id: string;
  /** 用户 openid */
  openid: string;
  /** 关联的食物记录ID */
  foodRecordId: string;
  /** 位置名称 */
  locationName: string;
  /** 纬度 */
  latitude: number;
  /** 经度 */
  longitude: number;
  /** 打卡时间 */
  timestamp: string;
  /** 连续打卡天数 */
  streakCount: number;
}
