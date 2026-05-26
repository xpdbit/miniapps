import React, { Component, type ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { useThemeStore } from '@/stores/themeStore'
import WebNavBar from '@/components/WebNavBar'
import DesktopSidebar from '@/components/DesktopSidebar'
import './app.scss'

interface AppProps {
  children: ReactNode
}

/**
 * H5 桌面端布局包装组件
 *
 * 仅在 H5 平台 + 屏幕宽度 >= 1024px 时启用 GitHub 风格双栏布局：
 * - 左侧 DesktopSidebar 导航（含主题切换）
 * - 右侧内容区域（无顶部 WebNavBar，侧边栏已提供导航）
 *
 * 移动端浏览器（< 1024px）：显示 WebNavBar + 底部 TabBar
 * 桌面端（>= 1024px）：隐藏 WebNavBar，隐藏 TabBar，侧边栏导航
 */
function DesktopLayout({ children }: { children: ReactNode }) {
  const [isDesktop, setIsDesktop] = React.useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth >= 1024
    return false
  })

  React.useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!isDesktop) {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(WebNavBar),
      children,
    )
  }

  return React.createElement(
    'div',
    { className: 'desktop-app-layout' },
    React.createElement(DesktopSidebar),
    React.createElement(
      'div',
      { className: 'desktop-app-content' },
      children,
    ),
  )
}

class App extends Component<AppProps> {
  componentDidMount() {
    console.log('========================================');
    console.log('  AI-Tavern 角色聊天');
    console.log('========================================');
    console.log('\u5E73\u53F0:      ' + (process.env.TARO_ENV || '\u672A\u77E5'));
    console.log('  API \u5730\u5740:   ' + (process.env.TARO_APP_API_BASE || '\u672A\u914D\u7F6E'));
    console.log('========================================');

    this.bindGlobalErrorHandler()
    useThemeStore.getState().init()

    setTimeout(() => {
      void useAuthStore.getState().initialize()
      useGameStore.getState().restoreSaves()
    }, 100)
  }

  componentDidShow() {
    if (useAuthStore.getState().isLoggedIn) {
      void useAuthStore.getState().refreshQuota()
    }
  }

  componentDidHide() {}

  componentDidCatchError(err: string) {
    const errStr = typeof err === 'string' ? err : String(err)
    const networkErrors = ['fetch', 'request:fail', 'timeout', '\u7F51\u7EDC\u8FDE\u63A5', '\u8BF7\u6C42\u8D85\u65F6']
    const isNetworkError = networkErrors.some(keyword => errStr.toLowerCase().includes(keyword.toLowerCase()))
    if (isNetworkError) {
      return
    }
    console.error('[tavern] App error:', err)
  }

  private bindGlobalErrorHandler() {
    try {
      const wx = (globalThis as Record<string, unknown>).wx as
        | { onUnhandledRejection?: (cb: (res: { reason: unknown }) => void) => void }
        | undefined
      if (wx?.onUnhandledRejection) {
        wx.onUnhandledRejection((res) => {
          const reason = res?.reason
          const reasonStr = typeof reason === 'string' ? reason : String(reason ?? '')
          if (reasonStr.toLowerCase().includes('fetch') || reasonStr.toLowerCase().includes('request:fail')) {
            return
          }
          console.warn('[tavern] Unhandled rejection:', reason)
        })
      }
    } catch {
    }
  }

  render() {
    const isH5 = process.env.TARO_ENV === 'h5'

    if (isH5) {
      return React.createElement(
        DesktopLayout,
        null,
        this.props.children,
      )
    }

    return React.createElement(
      React.Fragment,
      null,
      this.props.children,
    )
  }
}

export default App