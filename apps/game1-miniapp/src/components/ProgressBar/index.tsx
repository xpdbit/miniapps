import { View, Text } from '@tarojs/components';
import type { CSSProperties } from 'react';
import './index.scss';

interface ProgressBarProps {
  /** 当前值 */
  value: number;
  /** 最大值 */
  max: number;
  /** 高度 (rpx) */
  height?: number;
  /** 颜色 */
  color?: string;
  /** 背景色 */
  bgColor?: string;
  /** 显示标签 */
  label?: string;
  /** 显示百分比 */
  showPercent?: boolean;
  /** 圆角 */
  rounded?: boolean;
  /** 条纹动画 */
  striped?: boolean;
  /** 额外类名 */
  className?: string;
}

export default function ProgressBar({
  value,
  max,
  height = 16,
  color,
  bgColor,
  label,
  showPercent = false,
  rounded = true,
  striped = false,
  className = '',
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  const trackStyle: CSSProperties = {
    height: `${height}rpx`,
    backgroundColor: bgColor || 'var(--color-bg-surface)',
    borderRadius: rounded ? `${height / 2}rpx` : '0',
  };

  const fillStyle: CSSProperties = {
    width: `${pct}%`,
    backgroundColor: color || 'var(--color-primary)',
    borderRadius: rounded ? `${height / 2}rpx` : '0',
  };

  return (
    <View className={`progress-bar ${className}`}>
      {(label || showPercent) && (
        <View className='progress-bar-header'>
          {label && <Text className='progress-bar-label'>{label}</Text>}
          {showPercent && <Text className='progress-bar-pct'>{Math.round(pct)}%</Text>}
        </View>
      )}
      <View className='progress-bar-track' style={trackStyle}>
        <View
          className={`progress-bar-fill ${striped ? 'progress-bar-fill--striped' : ''}`}
          style={fillStyle}
        />
      </View>
    </View>
  );
}
