import { View, Text } from '@tarojs/components';
import type { FC, ReactNode } from 'react';
import AppButton from '../AppButton';
import './index.scss';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

const EmptyState: FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  const classNames = ['empty-state', className].filter(Boolean).join(' ');

  return (
    <View className={classNames}>
      {icon !== undefined && icon !== null && (
        <View className='empty-state__icon'>{icon}</View>
      )}
      <Text className='empty-state__title'>{title}</Text>
      {description && (
        <Text className='empty-state__description'>{description}</Text>
      )}
      {action && (
        <AppButton
          variant='primary'
          size='md'
          className='empty-state__action'
          onClick={action.onClick}
        >
          {action.label}
        </AppButton>
      )}
    </View>
  );
};

export default EmptyState;
