import { View, Text } from '@tarojs/components';
import type { FC } from 'react';

type LoadingType = 'fullscreen' | 'inline' | 'overlay';

/**
 * 加载状态属性
 */
interface LoadingProps {
  /** 是否显示加载遮罩 */
  visible: boolean;
  /** 可选的加载提示文字 */
  text?: string;
  /** 加载模式: fullscreen=全屏遮罩, inline=行内加载, overlay=父容器内半透明遮罩 */
  type?: LoadingType;
  /** 自定义 z-index (仅 fullscreen/overlay 生效) */
  zIndex?: number;
}

/**
 * 全局加载组件
 *
 * 支持三种模式:
 * - `fullscreen`: 覆盖全屏的半透明遮罩 + 食品主题旋转动画 (默认)
 * - `inline`: 纯加载图标 + 文字，无遮罩，适合嵌入已有布局
 * - `overlay`: 半透明遮罩覆盖父容器 (父容器需 position: relative)
 *
 * @example
 * ```tsx
 * <Loading visible text='AI 识别中...' />
 * <Loading visible type='inline' text='加载中...' />
 * <Loading visible type='overlay' zIndex={10} />
 * ```
 */
const Loading: FC<LoadingProps> = ({
  visible,
  text = '正在处理...',
  type = 'fullscreen',
  zIndex,
}) => {
  if (!visible) {
    return null;
  }

  // inline 模式：纯 spinner + 文字，无遮罩
  if (type === 'inline') {
    return (
      <View className='loading-inline'>
        <View className='loading-inline__spinner'>
          <View className='spinner-ring' />
        </View>
        {text.length > 0 && <Text className='loading-inline__text'>{text}</Text>}
      </View>
    );
  }

  // overlay 模式：半透明遮罩覆盖父容器
  if (type === 'overlay') {
    return (
      <View
        className='loading-overlay loading-overlay--parent'
        style={zIndex !== undefined ? { zIndex } : undefined}
      >
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
  }

  // fullscreen 模式 (默认): 固定全屏遮罩
  return (
    <View
      className='loading-overlay'
      style={zIndex !== undefined ? { zIndex } : undefined}
    >
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
