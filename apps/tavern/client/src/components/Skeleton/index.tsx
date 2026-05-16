import type { FC } from 'react';
import { View } from '@tarojs/components';
import './index.scss';

type SkeletonType = 'card' | 'list' | 'grid' | 'image';

interface SkeletonProps {
  type?: SkeletonType;
  count?: number;
  className?: string;
}

const Skeleton: FC<SkeletonProps> = ({ type = 'card', count = 1, className = '' }) => {
  const items = Array.from({ length: count });

  if (type === 'grid') {
    return (
      <View className={`skeleton-grid ${className}`.trim()}>
        {items.map((_, i) => (
          <View key={i} className='skeleton-card'>
            <View className='skeleton-img skeleton-pulse' />
            <View className='skeleton-line skeleton-pulse' style={{ width: '70%' }} />
            <View className='skeleton-line skeleton-pulse' style={{ width: '40%' }} />
          </View>
        ))}
      </View>
    );
  }

  if (type === 'card') {
    return (
      <View className={`skeleton-card-list ${className}`.trim()}>
        {items.map((_, i) => (
          <View key={i} className='skeleton-card'>
            <View className='skeleton-img skeleton-pulse' />
            <View className='skeleton-text-group'>
              <View className='skeleton-line skeleton-pulse' style={{ width: '60%' }} />
              <View className='skeleton-line skeleton-pulse' style={{ width: '80%' }} />
              <View className='skeleton-line skeleton-pulse' style={{ width: '40%' }} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (type === 'list') {
    return (
      <View className={`skeleton-list ${className}`.trim()}>
        {items.map((_, i) => (
          <View key={i} className='skeleton-list-item'>
            <View className='skeleton-avatar skeleton-pulse' />
            <View className='skeleton-list-text'>
              <View className='skeleton-line skeleton-pulse' style={{ width: '50%' }} />
              <View className='skeleton-line skeleton-pulse' style={{ width: '70%' }} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  // type === 'image'
  return (
    <View className={`skeleton-image-wrap ${className}`.trim()}>
      {items.map((_, i) => (
        <View key={i} className='skeleton-image-block skeleton-pulse'>
          <View className='skeleton-image-icon'>⬜</View>
        </View>
      ))}
    </View>
  );
};

export default Skeleton;
