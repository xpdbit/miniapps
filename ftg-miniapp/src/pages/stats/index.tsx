import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { getUserStats } from '@/services/userService';
import type { UserStats } from '@/types/user';
import { foodRecordDAL } from '@/services/db/foodRecordDAL';
import type { FoodType } from '@/types/food';
import EmptyState from '@/components/EmptyState/index';
import Skeleton from '@/components/Skeleton/index';
import {
  FOOD_TYPE_LABELS,
  FOOD_TYPE_EMOJIS,
  FOOD_TYPE_COLORS,
} from '@/constants/foodTypes';
import Icon from '@/components/Icon/Icon';
import {
  LineChart,
  PieChart,
  BarChart,
  CalendarHeatmap,
} from '@/components/charts';
import type { LineChartData, PieChartData, BarChartData } from '@/components/charts';
import { getLastNDays, formatDate } from '@/components/charts/utils';
import './index.scss';

// ============================================================
// 类型定义（页面内部使用，不对外暴露）
// ============================================================

/** 每日热量汇总 */
interface DailyCalorie {
  date: string;
  total: number;
}

/** 食物排名项 */
interface FoodRankItem {
  foodName: string;
  count: number;
}

/** 打卡日历数据 */
interface CheckinDay {
  date: string;
  count: number;
}

/** 主题使用统计 */
interface ThemeUsage {
  themeId: string;
  count: number;
}

// ============================================================
// 页面组件
// ============================================================

