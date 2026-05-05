import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Button, Canvas } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { getUserStats } from '@/services/userService';
import type { UserStats } from '@/types/user';
import { foodRecordDAL } from '@/services/db/foodRecordDAL';
import type { FoodType } from '@/types/food';
import {
  FOOD_TYPE_LABELS,
  FOOD_TYPE_EMOJIS,
  FOOD_TYPE_COLORS,
} from '@/constants/foodTypes';
import './index.scss';

// ============================================================
// 类型定义
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

/** 图表绘制尺寸 */
interface ChartSize {
  width: number;
  height: number;
}

// ============================================================
// 常量
// ============================================================

/** 将颜色 hex 转 rgba 字符串 */
function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  let r: number, g: number, b: number;

  if (cleaned.length === 3) {
    const c0 = cleaned[0] ?? '0';
    const c1 = cleaned[1] ?? '0';
    const c2 = cleaned[2] ?? '0';
    r = parseInt(c0 + c0, 16);
    g = parseInt(c1 + c1, 16);
    b = parseInt(c2 + c2, 16);
  } else {
    r = parseInt(cleaned.substring(0, 2) || '0', 16);
    g = parseInt(cleaned.substring(2, 4) || '0', 16);
    b = parseInt(cleaned.substring(4, 6) || '0', 16);
  }

  return `rgba(${r},${g},${b},${alpha})`;
}

/** 格式化 YYYY-MM-DD */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 获取过去 N 天的日期列表 */
function getLastNDays(n: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(formatDate(d));
  }
  return dates;
}

// ============================================================
// Canvas 绘图工具函数
// ============================================================

/** 初始化 Canvas 2D */
async function initCanvas(
  canvasId: string,
): Promise<{ ctx: CanvasRenderingContext2D; size: ChartSize } | null> {
  try {
    const sysInfo = Taro.getSystemInfoSync();
    const dpr = sysInfo.pixelRatio;

    interface CanvasNodeResult {
      node: HTMLCanvasElement;
      width: number;
      height: number;
    }

    const res = await new Promise<CanvasNodeResult>(
      (resolve, reject) => {
        Taro.createSelectorQuery()
          .select(`#${canvasId}`)
          .fields({ node: true, size: true })
          .exec((queryRes) => {
            const first = queryRes[0] as CanvasNodeResult | undefined;
            if (first !== undefined && first !== null) {
              resolve(first);
            } else {
              reject(new Error('Canvas node not found'));
            }
          });
      },
    );

    const canvas = res.node;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return null;

    const width = res.width;
    const height = res.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    return { ctx, size: { width, height } };
  } catch {
    return null;
  }
}

// ============================================================
// 图表绘制
// ============================================================

