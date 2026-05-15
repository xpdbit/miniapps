import { View, Text } from '@tarojs/components';
import Icon, { type IconName } from '../Icon';
import './index.scss';

interface ResourceItem {
  icon: IconName;
  label: string;
  value: string | number;
  color?: string;
}

interface ResourceDisplayProps {
  items: ResourceItem[];
  columns?: number;
  className?: string;
}

export default function ResourceDisplay({
  items,
  columns = 4,
  className = '',
}: ResourceDisplayProps) {
  return (
    <View className={`resource-display ${className}`}>
      {items.map((item, i) => (
        <View
          key={i}
          className='resource-item'
          style={{ flex: `0 0 ${100 / columns}%` }}
        >
          <Icon name={item.icon} size={24} />
          <View className='resource-info'>
            <Text
              className='resource-value'
              style={item.color ? { color: item.color } : undefined}
            >
              {item.value}
            </Text>
            <Text className='resource-label'>{item.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
