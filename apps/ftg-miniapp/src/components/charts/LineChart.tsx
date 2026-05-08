import { useEffect } from 'react';
import { Canvas } from '@tarojs/components';
import { initCanvas, hexToRgba } from './utils';
import type { ChartSize, LineChartData } from './types';
import './Chart.scss';

interface LineChartProps {
  /** 折线图数据 */
  data: LineChartData[];
  /** 显示天数（用于 X 轴间距，默认 data.length） */
  days?: number;
  /** Canvas 高度 (rpx)，默认 360 */
  height?: number;
  /** 渐变起始/结束颜色，默认 ['#FF6B35', '#FF6B35'] */
  gradientColor?: [string, string];
  /** Canvas ID，默认 'lineChart' */
  canvasId?: string;
  /** 切换天数回调 */
  onToggleDays?: (days: number) => void;
}

/**
 * 绘制折线图（热量趋势）
 */
function drawLineChart(
  ctx: CanvasRenderingContext2D,
  size: ChartSize,
  data: LineChartData[],
  days: number,
  gradientColor: [string, string],
): void {
  const { width, height } = size;
  const padding = { top: 20, right: 16, bottom: 32, left: 48 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // 清空
  ctx.clearRect(0, 0, width, height);

  if (data.length === 0) return;

  // 计算 Y 轴范围
  const maxVal = Math.max(...data.map((d) => d.value), 100);
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
  gradient.addColorStop(0, hexToRgba(gradientColor[0], 0.2));
  gradient.addColorStop(1, hexToRgba(gradientColor[0], 0.01));

  // 填充路径
  ctx.beginPath();
  data.forEach((point, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - (point.value / yMax) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  // 从最后一个点向下闭合
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
    const y = padding.top + chartH - (point.value / yMax) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = gradientColor[0];
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 绘制数据点
  data.forEach((point, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - (point.value / yMax) * chartH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = gradientColor[0];
    ctx.fill();
  });

  // X 轴标签
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

const LineChart: React.FC<LineChartProps> = ({
  data,
  days: daysProp,
  height = 360,
  gradientColor = ['#FF6B35', '#FF6B35'],
  canvasId = 'lineChart',
}) => {
  const days = daysProp ?? data.length;

  useEffect(() => {
    const draw = async () => {
      const result = await initCanvas(canvasId);
      if (result === null) return;
      drawLineChart(result.ctx, result.size, data, days, gradientColor);
    };
    draw();
  }, [data, days, canvasId, gradientColor]);

  return (
    <Canvas
      type='2d'
      id={canvasId}
      className='chart-canvas'
      style={`height: ${height}rpx`}
    />
  );
};

export default LineChart;
