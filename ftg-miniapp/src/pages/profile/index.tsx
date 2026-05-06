import { useState, useEffect, useCallback } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { getUserProfile, getUserStats } from '@/services/userService';
import type { UserProfile, UserStats } from '@/types/user';
import { FoodType } from '@/types/food';
import { FOOD_TYPE_EMOJIS, FOOD_TYPE_LABELS } from '@/constants/foodTypes';
import './index.scss';

/**
 * 个人主页
 * 展示用户信息卡片、统计数据、功能入口列表
 */
export default function ProfilePage() {
  // 页面显示时通知自定义底部栏切换选中状态
  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 2);
  });

  // ============================================================
  // State
  // ============================================================
  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);

  // ============================================================
  // 数据加载
  // ============================================================
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileData, statsData] = await Promise.all([
        getUserProfile(),
        getUserStats(),
      ]);
      setProfile(profileData);
      setStats(statsData);
    } catch {
      Taro.showToast({
        title: '获取用户信息失败',
        icon: 'none',
        duration: 2000,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============================================================
  // 计算最爱食物
  // ============================================================
  const getFavoriteFood = (): string => {
    if (
      stats === null ||
      stats.foodTypeCounts === undefined ||
      stats.foodTypeCounts === null
    ) {
      return '🍽️';
    }

    const entries = Object.entries(stats.foodTypeCounts) as Array<
      [string, number]
    >;
    if (entries.length === 0) {
      return '🍽️';
    }

    // 按数量降序排序，取最常吃的食物类型
    const sorted = [...entries].sort(([, countA], [, countB]) => countB - countA);
    const topFoodType = sorted[0]?.[0] ?? '';

    if (topFoodType.length === 0) {
      return '🍽️';
    }

    // 尝试用 emoji 展示，没有 emoji 则显示名称
    const emoji = FOOD_TYPE_EMOJIS[topFoodType as FoodType];
    if (emoji !== undefined) {
      return emoji;
    }

    const label = FOOD_TYPE_LABELS[topFoodType as FoodType];
    return label ?? '🍽️';
  };

  // ============================================================
  // 功能入口列表
  // ============================================================
  interface MenuItem {
    icon: string;
    iconClass: string;
    title: string;
    subtitle: string;
    action: () => void;
  }

  const menuItems: MenuItem[] = [
    {
      icon: '📝',
      iconClass: 'profile-menu-icon--record',
      title: '我的记录',
      subtitle: '查看所有食物识别记录',
      action: () => {
        Taro.navigateTo({ url: '/pages/history/index' }).catch(() => {
          Taro.showToast({
            title: '记录页面开发中',
            icon: 'none',
            duration: 2000,
          });
        });
      },
    },
    {
      icon: '📍',
      iconClass: 'profile-menu-icon--checkin',
      title: '我的打卡',
      subtitle: '查看美食打卡足迹',
      action: () => {
        Taro.navigateTo({ url: '/pages/checkin/index' }).catch(() => {
          Taro.showToast({
            title: '打卡页面开发中',
            icon: 'none',
            duration: 2000,
          });
        });
      },
    },
    {
      icon: '🏆',
      iconClass: 'profile-menu-icon--achievement',
      title: '我的成就',
      subtitle: '查看已解锁的成就',
      action: () => {
        Taro.navigateTo({ url: '/pages/achievements/index' }).catch(() => {
          Taro.showToast({
            title: '成就页面开发中',
            icon: 'none',
            duration: 2000,
          });
        });
      },
    },
    {
      icon: '⚙️',
      iconClass: 'profile-menu-icon--setting',
      title: '设置',
      subtitle: 'AI 服务配置与偏好',
      action: () => {
        Taro.navigateTo({ url: '../settings/index' });
      },
    },
    {
      icon: 'ℹ️',
      iconClass: 'profile-menu-icon--about',
      title: '关于',
      subtitle: '应用信息与版本',
      action: () => {
        Taro.showModal({
          title: '关于',
          content:
            '食物主题生成器\n通过 AI 识别食物并生成个性化主题图片。\n当前版本：1.0.0',
          showCancel: false,
          confirmText: '知道了',
        });
      },
    },
  ];

  // ============================================================
  // 加载状态
  // ============================================================
  if (loading) {
    return (
      <View className='profile-loading'>
        <Text className='profile-loading-text'>加载中...</Text>
      </View>
    );
  }

  // ============================================================
  // 主渲染
  // ============================================================
  return (
    <View className='profile-page'>
      {/* ==================== 用户信息卡片 ==================== */}
      <View className='profile-card'>
        <View className='profile-avatar'>
          {profile?.avatarUrl && profile.avatarUrl.length > 0 ? (
            <Image
              className='profile-avatar-image'
              src={profile.avatarUrl}
              mode='aspectFill'
            />
          ) : (
            <Text className='profile-avatar-placeholder'>👤</Text>
          )}
        </View>
        <Text className='profile-nickname'>美食探索者</Text>
        {profile?.nickname && profile.nickname.length > 0 && (
          <Text className='profile-wechat-name'>
            {profile.nickname}
          </Text>
        )}
      </View>

      {/* ==================== 统计栅格 ==================== */}
      <View className='profile-stats'>
        <View className='profile-stat-item'>
          <Text className='profile-stat-value'>
            {profile?.totalRecords ?? 0}
          </Text>
          <Text className='profile-stat-label'>总记录数</Text>
        </View>
        <View className='profile-stat-item'>
          <Text className='profile-stat-value'>
            {stats?.totalCheckins ?? 0}
          </Text>
          <Text className='profile-stat-label'>打卡天数</Text>
        </View>
        <View className='profile-stat-item'>
          <Text className='profile-stat-value'>
            {profile?.unlockedAchievements ?? 0}
          </Text>
          <Text className='profile-stat-label'>解锁成就</Text>
        </View>
        <View className='profile-stat-item'>
          <Text className='profile-stat-value'>
            {getFavoriteFood()}
          </Text>
          <Text className='profile-stat-label'>最爱食物</Text>
        </View>
      </View>

      {/* ==================== 功能入口列表 ==================== */}
      <View className='profile-menu-section'>
        <View className='profile-menu-card'>
          {menuItems.map((item, index) => (
            <View
              key={String(index)}
              className='profile-menu-item'
              onClick={item.action}
            >
              <View className='profile-menu-left'>
                <View className={`profile-menu-icon ${item.iconClass}`}>
                  <Text>{item.icon}</Text>
                </View>
                <View className='profile-menu-text'>
                  <Text className='profile-menu-title'>{item.title}</Text>
                  <Text className='profile-menu-sub'>{item.subtitle}</Text>
                </View>
              </View>
              <Text className='profile-menu-arrow'>›</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
