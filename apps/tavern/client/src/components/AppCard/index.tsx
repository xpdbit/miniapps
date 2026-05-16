import { View, Text } from '@tarojs/components';
import type { FC, ReactNode } from 'react';
import './index.scss';

type AppCardPadding = 'sm' | 'base' | 'lg';

interface AppCardProps {
  title?: string;
  subtitle?: string;
  extra?: ReactNode;
  bordered?: boolean;
  padding?: AppCardPadding;
  hoverable?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
}

const AppCard: FC<AppCardProps> = ({
  title,
  subtitle,
  extra,
  bordered = false,
  padding = 'base',
  hoverable = false,
  onClick,
  children,
  className = '',
}) => {
  const classNames = [
    'app-card',
    `app-card--padding-${padding}`,
    bordered ? 'app-card--bordered' : '',
    hoverable ? 'app-card--hoverable' : '',
    onClick ? 'app-card--clickable' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const hasHeader = title || extra;

  return (
    <View className={classNames} onClick={onClick}>
      {hasHeader && (
        <View className='app-card__header'>
          <View className='app-card__header-left'>
            {title && <Text className='app-card__title'>{title}</Text>}
            {subtitle && (
              <Text className='app-card__subtitle'>{subtitle}</Text>
            )}
          </View>
          {extra && <View className='app-card__extra'>{extra}</View>}
        </View>
      )}
      {children && <View className='app-card__body'>{children}</View>}
    </View>
  );
};

export default AppCard;