/** 绘制折线图（热量趋势） */
function drawLineChart(
  ctx: CanvasRenderingContext2D,
  size: ChartSize,
  data: DailyCalorie[],
  days: number,
): void {
  const { width, height } = size;
  const padding = { top: 20, right: 16, bottom: 32, left: 48 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // 清空
  ctx.clearRect(0, 0, width, height);

  if (data.length === 0) return;

  // 计算 Y 轴范围
  const maxVal = Math.max(...data.map((d) => d.total), 100);
  const yMax = Math.ceil(maxVal / 200) * 200;

  // 绘制网格线
  ctx.strokeStyle = '#F0F0F0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    // Y 轴标签
    const label = Math.round(yMax - (yMax / 4) * i);
    ctx.fillStyle = '#999999';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(label), padding.left - 6, y + 3);
  }

  // 绘制折线
  const stepX = days > 1 ? chartW / (days - 1) : chartW;

  // 渐变填充
  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
  gradient.addColorStop(0, hexToRgba('#FF6B35', 0.2));
  gradient.addColorStop(1, hexToRgba('#FF6B35', 0.01));

  // 线路径
  ctx.beginPath();
  data.forEach((point, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - (point.total / yMax) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  // 填充渐变色（从最后一个点向下）
  const lastX = padding.left + (data.length - 1) * stepX;
  const bottomY = padding.top + chartH;
  ctx.lineTo(lastX, bottomY);
  ctx.lineTo(padding.left, bottomY);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // 绘制线条
  ctx.beginPath();
  data.forEach((point, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - (point.total / yMax) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#FF6B35';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 绘制数据点
  data.forEach((point, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - (point.total / yMax) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#FF6B35';
    ctx.fill();
  });

  // X 轴标签（取首尾和中间几个）
  const labelInterval = Math.max(1, Math.floor(days / 6));
  ctx.fillStyle = '#999999';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  data.forEach((point, i) => {
    if (i % labelInterval === 0 || i === data.length - 1) {
      const x = padding.left + i * stepX;
      const dateStr = point.date.substring(5);
      ctx.fillText(dateStr, x, height - 6);
    }
  });
}

/** 绘制饼图/环形图（食物类型分布） */
function drawPieChart(
  ctx: CanvasRenderingContext2D,
  size: ChartSize,
  data: Array<{ label: string; value: number; color: string }>,
): void {
  const { width, height } = size;
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = Math.min(width, height) / 2 - 20;
  const innerRadius = outerRadius * 0.55;

  ctx.clearRect(0, 0, width, height);

  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return;

  let startAngle = -Math.PI / 2;

  data.forEach((item) => {
    const sliceAngle = (item.value / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(centerX + innerRadius * Math.cos(startAngle), centerY + innerRadius * Math.sin(startAngle));
    ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
    ctx.lineTo(centerX + innerRadius * Math.cos(endAngle), centerY + innerRadius * Math.sin(endAngle));
    ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();

    startAngle = endAngle;
  });
}

/** 绘制横向条形图（Top 食物排行） */
function drawBarChart(
  ctx: CanvasRenderingContext2D,
  size: ChartSize,
  data: FoodRankItem[],
): void {
  const { width, height } = size;
  const padding = { top: 12, right: 16, bottom: 12, left: 80 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  ctx.clearRect(0, 0, width, height);

  if (data.length === 0) return;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const barHeight = Math.min(32, (chartH - (data.length - 1) * 8) / data.length);

  data.forEach((item, i) => {
    const y = padding.top + i * (barHeight + 8);
    const barW = (item.count / maxCount) * chartW;

    // 食物名称
    ctx.fillStyle = '#1A1A1A';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      item.foodName.length > 6 ? item.foodName.substring(0, 6) + '…' : item.foodName,
      padding.left - 8,
      y + barHeight / 2 + 4,
    );

    // 条形
    const gradient = ctx.createLinearGradient(padding.left, 0, padding.left + barW, 0);
    gradient.addColorStop(0, '#FF8C5A');
    gradient.addColorStop(1, '#FF6B35');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(padding.left, y, barW, barHeight, 4);
    ctx.fill();

    // 数值
    ctx.fillStyle = '#666666';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(item.count), padding.left + barW + 6, y + barHeight / 2 + 4);
  });
}

/** 绘制日历热力图图例 */
function drawCalendarGrid(
  ctx: CanvasRenderingContext2D,
  size: ChartSize,
  checkinData: CheckinDay[],
  dateRange: string[],
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);

  const cellSize = Math.floor((width - 12 * 6) / 7);
  const cellGap = 3;
  const actualCellSize = Math.min(cellSize, 16);

  // 构建 lookup
  const lookup = new Map<string, number>();
  checkinData.forEach((d) => {
    lookup.set(d.date, d.count);
  });

  // 找到第一个日期是星期几
  const firstDateStr = dateRange[0] ?? formatDate(new Date());
  const firstDate = new Date(firstDateStr);
  const startDay = (firstDate.getDay() + 6) % 7; // 0=Monday

  // 计算最大 count
  const maxCount = Math.max(...Array.from(lookup.values()), 1);

  dateRange.forEach((dateStr, i) => {
    const weekIndex = Math.floor((i + startDay) / 7);
    const dayIndex = (i + startDay) % 7;
    const count = lookup.get(dateStr) ?? 0;

    const x = weekIndex * (actualCellSize + cellGap);
    const y = dayIndex * (actualCellSize + cellGap);

    // 计算颜色级别
    let level = 0;
    if (count > 0) {
      const ratio = count / maxCount;
      level = Math.min(5, Math.ceil(ratio * 5));
    }

    const colors = [
      '#F5F5F5',
      'rgba(255,107,53,0.12)',
      'rgba(255,107,53,0.30)',
      'rgba(255,107,53,0.50)',
      'rgba(255,107,53,0.70)',
      '#FF6B35',
    ];

    ctx.fillStyle = colors[level] ?? '#F5F5F5';
    ctx.beginPath();
    ctx.roundRect(x, y, actualCellSize, actualCellSize, 2);
    ctx.fill();
  });
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
  const chartDataLoadedRef = useRef<boolean>(false);

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

      chartDataLoadedRef.current = true;
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
  // 绘制折线图（热量趋势）
  // ============================================================
  const drawCalorieChart = useCallback(async () => {
    const canvas = await initCanvas('calorieChart');
    if (canvas === null) return;

    const days = calorieDays;
    const data = calorieData.slice(30 - days);
    drawLineChart(canvas.ctx, canvas.size, data, days);
  }, [calorieData, calorieDays]);

  useEffect(() => {
    if (!chartDataLoadedRef.current) return;
    drawCalorieChart();
  }, [drawCalorieChart]);

  // ============================================================
  // 绘制饼图（食物类型分布）
  // ============================================================
  const drawPieChartCanvas = useCallback(async () => {
    const canvas = await initCanvas('typeChart');
    if (canvas === null) return;

    const typeCounts = stats?.foodTypeCounts;
    if (typeCounts === undefined || typeCounts === null) {
      drawPieChart(canvas.ctx, canvas.size, []);
      return;
    }

    const entries = Object.entries(typeCounts) as Array<[string, number]>;
    const pieData = entries
      .map(([type, count]) => ({
        label: FOOD_TYPE_LABELS[type as FoodType] ?? type,
        value: count,
        color: FOOD_TYPE_COLORS[type as FoodType] ?? '#607D8B',
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    drawPieChart(canvas.ctx, canvas.size, pieData);
  }, [stats]);

  useEffect(() => {
    if (!chartDataLoadedRef.current) return;
    drawPieChartCanvas();
  }, [drawPieChartCanvas]);

  // ============================================================
  // 绘制条形图（Top 食物排行）
  // ============================================================
  const drawFoodBarChart = useCallback(async () => {
    const canvas = await initCanvas('foodBarChart');
    if (canvas === null) return;

    drawBarChart(canvas.ctx, canvas.size, topFoods);
  }, [topFoods]);

  useEffect(() => {
    if (!chartDataLoadedRef.current) return;
    drawFoodBarChart();
  }, [drawFoodBarChart]);

  // ============================================================
  // 绘制日历热力图
  // ============================================================
  const drawCalendarCanvas = useCallback(async () => {
    const canvas = await initCanvas('checkinCalendar');
    if (canvas === null) return;

    const dates = getLastNDays(84);
    drawCalendarGrid(canvas.ctx, canvas.size, checkinData, dates);
  }, [checkinData]);

  useEffect(() => {
    if (!chartDataLoadedRef.current) return;
    drawCalendarCanvas();
  }, [drawCalendarCanvas]);

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
        <View className='stats-loading'>
          <View className='stats-loading-spinner' />
          <Text>加载统计数据...</Text>
        </View>
      </View>
    );
  }

  // 空状态（无记录时）
  if ((stats?.totalRecords ?? 0) === 0) {
    return (
      <View className='stats-page'>
        <View className='stats-empty'>
          <Text className='stats-empty-icon'>📊</Text>
          <Text className='stats-empty-text'>记录更多食物查看统计</Text>
          <Text className='stats-empty-sub'>
            拍照记录食物后，这里将展示你的饮食数据
          </Text>
          <Button
            className='stats-empty-btn'
            onClick={handleTakePhoto}
          >
            拍照记录
          </Button>
        </View>
      </View>
    );
  }

  const overviewValues = [
    { label: '总记录数', value: stats?.totalRecords ?? 0 },
    { label: '打卡天数', value: stats?.totalCheckins ?? 0 },
    { label: '连续打卡', value: stats?.currentStreak ?? 0 },
    { label: '平均热量', value: stats?.totalCalories !== undefined && (stats?.totalRecords ?? 0) > 0 ? Math.round(stats.totalCalories / (stats?.totalRecords ?? 1)) : 0 },
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
          <Canvas
            type='2d'
            id='calorieChart'
            className='stats-canvas'
            style='height: 360rpx'
          />
        </View>
      </View>

      {/* ==================== 食物类型分布饼图 ==================== */}
      <View className='stats-chart-card'>
        <View className='stats-chart-header'>
          <Text className='stats-chart-title'>食物类型分布</Text>
        </View>
        <View className='stats-canvas-wrapper'>
          <Canvas
            type='2d'
            id='typeChart'
            className='stats-canvas'
            style='height: 360rpx'
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
            <Canvas
              type='2d'
              id='foodBarChart'
              className='stats-canvas'
              style='height: 360rpx'
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
            <Canvas
              type='2d'
              id='checkinCalendar'
              className='stats-canvas'
              style='height: 240rpx'
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
