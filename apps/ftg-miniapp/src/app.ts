// ============================================================
// 食物主题生成器 - 应用入口
// Taro 4.x + React 18 + TypeScript 微信小程序
// ============================================================

import { PropsWithChildren } from 'react';
import Taro, { useLaunch } from '@tarojs/taro';
import { useAuthStore } from '@/stores/authStore';
import './app.scss';

/** 网络弱信号检测 — 微信基础库 3.15.x 存在 WAServiceMainContext generic timeout Bug */
function setupNetworkMonitor(): void {
  if (process.env.TARO_ENV === 'weapp' && typeof wx !== 'undefined') {
    try {
      // onNetworkWeakChange 基础库 >= 2.21.0，非标准 Taro 类型定义
      const ext = wx as unknown as {
        onNetworkWeakChange?: (callback: (res: { weakNet: boolean }) => void) => void;
      };
      ext.onNetworkWeakChange?.((res) => {
        if (res.weakNet) {
          console.warn('[NetworkMonitor] 检测到弱网环境，可能导致请求超时');
        }
      });
      console.info('[NetworkMonitor] 弱网监听已开启');
    } catch (error) {
      console.warn('[NetworkMonitor] 弱网监听注册失败:', error);
    }
  }
}

/** 全局未捕获 Promise rejection 处理 — 微信基础库 3.15.x timeout bug 会以 Promise rejection 形式抛出 */
function setupUnhandledRejectionHandler(): void {
  if (process.env.TARO_ENV === 'weapp' && typeof wx !== 'undefined') {
    try {
      // onUnhandledRejection 基础库 >= 2.10.0，非标准 Taro 类型定义
      const ext = wx as unknown as {
        onUnhandledRejection?: (callback: (res: { reason: unknown; promise: Promise<unknown> }) => void) => void;
      };
      ext.onUnhandledRejection?.((res) => {
        const reason = res.reason;
        if (reason instanceof Error) {
          // 基础库 3.15.x WAServiceMainContext timeout 为 generic Error('timeout')
          if (reason.message?.includes('timeout')) {
            console.warn('[GlobalError] 基础库超时（可能为 3.15.x known bug），已自动恢复:', reason.message);
            return;
          }
          // API 请求超时（httpClient 已处理并转换为中文错误）
          if (reason.message?.includes('请求超时') || reason.message?.includes('无法连接到服务器')) {
            console.error('[GlobalError] 网络请求异常:', reason.message);
            return;
          }
        }
        console.error('[GlobalError] 未处理的 Promise 拒绝:', reason);
      });
    } catch (error) {
      // 环境不支持时静默
    }
  }
}

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
    setupUnhandledRejectionHandler();
    setupNetworkMonitor();

    // 自动认证：检查已有 token → 有效则恢复会话 → 否则 wx.login() 自动注册登录
    useAuthStore.getState().initialize();
  });

  return children;
}

export default App;
