// ============================================================
// 错误边界组件 - ErrorBoundary
// 捕获子组件渲染期间的 React 错误，展示降级 UI
// 可作为 HOC 包裹页面组件使用
// ============================================================

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';

interface ErrorBoundaryProps {
  /** 子组件 */
  children: ReactNode;
  /** 可选的降级 UI 渲染函数 */
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 错误边界组件
 * 使用 class component 实现，因为 React 错误边界需要 componentDidCatch 生命周期
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  state: ErrorBoundaryState = { hasError: false, error: null };

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误到控制台，方便调试
    console.error('[ErrorBoundary] 捕获到渲染错误:', error);
    console.error('[ErrorBoundary] 组件堆栈:', errorInfo.componentStack);

    // 尝试通过 Toast 提示用户
    try {
      Taro.showToast({
        title: '页面出错了，请重试',
        icon: 'none',
        duration: 3000,
      });
    } catch {
      // Toast 失败时静默处理
    }
  }

  /** 重置错误状态，重新渲染子组件 */
  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // 默认降级 UI
      return (
        <View className='error-boundary'>
          <View className='error-boundary-container'>
            <Text className='error-boundary-icon'>😵</Text>
            <Text className='error-boundary-title'>出错了</Text>
            <Text className='error-boundary-message'>
              页面遇到了意外错误，请尝试刷新
            </Text>
            {this.state.error && (
              <Text className='error-boundary-detail'>
                {this.state.error.message}
              </Text>
            )}
            <Button
              className='error-boundary-btn'
              onClick={this.handleRetry}
            >
              重新加载
            </Button>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

/**
 * 高阶组件：将页面组件用 ErrorBoundary 包裹
 * @example
 * ```tsx
 * const SafePage = withErrorBoundary(MyPage);
 * ```
 */
export function withErrorBoundary<P extends Record<string, unknown>>(
  WrappedComponent: React.ComponentType<P>,
): React.ComponentType<P> {
  const displayName =
    WrappedComponent.displayName ?? WrappedComponent.name ?? 'Component';

  const WrappedWithErrorBoundary = (props: P): ReactNode => (
    <ErrorBoundary>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WrappedWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return WrappedWithErrorBoundary;
}
