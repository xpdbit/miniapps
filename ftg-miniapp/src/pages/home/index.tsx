import { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { FoodRecord } from '@/types';
import { FOOD_TYPE_EMOJIS, FOOD_TYPE_LABELS } from '@/constants';
import { checkinDAL, foodRecordDAL } from '@/services/db';
import Loading from '@/components/Loading';
import EmptyState from '@/components/EmptyState/index';
import Skeleton from '@/components/Skeleton/index';
import Icon from '@/components/Icon/Icon';
import './index.scss';

/**
 * 首页
 * 展示今日打卡状态、拍照入口、最近食物记录
 */
export default function HomePage() {
  // ============================================================
  // State
  // ============================================================
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [checkedIn, setCheckedIn] = useState<boolean>(false);
  const [streakCount, setStreakCount] = useState<number>(0);
  const [recentRecords, setRecentRecords] = useState<FoodRecord[]>([]);

  // ============================================================
  // 数据加载
  // ============================================================
  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      // 获取 openid
      const { result } = await wx.cloud.callFunction({ name: 'getOpenId' });
      const openid = (result as { openid: string }).openid;

      // 今日打卡状态
      const todayCount = await checkinDAL.countToday(openid);
      setCheckedIn(todayCount > 0);

      // 连续打卡天数
      const streak = await checkinDAL.getCurrentStreak(openid);
      setStreakCount(streak);

      // 最近 3 条食物记录
      const recent = await foodRecordDAL.getByOpenId(openid, {
        page: 1,
        pageSize: 3,
      });
      setRecentRecords(recent.list);
    } catch {
      // 静默失败，展示空状态
      setCheckedIn(false);
      setStreakCount(0);
      setRecentRecords([]);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============================================================
  // 导航
  // ============================================================
  const handleTakePhoto = useCallback(() => {
    Taro.navigateTo({ url: '/pages/camera/index' }).catch(() => {
      Taro.showToast({
        title: '拍照页面开发中',
        icon: 'none',
        duration: 2000,
      });
    });
  }, []);

  const handleViewAll = useCallback(() => {
    Taro.navigateTo({ url: '/pages/history/index' }).catch(() => {
      Taro.showToast({
        title: '历史记录页面开发中',
        icon: 'none',
        duration: 2000,
      });
    });
  }, []);

  // ============================================================
  // 格式化
  // ============================================================
  const formatTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${month}-${day} ${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  // ============================================================
  // 渲染打卡卡片
  // ============================================================
  const renderCheckinCard = (): React.ReactNode => (
    <View className='home-checkin-card'>
      <View className='checkin-left'>
          <View className={`checkin-icon ${checkedIn ? 'checkin-icon--done' : ''}`}>
            <Icon name={checkedIn ? 'checkin-done' : 'checkin'} size={40} color={checkedIn ? '#2EC4B6' : '#999999'} />
          </View>
        <View className='checkin-text'>
          <Text className='checkin-status'>
            {checkedIn ? '今日已打卡' : '今日未打卡'}
          </Text>
          {streakCount > 0 && (
            <Text className='checkin-sub'>
              已连续打卡 {streakCount} 天
            </Text>
          )}
        </View>
      </View>
      {streakCount > 0 && (
        <View className='checkin-streak-badge'>
          <Icon name='flame' size={36} color='#FF6B35' />
          <Text className='streak-count'>{streakCount}</Text>
        </View>
      )}
    </View>
  );

  // ============================================================
  // 渲染拍照入口
  // ============================================================
  const renderHeroCTA = (): React.ReactNode => (
    <View className='home-hero'>
      <Button className='home-hero-btn' onClick={handleTakePhoto}>
          <Icon name='camera' size={64} color='#FFFFFF' />
          <Text className='hero-btn-text'>拍照记录</Text>
        <Text className='hero-btn-sub'>拍照识别食物，AI 生成专属主题</Text>
      </Button>
    </View>
  );

  // ============================================================
  // 渲染记录卡片
  // ============================================================
  const renderRecordCard = (record: FoodRecord): React.ReactNode => {
    const typeEmoji = FOOD_TYPE_EMOJIS[record.foodType] ?? '🍽️';
    const typeLabel = FOOD_TYPE_LABELS[record.foodType] ?? '未知';

    return (
      <View key={record._id} className='home-record-card'>
        <Image
          className='record-thumb'
          src={record.themeImageFileID || record.imageFileID}
          mode='aspectFill'
          lazyLoad
        />
        <View className='record-info'>
          <View className='record-top'>
            <Text className='record-name'>
              {record.foodName}
            </Text>
            <View className='record-calories'>
              <Icon name='flame' size={20} color='#E63946' />
              <Text> {record.calories.total}</Text>
            </View>
          </View>
          <View className='record-bottom'>
            <Text className='record-type'>
              {typeEmoji} {typeLabel}
            </Text>
            <Text className='record-time'>
              {formatTime(record.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // ============================================================
  // 渲染最近记录
  // ============================================================
  const renderRecentRecords = (): React.ReactNode => (
    <View className='home-section'>
      <View className='home-section-header'>
        <Text className='home-section-title'>最近记录</Text>
        <Text className='home-section-link' onClick={handleViewAll}>
          查看全部 ›
        </Text>
      </View>

      {dataLoading ? (
        <Skeleton type='card' count={3} />
      ) : recentRecords.length === 0 ? (
        <EmptyState
          icon={<Icon name='food' size={64} color='#CCCCCC' />}
          title='还没有记录'
          description='快去拍照记录你的美食吧'
          action={{ label: '去拍照', onClick: handleTakePhoto }}
        />
      ) : (
        <View className='home-record-list'>
          {recentRecords.map(renderRecordCard)}
        </View>
      )}
    </View>
  );

  // ============================================================
  // 主渲染
  // ============================================================
  return (
    <ScrollView className='home-page' scrollY enhanced showScrollbar={false}>
      <View className='home-content'>
        {dataLoading ? (
          <Loading visible text='加载中...' />
        ) : (
          <>
            {renderCheckinCard()}
            {renderHeroCTA()}
            {renderRecentRecords()}
          </>
        )}
      </View>
    </ScrollView>
  );
}
