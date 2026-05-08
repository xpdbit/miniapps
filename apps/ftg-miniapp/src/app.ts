// ============================================================
// 食物主题生成器 - 应用入口
// Taro 4.x + React 18 + TypeScript 微信小程序
// ============================================================

import { PropsWithChildren } from 'react';
import Taro, { useLaunch } from '@tarojs/taro';
import { useAuthStore } from '@/stores/authStore';
import './app.scss';

/**
 * 微信云开发 CloudBase 初始化
 * 使用 CloudBase 天然免登录机制
 */
function initCloudBase(): void {
  if (process.env.TARO_ENV === 'weapp' && typeof wx !== 'undefined' && wx.cloud) {
    try {
      wx.cloud.init({
        env: process.env.CLOUDBASE_ENV_ID || 'YOUR_ENV_ID',
        traceUser: true,
      });
    } catch (error) {
      console.error('[CloudBase] 初始化失败:', error);
    }
  }
}

/**
 * 全局未捕获错误处理
 * 防止未捕获的异常导致白屏
 * 兼容微信小程序运行时（无 window 对象）
 */
function setupGlobalErrorHandler(): void {
  // 通过 Taro 提供的 API 监听全局错误
  // 微信小程序 App.onError 会在 useLaunch 中通过 wx.onError 注册
  if (process.env.TARO_ENV === 'weapp' && typeof wx !== 'undefined') {
    try {
      wx.onError((error: string) => {
        console.error('[GlobalError] 未捕获错误:', error);
        Taro.showToast({
          title: '应用出错了，请重试',
          icon: 'none',
          duration: 3000,
        }).catch(() => {
          // Toast 失败时静默处理
        });
      });
    } catch (error) {
      console.error('[GlobalError] 注册错误监听失败:', error);
    }
  }

  // H5 环境下降级使用 window.onerror
  if (process.env.TARO_ENV !== 'weapp' && typeof window !== 'undefined') {
    window.onerror = function (
      _event: string | Event,
      _source?: string,
      _lineno?: number,
      _colno?: number,
      error?: Error,
    ): boolean {
      console.error('[GlobalError] 未捕获错误:', error?.message || _event);
      Taro.showToast({
        title: '应用出错了，请重试',
        icon: 'none',
        duration: 3000,
      }).catch(() => {
        // Toast 失败时静默处理
      });
      return true;
    };

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      console.error('[GlobalError] 未处理的 Promise 拒绝:', message);
      Taro.showToast({
        title: '请求出错了，请重试',
        icon: 'none',
        duration: 3000,
      }).catch(() => {
        // Toast 失败时静默处理
      });
    });
  }
}

function App({ children }: PropsWithChildren<object>) {
  useLaunch(() => {
    initCloudBase();
    setupGlobalErrorHandler();

    // 自动认证：检查已有 token → 有效则恢复会话 → 否则 wx.login() 自动注册登录
    useAuthStore.getState().initialize();
  });

  return children;
}

export default App;
