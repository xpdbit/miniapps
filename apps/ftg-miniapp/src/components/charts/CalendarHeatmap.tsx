import { useEffect } from 'react';
import { Canvas } from '@tarojs/components';
import { initCanvas, formatDate } from './utils';
import type { ChartSize, CalendarHeatmapData } from './types';
import './Chart.scss';

interface CalendarHeatmapProps {
  /** 日历热力图数据 */
  data: CalendarHeatmapData[];
  /** 日期范围 */
  dateRange: string[];
  /** Canvas 高度 (rpx)，默认 240 */
  height?: number;
  /** Canvas ID，默认 'calendarHeatmap' */
  canvasId?: string;
}

/**
 * 绘制日历热力图
 */
function drawCalendarGrid(
  ctx: CanvasRenderingContext2D,
  size: ChartSize,
  checkinData: CalendarHeatmapData[],
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

const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  data,
  dateRange,
  height = 240,
  canvasId = 'calendarHeatmap',
}) => {
  useEffect(() => {
    const draw = async () => {
      const result = await initCanvas(canvasId);
      if (result === null) return;
      drawCalendarGrid(result.ctx, result.size, data, dateRange);
    };
    draw();
  }, [data, dateRange, canvasId]);

  return (
    <Canvas
      type='2d'
      id={canvasId}
      className='chart-canvas'
      style={`height: ${height}rpx`}
    />
  );
};

export default CalendarHeatmap;