export default function StatsPage() {
  // ============================================================
  // State
  // ============================================================
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [calorieDays, setCalorieDays] = useState<number>(7);
  const [calorieData, setCalorieData] = useState<DailyCalorie[]>([]);
  const [topFoods, setTopFoods] = useState<FoodRankItem[]>([]);
  const [checkinData, setCheckinData] = useState<CheckinDay[]>([]);
  const [themeUsage, setThemeUsage] = useState<ThemeUsage[]>([]);

  // ============================================================
  // 计算数据（供图表组件使用）
  // ============================================================

  /** 折线图：按选中天数切片并映射 */
  const calorieDisplayData = useMemo<LineChartData[]>(
    () =>
      calorieData.slice(30 - calorieDays).map((d) => ({
        date: d.date,
        value: d.total,
      })),
    [calorieData, calorieDays],
  );

  /** 饼图：从统计中提取类型分布数据 */
  const pieData = useMemo<PieChartData[]>(() => {
    const typeCounts = stats?.foodTypeCounts;
    if (typeCounts === undefined || typeCounts === null) return [];

    const entries = Object.entries(typeCounts) as Array<[string, number]>;
    return entries
      .map(([type, count]) => ({
        label: FOOD_TYPE_LABELS[type as FoodType] ?? type,
        value: count,
        color: FOOD_TYPE_COLORS[type as FoodType] ?? '#607D8B',
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  /** 条形图：映射食物排行数据 */
  const topFoodsData = useMemo<BarChartData[]>(
    () =>
      topFoods.map((d) => ({
        label: d.foodName,
        value: d.count,
      })),
    [topFoods],
  );

  /** 日历热力图日期范围（最近 12 周） */
  const calendarDates = useMemo<string[]>(() => getLastNDays(84), []);

  // ============================================================
  // 加载数据
  // ============================================================
  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      // 并行加载用户统计与图表数据
      const [userStatsData, _openid] = await Promise.all([
        getUserStats(),
        wx.cloud.callFunction({ name: 'getOpenId' }).then((res) => {
          const r = res.result as { openid: string };
          return r.openid;
        }),
      ]);

      setStats(userStatsData);

      // 加载热量数据（最近30天）
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString();
      const endDate = today.toISOString();

      const calorieResult = await foodRecordDAL.list({
        page: 1,
        pageSize: 100,
        where: {
          openid: _openid,
          isDeleted: false,
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
        orderBy: 'createdAt',
        orderDirection: 'asc',
      });

      // 按日期汇总热量
      const dailyMap = new Map<string, number>();
      for (const record of calorieResult.list) {
        const day = formatDate(new Date(record.createdAt));
        const existing = dailyMap.get(day) ?? 0;
        dailyMap.set(day, existing + record.calories.total);
      }

      // 填充完整日期序列
      const dates = getLastNDays(30);
      const filled: DailyCalorie[] = dates.map((date) => ({
        date,
        total: dailyMap.get(date) ?? 0,
      }));
      setCalorieData(filled);

      // 加载 Top 食物排行（最近200条）
      const foodResult = await foodRecordDAL.list({
        page: 1,
        pageSize: 200,
        where: {
          openid: _openid,
          isDeleted: false,
        },
        orderBy: 'createdAt',
        orderDirection: 'desc',
      });

      const foodCountMap = new Map<string, number>();
      for (const record of foodResult.list) {
        const existing = foodCountMap.get(record.foodName) ?? 0;
        foodCountMap.set(record.foodName, existing + 1);
      }
      const sorted = Array.from(foodCountMap.entries())
        .map(([foodName, count]) => ({ foodName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopFoods(sorted);

      // 加载主题使用
      const themeCountMap = new Map<string, number>();
      for (const record of foodResult.list) {
        if (record.themeId && record.themeId.length > 0) {
          const existing = themeCountMap.get(record.themeId) ?? 0;
          themeCountMap.set(record.themeId, existing + 1);
        }
      }
      const themeSorted = Array.from(themeCountMap.entries())
        .map(([themeId, count]) => ({ themeId, count }))
        .sort((a, b) => b.count - a.count);
      setThemeUsage(themeSorted);

      // 加载打卡数据（最近12周）
      const twelveWeeksAgo = new Date(today);
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
      const checkinStart = twelveWeeksAgo.toISOString();

      const checkinResult = await foodRecordDAL.list({
        page: 1,
        pageSize: 200,
        where: {
          openid: _openid,
          isDeleted: false,
          createdAt: {
            $gte: checkinStart,
            $lte: endDate,
          },
        },
        orderBy: 'createdAt',
        orderDirection: 'asc',
      });

      const checkinDayMap = new Map<string, number>();
      for (const record of checkinResult.list) {
        const day = formatDate(new Date(record.createdAt));
        const existing = checkinDayMap.get(day) ?? 0;
        checkinDayMap.set(day, existing + 1);
      }

      const checkinDays: CheckinDay[] = [];
      const checkinDates = getLastNDays(84);
      for (const date of checkinDates) {
        checkinDays.push({ date, count: checkinDayMap.get(date) ?? 0 });
      }
      setCheckinData(checkinDays);
    } catch {
      Taro.showToast({
        title: '加载统计数据失败',
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
  // 切换热量天数
  // ============================================================
  const handleCalorieDaysToggle = useCallback((days: number) => {
    setCalorieDays(days);
  }, []);

  // ============================================================
  // 去拍照
  // ============================================================
  const handleTakePhoto = useCallback(() => {
    Taro.navigateTo({ url: '/pages/camera/index' });
  }, []);

  // ============================================================
  // 获取概览卡片类名
  // ============================================================
  const overviewClass = (index: number): string => {
    const classes = [
      'stats-overview-value--primary',
      'stats-overview-value--secondary',
      'stats-overview-value--accent',
      'stats-overview-value',
    ];
    return classes[index] ?? 'stats-overview-value';
  };

  // ============================================================
  // 获取类型分布列表
  // ============================================================
  const typeDistributionList = useCallback((): Array<{
    label: string;
    count: number;
    color: string;
    percent: string;
  }> => {
    const typeCounts = stats?.foodTypeCounts;
    if (typeCounts === undefined || typeCounts === null) return [];

    const entries = Object.entries(typeCounts) as Array<[string, number]>;
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    if (total === 0) return [];

    return entries
      .map(([type, count]) => ({
        label: `${FOOD_TYPE_EMOJIS[type as FoodType] ?? '🍽️'} ${FOOD_TYPE_LABELS[type as FoodType] ?? type}`,
        count,
        color: FOOD_TYPE_COLORS[type as FoodType] ?? '#607D8B',
        percent: ((count / total) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  // ============================================================
  // 渲染
  // ============================================================

  // 加载中
  if (loading) {
    return (
      <View className='stats-page'>
        <Skeleton type='card' count={4} />
      </View>
    );
  }

  // 空状态（无记录时）
  if ((stats?.totalRecords ?? 0) === 0) {
    return (
      <View className='stats-page'>
        <EmptyState
          icon='📊'
          title='记录更多食物查看统计'
          description='拍照记录食物后，这里将展示你的饮食数据'
          action={{ label: '拍照记录', onClick: handleTakePhoto }}
        />
      </View>
    );
  }

  const overviewValues = [
    { label: '总记录数', value: stats?.totalRecords ?? 0 },
    { label: '打卡天数', value: stats?.totalCheckins ?? 0 },
    { label: '连续打卡', value: stats?.currentStreak ?? 0 },
    {
      label: '平均热量',
      value:
        stats?.totalCalories !== undefined && (stats?.totalRecords ?? 0) > 0
          ? Math.round(stats.totalCalories / (stats?.totalRecords ?? 1))
          : 0,
    },
  ];

  return (
    <View className='stats-page'>
      {/* ==================== 概览卡片 ==================== */}
      <View className='stats-overview'>
        {overviewValues.map((item, index) => (
          <View key={item.label} className='stats-overview-card'>
            <Text className={`stats-overview-value ${overviewClass(index)}`}>
              {item.value}
            </Text>
            <Text className='stats-overview-label'>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* ==================== 热量趋势折线图 ==================== */}
      <View className='stats-chart-card'>
        <View className='stats-chart-header'>
          <Text className='stats-chart-title'>热量趋势</Text>
          <View className='stats-chart-toggle'>
            <Text
              className={`stats-toggle-btn${
                calorieDays === 7 ? ' stats-toggle-btn--active' : ''
              }`}
              onClick={() => handleCalorieDaysToggle(7)}
            >
              7天
            </Text>
            <Text
              className={`stats-toggle-btn${
                calorieDays === 30 ? ' stats-toggle-btn--active' : ''
              }`}
              onClick={() => handleCalorieDaysToggle(30)}
            >
              30天
            </Text>
          </View>
        </View>
        <View className='stats-canvas-wrapper'>
          <LineChart
            data={calorieDisplayData}
            days={calorieDays}
            canvasId='calorieChart'
          />
        </View>
      </View>

      {/* ==================== 食物类型分布饼图 ==================== */}
      <View className='stats-chart-card'>
        <View className='stats-chart-header'>
          <Text className='stats-chart-title'>食物类型分布</Text>
        </View>
        <View className='stats-canvas-wrapper'>
          <PieChart
            data={pieData}
            canvasId='typeChart'
          />
        </View>
        <View className='stats-legend'>
          {typeDistributionList().map((item) => (
            <View key={item.label} className='stats-legend-item'>
              <View
                className='stats-legend-dot'
                style={{ backgroundColor: item.color }}
              />
              <Text>
                {item.label} ({item.percent}%)
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ==================== Top 食物排行条形图 ==================== */}
      {topFoods.length > 0 && (
        <View className='stats-chart-card'>
          <View className='stats-chart-header'>
            <Text className='stats-chart-title'>食物排行 TOP5</Text>
          </View>
          <View className='stats-canvas-wrapper'>
            <BarChart
              data={topFoodsData}
              canvasId='foodBarChart'
            />
          </View>
        </View>
      )}

      {/* ==================== 打卡日历热力图 ==================== */}
      <View className='stats-chart-card'>
        <View className='stats-chart-header'>
          <Text className='stats-chart-title'>打卡日历</Text>
        </View>
        <View className='stats-calendar'>
          <View className='stats-canvas-wrapper'>
            <CalendarHeatmap
              data={checkinData}
              dateRange={calendarDates}
              canvasId='checkinCalendar'
            />
          </View>
          <View className='stats-calendar-labels'>
            <Text>少</Text>
            <View className='stats-calendar-label-row'>
              <View className='stats-calendar-label-sample' style='background: #F5F5F5' />
              <View className='stats-calendar-label-sample' style='background: rgba(255,107,53,0.15)' />
              <View className='stats-calendar-label-sample' style='background: rgba(255,107,53,0.35)' />
              <View className='stats-calendar-label-sample' style='background: rgba(255,107,53,0.55)' />
              <View className='stats-calendar-label-sample' style='background: rgba(255,107,53,0.75)' />
              <View className='stats-calendar-label-sample' style='background: #FF6B35' />
            </View>
            <Text>多</Text>
          </View>
        </View>
      </View>

      {/* ==================== 主题使用统计 ==================== */}
      {themeUsage.length > 0 && (
        <View className='stats-chart-card'>
          <View className='stats-chart-header'>
            <Text className='stats-chart-title'>主题使用统计</Text>
          </View>
          <View className='stats-theme-list'>
            <View className='stats-rank-header'>
              <Text className='stats-rank-title'>主题</Text>
              <Text className='stats-rank-count'>使用次数</Text>
            </View>
            {themeUsage.map((item, index) => {
              const maxCount = themeUsage[0]?.count ?? 1;
              const barPercent = Math.max(4, (item.count / maxCount) * 100);
              return (
                <View key={item.themeId} className='stats-theme-item'>
                  <Text className='stats-theme-rank'>#{index + 1}</Text>
                  <Text className='stats-theme-name'>{item.themeId}</Text>
                  <View className='stats-theme-bar-bg'>
                    <View
                      className='stats-theme-bar'
                      style={{ width: `${barPercent}%` }}
                    />
                  </View>
                  <Text className='stats-theme-count'>{item.count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
