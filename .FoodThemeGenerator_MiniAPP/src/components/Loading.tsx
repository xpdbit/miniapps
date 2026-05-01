import { View, Text } from '@tarojs/components';
import type { FC } from 'react';

/**
 * 加载状态属性
 */
interface LoadingProps {
  /** 是否显示加载遮罩 */
  visible: boolean;
  /** 可选的加载提示文字 */
  text?: string;
}

/**
 * 全局加载遮罩组件
 *
 * 覆盖全屏的半透明遮罩 + 食品主题旋转动画。
 * 可用于页面加载、AI 处理中等场景。
 *
 * @example
 * ```tsx
 * <Loading visible text='AI 识别中...' />
 * ```
 */
const Loading: FC<LoadingProps> = ({ visible, text = '正在处理...' }) => {
  if (!visible) {
    return null;
  }

  return (
    <View className='loading-overlay'>
      <View className='loading-container'>
        <View className='loading-spinner'>
          <View className='spinner-ring' />
          <View className='spinner-icon'>🍽️</View>
        </View>
        {text.length > 0 && (
          <Text className='loading-text'>{text}</Text>
        )}
      </View>
    </View>
  );
};

export default Loading;
