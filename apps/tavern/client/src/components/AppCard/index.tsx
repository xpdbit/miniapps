import { View, Text } from '@tarojs/components';
import type { FC, ReactNode } from 'react';
import { cn } from '@/utils';
import './index.scss';

type AppCardPadding = 'sm' | 'base' | 'lg';

interface AppCardProps {
  title?: string;
  subtitle?: string;
  extra?: ReactNode;
  bordered?: boolean;
  elevated?: boolean;
  padding?: AppCardPadding;
  hoverable?: boolean;
  glass?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
}

const AppCard: FC<AppCardProps> = ({
  title,
  subtitle,
  extra,
  bordered = false,
  elevated = false,
  padding = 'base',
  hoverable = false,
  glass = false,
  onClick,
  children,
  className = '',
}) => {
  const classNames = cn(
    'card',
    bordered && 'card--bordered',
    elevated && 'card--elevated',
    hoverable && 'card--interactive',
    glass && 'card--glass',
    onClick && 'card--interactive',
    padding === 'sm' && 'card--compact',
    className,
  );

  const hasHeader = title || extra;

  return (
    <View className={classNames} onClick={onClick}>
      {hasHeader && (
        <View className='card__header'>
          <View className='card__header-left'>
            {title && <Text className='card__title'>{title}</Text>}
            {subtitle && (
              <Text className='card__subtitle'>{subtitle}</Text>
            )}
          </View>
          {extra && <View className='card__extra'>{extra}</View>}
        </View>
      )}
      {children && <View className='card__body'>{children}</View>}
    </View>
  );
};

export default AppCard;
