import { Component, type ReactNode } from 'react'
import { useAuthStore } from '@/stores/authStore'
import './app.scss'

interface AppProps {
  children: ReactNode
}

class App extends Component<AppProps> {
  componentDidMount() {
    // 全局捕获未处理的 Promise 拒绝（网络错误静默处理）
    this.bindGlobalErrorHandler()

    // 延迟执行 API 调用，确保小程序首屏快速渲染，避免框架级 timeout
    setTimeout(() => {
      void useAuthStore.getState().restoreSession()
    }, 100)
  }

  componentDidShow() {
    if (useAuthStore.getState().isLoggedIn) {
      void useAuthStore.getState().refreshQuota()
    }
  }

  componentDidHide() {}

  /**
   * 全局错误处理器 — 网络错误静默处理，不输出到控制台
   * 避免 WeChat DevTools 中显示原始 "TypeError: Failed to fetch" 等干扰信息
   */
  componentDidCatchError(err: string) {
    // 网络相关错误静默处理（不输出到控制台，避免 DevTools 显示原始错误）
    const errStr = typeof err === 'string' ? err : String(err)
    const networkErrors = ['fetch', 'request:fail', 'timeout', '网络连接', '请求超时']
    const isNetworkError = networkErrors.some(keyword => errStr.toLowerCase().includes(keyword.toLowerCase()))
    if (isNetworkError) {
      // 静默处理，不输出 console.error
      return
    }
    // 仅非网络错误输出日志
    console.error('[tavern] App error:', err)
  }

  /**
   * 全局 unhandledrejection 处理器 — 捕获未被 catch 的 Promise 拒绝
   */
  private bindGlobalErrorHandler() {
    try {
      // WeChat Mini Program 通过 wx.onUnhandledRejection 捕获
      const wx = (globalThis as Record<string, unknown>).wx as
        | { onUnhandledRejection?: (cb: (res: { reason: unknown }) => void) => void }
        | undefined
      if (wx?.onUnhandledRejection) {
        wx.onUnhandledRejection((res) => {
          const reason = res?.reason
          const reasonStr = typeof reason === 'string' ? reason : String(reason ?? '')
          if (reasonStr.toLowerCase().includes('fetch') || reasonStr.toLowerCase().includes('request:fail')) {
            return // 网络错误静默处理
          }
          console.warn('[tavern] Unhandled rejection:', reason)
        })
      }
    } catch {
      // 忽略绑定失败
    }
  }

  render() {
    return this.props.children
  }
}

export default App
