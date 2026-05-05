import { View, Text } from '@tarojs/components';
import type { FC } from 'react';
import './index.scss';

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

const SectionHeader: FC<SectionHeaderProps> = ({
  title,
  action,
  className = '',
}) => {
  const classNames = ['section-header', className].filter(Boolean).join(' ');

  return (
    <View className={classNames}>
      <Text className='section-header__title'>{title}</Text>
      {action && (
        <Text
          className='section-header__action'
          onClick={action.onClick}
        >
          {action.label} ›
        </Text>
      )}
    </View>
  );
};

export default SectionHeader;
