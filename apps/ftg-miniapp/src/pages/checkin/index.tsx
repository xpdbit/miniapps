/**
 * ============================================================
 * 打卡页面
 * ============================================================
 *
 * 展示当前定位，提供"在此打卡"功能。
 * 打卡成功后展示连续打卡天数。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Map, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import {
  requestLocationPermission,
  getGPSLocation,
  reverseGeocode,
  getIPLocation,
} from '@/utils/location/locationService';
import type { Location, IPLocationResult } from '@/types/location';
import './index.scss';

// ============================================================
// 页面状态枚举
// ============================================================

/** 定位阶段 */
type LocationPhase = 'loading' | 'located' | 'error';

/** 页面全局阶段 */
type CheckinPhase = 'locating' | 'ready' | 'checking-in' | 'success';

// ============================================================
// 组件
// ============================================================

export default function CheckinPage() {
  // ============================================================
  // State
  // ============================================================
  const [phase, setPhase] = useState<CheckinPhase>('locating');
  const [locationPhase, setLocationPhase] = useState<LocationPhase>('loading');
  const [location, setLocation] = useState<Location | null>(null);
  const [ipInfo, setIpInfo] = useState<IPLocationResult | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [streakCount, setStreakCount] = useState<number>(0);

  /** 地图上下文，用于移动标记 */
  const mapContextRef = useRef<Taro.MapContext | null>(null);

  // ============================================================
  // 定位逻辑
  // ============================================================

  /**
   * 执行定位流程：权限检查 → GPS → IP 回退
   */
  const performLocation = useCallback(async (): Promise<void> => {
    setPhase('locating');
    setLocationPhase('loading');
    setLocationError('');

    try {
      // 请求权限
      const hasPermission = await requestLocationPermission();

      if (hasPermission) {
        // 有 GPS 权限，获取 GPS 定位 + 反地理编码
        try {
          const geoPoint = await getGPSLocation();

          // 反向地理编码获取地址
          const addr = await reverseGeocode(geoPoint.latitude, geoPoint.longitude);

          setLocation({
            latitude: geoPoint.latitude,
            longitude: geoPoint.longitude,
            name: `${addr.province}${addr.city}${addr.district}`,
            address: addr.address,
            province: addr.province,
            city: addr.city,
            district: addr.district,
          });

          setLocationPhase('located');
          setPhase('ready');
          return;
        } catch {
          // GPS 失败，尝试 IP 回退
          console.warn('[CheckinPage] GPS 定位失败，回退到 IP 定位');
        }
      }

      // 无 GPS 权限或 GPS 失败：IP 定位
      const ipLocation = await getIPLocation();
      setIpInfo(ipLocation);
      setLocation({
        latitude: 0,
        longitude: 0,
        name: `${ipLocation.province}${ipLocation.city}`,
        address: `${ipLocation.province}${ipLocation.city}`,
        province: ipLocation.province,
        city: ipLocation.city,
        district: '',
      });

      setLocationPhase('located');
      setPhase('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取位置信息失败';
      setLocationError(message);
      setLocationPhase('error');
      setPhase('ready');
    }
  }, []);

  // 页面加载时执行定位
  useEffect(() => {
    performLocation();
  }, [performLocation]);

  // ============================================================
  // 打卡逻辑
  // ============================================================

  /**
   * 执行打卡
   */
  const handleCheckin = useCallback(async (): Promise<void> => {
    if (phase !== 'ready') {
      return;
    }

    setPhase('checking-in');

    try {
      // 打卡成功后获取连续天数
      // 实际场景中应调用云函数或 DAL 创建打卡记录，
      // 此处模拟返回连续天数（后端对接后替换）
      const newStreak = await simulateCheckin(location, ipInfo);

      setStreakCount(newStreak);
      setPhase('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '打卡失败';
      Taro.showToast({
        title: message,
        icon: 'none',
        duration: 2000,
      });
      setPhase('ready');
    }
  }, [phase, location, ipInfo]);

  // ============================================================
  // 成功动画后处理
  // ============================================================

  /**
   * 打卡成功后关闭弹窗并返回
   */
  const handleSuccessConfirm = useCallback((): void => {
    Taro.showToast({
      title: `打卡成功！已连续 ${streakCount} 天`,
      icon: 'success',
      duration: 2000,
    });
    // 返回上一页
    setTimeout(() => {
      Taro.navigateBack();
    }, 500);
  }, [streakCount]);

  // ============================================================
  // 辅助渲染
  // ============================================================

  /** 定位来源描述 */
  const locationSourceText = (): string => {
    if (location === null) return '';
    if (location.latitude !== 0 && location.longitude !== 0) {
      return 'GPS 定位';
    }
    return `IP 定位 · ${ipInfo?.isp ?? ''}`;
  };

  /** 标记点（仅在 GPS 定位时） */
  const mapMarkers = (): Array<{
    id: number;
    latitude: number;
    longitude: number;
    title: string;
    iconPath: string;
    width: number;
    height: number;
  }> => {
    if (location === null || (location.latitude === 0 && location.longitude === 0)) {
      return [];
    }
    return [
      {
        id: 1,
        latitude: location.latitude,
        longitude: location.longitude,
        title: location.name,
        iconPath: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxOCIgZmlsbD0iI0ZGNkIzNSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSI0Ii8+PHBhdGggZD0iTTIwIDI4Yy00LjQgMCA4LTEyIDgtMTJzLTMuNi04LTgtOC04IDMuNi04IDggOCAxMiA4IDEyeiIgZmlsbD0id2hpdGUiLz48Y2lyY2xlIGN4PSIyMCIgY3k9IjE2IiByPSI0IiBmaWxsPSIjRkY2QjM1Ii8+PC9zdmc+',
        width: 40,
        height: 40,
      },
    ];
  };

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <View className='checkin-page'>
      {/* ==================== 地图区域 ==================== */}
      <View className='checkin-map-wrapper'>
        {locationPhase === 'loading' && (
          <View className='checkin-map-overlay'>
            <View className='checkin-map-overlay-icon'>📍</View>
            <Text>正在获取位置...</Text>
          </View>
        )}

        {locationPhase === 'error' && (
          <View className='checkin-map-overlay'>
            <View className='checkin-map-overlay-icon'>⚠️</View>
            <Text>位置获取失败</Text>
            <Text className='checkin-error-retry' onClick={performLocation}>
              重新获取
            </Text>
          </View>
        )}

        {/* 地图组件：仅在定位完成后渲染以避免空数据 */}
        {locationPhase === 'located' && (
          <Map
            className='checkin-map'
            latitude={location?.latitude ?? 39.9042}
            longitude={location?.longitude ?? 116.4074}
            scale={15}
            markers={mapMarkers()}
            showLocation={location?.latitude !== 0}
            onUpdated={() => {
              // 地图首次渲染完成后初始化地图上下文
              try {
                const ctx = Taro.createMapContext('checkin-map');
                mapContextRef.current = ctx;
              } catch {
                console.warn('[CheckinPage] 地图上下文创建失败（非关键错误）');
              }
            }}
            onError={() => {
              console.warn('[CheckinPage] 地图渲染出错');
            }}
          />
        )}
      </View>

      {/* ==================== 内容区域 ==================== */}
      {phase === 'locating' && (
        <View className='checkin-loading'>
          <View className='checkin-loading-spinner' />
          <Text>正在获取位置信息...</Text>
        </View>
      )}

      <View className='checkin-info'>
        {/* 位置卡片 */}
        {location !== null && (
          <View className='checkin-location-card'>
            <View className='checkin-location-icon'>📍</View>
            <View className='checkin-location-content'>
              <Text className='checkin-location-name'>
                {location.name || '未知位置'}
              </Text>
              <Text className='checkin-location-address'>
                {location.address || location.name || '暂无地址信息'}
              </Text>
              <Text className='checkin-location-source'>
                {locationSourceText()}
              </Text>
            </View>
          </View>
        )}

        {/* 错误状态 */}
        {locationPhase === 'error' && (
          <View className='checkin-error'>
            <View className='checkin-error-icon'>⚠️</View>
            <Text className='checkin-error-text'>{locationError}</Text>
            <Button className='checkin-error-retry' onClick={performLocation}>
              重新获取位置
            </Button>
          </View>
        )}
      </View>

      {/* ==================== 打卡按钮 ==================== */}
      <View className='checkin-btn-area'>
        <View
          className={`checkin-btn${
            phase !== 'ready' ? ' checkin-btn--disabled' : ''
          }${phase === 'checking-in' ? ' checkin-btn--loading' : ''}`}
          onClick={handleCheckin}
        >
          {phase === 'checking-in' ? '打卡中...' : '在此打卡'}
        </View>
      </View>

      {/* ==================== 打卡成功弹窗 ==================== */}
      {phase === 'success' && (
        <View className='checkin-success-overlay'>
          <View className='checkin-success-card'>
            <View className='checkin-success-icon'>✓</View>
            <Text className='checkin-success-title'>打卡成功</Text>

            <View className='checkin-success-streak'>
              <Text className='checkin-success-streak-count'>{streakCount}</Text>
              <Text className='checkin-success-streak-label'>天</Text>
            </View>

            <Text className='checkin-success-streak-days'>
              连续打卡
            </Text>

            <View
              className='checkin-success-btn'
              onClick={handleSuccessConfirm}
            >
              太棒了！
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================================
// 模拟打卡（占位，后续对接后端）
// ============================================================

/**
 * 模拟创建打卡记录
 *
 * TODO: 对接后端 CheckinDAL.createCheckin 真实接口
 *
 * @param _location - 当前位置
 * @param _ipInfo - IP 定位信息
 * @returns 连续打卡天数
 */
async function simulateCheckin(
  _location: Location | null,
  _ipInfo: IPLocationResult | null,
): Promise<number> {
  // TODO: 实际调用后端云函数 / CheckinDAL 创建打卡记录
  // 此处返回模拟数据，后端对接后替换
  return Math.floor(Math.random() * 7) + 1;
}
