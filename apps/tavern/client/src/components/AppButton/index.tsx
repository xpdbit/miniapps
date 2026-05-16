import { View, Text } from '@tarojs/components';
import type { FC, ReactNode } from 'react';
import './index.scss';

type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type AppButtonSize = 'sm' | 'md' | 'lg';

interface AppButtonProps {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  icon?: string;
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
}

const AppButton: FC<AppButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  block = false,
  icon,
  children,
  onClick,
  className = '',
}) => {
  const classNames = [
    'app-btn',
    `app-btn--${variant}`,
    `app-btn--${size}`,
    block ? 'app-btn--block' : '',
    loading ? 'app-btn--loading' : '',
    disabled ? 'app-btn--disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View
      className={classNames}
      onClick={disabled || loading ? undefined : onClick}
    >
      {loading && <View className='app-btn__spinner' />}
      {!loading && icon && <Text className='app-btn__icon'>{icon}</Text>}
      {children && <Text className='app-btn__text'>{children}</Text>}
    </View>
  );
};

export default AppButton;
