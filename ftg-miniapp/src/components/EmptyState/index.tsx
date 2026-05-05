import { View, Text } from '@tarojs/components';
import type { FC } from 'react';
import AppButton from '../AppButton/AppButton';
import './index.scss';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

const EmptyState: FC<EmptyStateProps> = ({
  icon = '📭',
  title,
  description,
  action,
  className = '',
}) => {
  const classNames = ['empty-state', className].filter(Boolean).join(' ');

  return (
    <View className={classNames}>
      {icon && <Text className='empty-state__icon'>{icon}</Text>}
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
