import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import { ACHIEVEMENTS_CONFIG } from '@/constants/achievements';
import { CLOUD_FUNCTIONS } from '@/constants/apiEndpoints';
import type { UserAchievement } from '@/types/achievement';
import type { ApiResponse } from '@/types/api';
import './index.scss';

/**
 * 成就ID → Emoji 图标映射
 * 实际生产环境使用云存储中的图标文件
 */
const ACHIEVEMENT_ICONS: Record<string, string> = {
  first_record: '🎯',
  ten_records: '🍜',
  fifty_records: '👨‍🍳',
  hundred_records: '👑',
  streak_3: '🔥',
  streak_7: '💪',
  streak_30: '⭐',
  meat_lover: '🥩',
  veggie_master: '🥬',
  fruit_fanatic: '🍎',
  theme_collector: '🎨',
  checkin_10: '📍',
};

/**
 * 成就页面
 * 展示所有成就及其解锁状态
 */
export default function AchievementsPage() {
  // ============================================================
  // State
  // ============================================================
  const [loading, setLoading] = useState<boolean>(true);
  const [progressMap, setProgressMap] = useState<Record<string, UserAchievement>>({});

  // ============================================================
  // 计算统计数据
  // ============================================================
  const totalCount = ACHIEVEMENTS_CONFIG.length;

  const unlockedCount = useMemo(() => {
    return Object.values(progressMap).filter((ua) => ua.isUnlocked).length;
  }, [progressMap]);

  const unlockedPercentage = useMemo(() => {
    if (totalCount === 0) return 0;
    return (unlockedCount / totalCount) * 100;
  }, [unlockedCount, totalCount]);

  // ============================================================
  // 加载成就进度
  // ============================================================
  const loadProgress = useCallback(async () => {
    try {
      const res = await wx.cloud.callFunction({
        name: CLOUD_FUNCTIONS.CHECK_ACHIEVEMENT,
        data: { action: 'query' },
      });

      const result = res.result as ApiResponse<{
        achievements: UserAchievement[];
      }>;

      if (result.success && result.data?.achievements) {
        const map: Record<string, UserAchievement> = {};
        for (const ua of result.data.achievements) {
          map[ua.achievementId] = ua;
        }
        setProgressMap(map);
      }
    } catch {
      console.warn('[AchievementsPage] 加载成就进度失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // ============================================================
  // 获取单个成就进度
  // ============================================================
  const getAchievementProgress = (
    achievementId: string,
    _targetValue: number
  ): { current: number; isUnlocked: boolean } => {
    const ua = progressMap[achievementId];
    if (!ua) {
      return { current: 0, isUnlocked: false };
    }
    return {
      current: ua.progress,
      isUnlocked: ua.isUnlocked,
    };
  };

  // ============================================================
  // 加载状态
  // ============================================================
  if (loading) {
    return (
      <View className='achievements-loading'>
        <Text className='achievements-loading-text'>加载成就中...</Text>
      </View>
    );
  }

  // ============================================================
  // 无配置
  // ============================================================
  if (ACHIEVEMENTS_CONFIG.length === 0) {
    return (
      <View className='achievements-empty'>
        <Text className='achievements-empty-icon'>🏆</Text>
        <Text className='achievements-empty-text'>暂无成就配置</Text>
      </View>
    );
  }

  // ============================================================
  // 主渲染
  // ============================================================
  return (
    <View className='achievements-page'>
      {/* ==================== 头部总览 ==================== */}
      <View className='achievements-header'>
        <Text className='achievements-header-count'>
          {unlockedCount}/{totalCount}
        </Text>
        <Text className='achievements-header-label'>已解锁成就</Text>
        <View className='achievements-header-progress'>
          <View className='achievements-header-progress-bar'>
            <View
              className='achievements-header-progress-fill'
              style={{ width: `${unlockedPercentage}%` }}
            />
          </View>
        </View>
      </View>

      {/* ==================== 成就网格 ==================== */}
      <View className='achievements-grid'>
        {ACHIEVEMENTS_CONFIG.map((achievement) => {
          const { current, isUnlocked } = getAchievementProgress(
            achievement.achievementId,
            achievement.unlockCondition.value
          );
          const target = achievement.unlockCondition.value;
          const percentage = Math.min((current / target) * 100, 100);
          const iconEmoji =
            ACHIEVEMENT_ICONS[achievement.achievementId] ?? '🏆';

          return (
            <View
              key={achievement.achievementId}
              className={`achievement-card ${
                isUnlocked
                  ? 'achievement-card--unlocked'
                  : 'achievement-card--locked'
              }`}
            >
              {/* 已解锁标记 */}
              {isUnlocked && (
                <Text className='achievement-badge'>✅</Text>
              )}

              {/* 图标 */}
              <View
                className={`achievement-icon-wrapper ${
                  isUnlocked
                    ? 'achievement-icon-wrapper--unlocked'
                    : 'achievement-icon-wrapper--locked'
                }`}
              >
                <Text className='achievement-icon-placeholder'>
                  {iconEmoji}
                </Text>
              </View>

              {/* 名称 */}
              <Text
                className={`achievement-name ${
                  isUnlocked ? '' : 'achievement-name--locked'
                }`}
              >
                {achievement.name}
              </Text>

              {/* 描述 */}
              <Text className='achievement-desc'>
                {achievement.description}
              </Text>

              {/* 进度条 */}
              <View className='achievement-progress'>
                <Text className='achievement-progress-text'>
                  {isUnlocked ? '已解锁' : `${current}/${target}`}
                </Text>
                <View className='achievement-progress-bar'>
                  <View
                    className={`achievement-progress-fill ${
                      isUnlocked
                        ? 'achievement-progress-fill--unlocked'
                        : 'achievement-progress-fill--locked'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
