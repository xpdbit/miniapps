import { useEffect } from 'react';
import { Canvas } from '@tarojs/components';
import { initCanvas } from './utils';
import type { ChartSize, BarChartData } from './types';
import './Chart.scss';

interface BarChartProps {
  /** 条形图数据 */
  data: BarChartData[];
  /** Canvas 高度 (rpx)，默认 360 */
  height?: number;
  /** Canvas ID，默认 'barChart' */
  canvasId?: string;
}

/**
 * 绘制横向条形图（Top 食物排行）
 */
function drawBarChart(
  ctx: CanvasRenderingContext2D,
  size: ChartSize,
  data: BarChartData[],
): void {
  const { width, height } = size;
  const padding = { top: 12, right: 16, bottom: 12, left: 80 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  ctx.clearRect(0, 0, width, height);

  if (data.length === 0) return;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const barHeight = Math.min(32, (chartH - (data.length - 1) * 8) / data.length);

  data.forEach((item, i) => {
    const y = padding.top + i * (barHeight + 8);
    const barW = (item.value / maxValue) * chartW;

    // 标签
    ctx.fillStyle = '#1A1A1A';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      item.label.length > 6 ? item.label.substring(0, 6) + '…' : item.label,
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
    ctx.fillText(String(item.value), padding.left + barW + 6, y + barHeight / 2 + 4);
  });
}

const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 360,
  canvasId = 'barChart',
}) => {
  useEffect(() => {
    const draw = async () => {
      const result = await initCanvas(canvasId);
      if (result === null) return;
      drawBarChart(result.ctx, result.size, data);
    };
    draw();
  }, [data, canvasId]);

  return (
    <Canvas
      type='2d'
      id={canvasId}
      className='chart-canvas'
      style={`height: ${height}rpx`}
    />
  );
};

export default BarChart;
