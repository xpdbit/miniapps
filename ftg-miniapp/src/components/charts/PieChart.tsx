import { useEffect } from 'react';
import { Canvas } from '@tarojs/components';
import { initCanvas } from './utils';
import type { ChartSize, PieChartData } from './types';
import './Chart.scss';

interface PieChartProps {
  /** 饼图/环形图数据 */
  data: PieChartData[];
  /** Canvas 高度 (rpx)，默认 360 */
  height?: number;
  /** Canvas ID，默认 'pieChart' */
  canvasId?: string;
}

/**
 * 绘制饼图/环形图（食物类型分布）
 */
function drawPieChart(
  ctx: CanvasRenderingContext2D,
  size: ChartSize,
  data: PieChartData[],
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
    ctx.moveTo(
      centerX + innerRadius * Math.cos(startAngle),
      centerY + innerRadius * Math.sin(startAngle),
    );
    ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
    ctx.lineTo(
      centerX + innerRadius * Math.cos(endAngle),
      centerY + innerRadius * Math.sin(endAngle),
    );
    ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();

    startAngle = endAngle;
  });
}

const PieChart: React.FC<PieChartProps> = ({
  data,
  height = 360,
  canvasId = 'pieChart',
}) => {
  useEffect(() => {
    const draw = async () => {
      const result = await initCanvas(canvasId);
      if (result === null) return;
      drawPieChart(result.ctx, result.size, data);
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

export default PieChart;
