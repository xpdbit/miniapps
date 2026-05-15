import { View, Text } from '@tarojs/components';
import type { CSSProperties, ReactNode } from 'react';
import './index.scss';

interface StatsCardProps {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  variant?: 'default' | 'compact' | 'highlight';
}

export default function StatsCard({
  title,
  icon,
  children,
  className = '',
  style,
  variant = 'default',
}: StatsCardProps) {
  return (
    <View className={`stats-card stats-card--${variant} ${className}`} style={style}>
      {title && (
        <View className='stats-card-header'>
          {icon && <View className='stats-card-icon'>{icon}</View>}
          <Text className='stats-card-title'>{title}</Text>
        </View>
      )}
      <View className='stats-card-body'>{children}</View>
    </View>
  );
}

export function StatsRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <View className='stats-row'>
      <Text className='stats-row-label'>{label}</Text>
      <Text className='stats-row-value' style={color ? { color } : undefined}>
        {value}
      </Text>
    </View>
  );
}
