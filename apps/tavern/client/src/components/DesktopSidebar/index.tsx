/**
 * DesktopSidebar — 精简版桌面端侧边导航栏
 *
 * 仅在 H5 桌面端（宽度 >= 1024px）显示，替代底部 tab bar。
 * 包含：Logo、pill 模式切换、折叠导航分组、最近聊天、用户区
 * 根据 gameMode 自动切换酒馆模式/游戏模式导航项。
 */
import { View, ViewProps, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useMemo, useCallback } from 'react'
import type { KeyboardEventHandler } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
import ThemeToggle from '@/components/ThemeToggle'
import DesktopLoginModal from '@/components/DesktopLoginModal'
import './index.scss'
import {
  TAVERN_ICON, CHAT_ICON, USER_ICON,
  GAME_CHATS_ICON, CONTACTS_ICON, DISCOVER_ICON,
  CHEVRON_RIGHT_ICON,
} from '@/constants/icons'

/** Taro 的 ViewProps 缺少 H5 可访问性所需的属性 */
type AccessibleViewProps = ViewProps & {
  tabIndex?: number
  onKeyDown?: KeyboardEventHandler
  role?: string
  'aria-label'?: string
  'aria-current'?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false'
  'aria-checked'?: boolean
}
const H5View = View as React.ComponentType<AccessibleViewProps>

function svgToDataUri(svg: string, color: string): string {
  const colored = svg.replace(/__COLOR__/g, color)
  return `data:image/svg+xml,${encodeURIComponent(colored)}`
}

interface NavItem {
  pagePath: string
  text: string
  svgIcon: string
  badge?: number
}

/* ===== Navigation Config ===== */

const TAVERN_NAV: NavItem[] = [
  { pagePath: 'pages/market/index', text: '酒馆', svgIcon: TAVERN_ICON },
  { pagePath: 'pages/chat/index', text: '开始', svgIcon: CHAT_ICON },
  { pagePath: 'pages/profile/index', text: '我的', svgIcon: USER_ICON },
]

const GAME_NAV: NavItem[] = [
  { pagePath: 'pages/chats/index', text: '通信', svgIcon: GAME_CHATS_ICON },
  { pagePath: 'pages/contacts/index', text: '通讯录', svgIcon: CONTACTS_ICON },
  { pagePath: 'pages/discover/index', text: '发现', svgIcon: DISCOVER_ICON },
  { pagePath: 'pages/profile/index', text: '我的', svgIcon: USER_ICON },
]

function getCurrentRoute(): string {
  if (process.env.TARO_ENV === 'h5') {
    const hash = window.location.hash.replace('#/', '')
    if (hash) {
      const topLevel = hash.split('/')[0] || ''
      const routeMap: Record<string, string> = {
        market: 'pages/market/index',
        chat: 'pages/chat/index',
        chats: 'pages/chats/index',
        contacts: 'pages/contacts/index',
        discover: 'pages/discover/index',
        profile: 'pages/profile/index',
        archive: 'pages/archive/index',
        creator: 'pages/creator/index',
        character: 'pages/character/index',
        persona: 'pages/persona/index',
        'game-setup': 'pages/game-setup/index',
      }
      return routeMap[topLevel] || hash
    }
  }
  try {
    const pages = Taro.getCurrentPages()
    const currentPage = pages[pages.length - 1]
    return currentPage?.route ?? ''
  } catch {
    return ''
  }
}



/** 截断字符串 */
function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}...` : str
}

/** 折叠状态持久化 key */
const NAV_COLLAPSED_KEY = 'tavern_sidebar_nav_collapsed'
const CHATS_COLLAPSED_KEY = 'tavern_sidebar_chats_collapsed'

function loadCollapsed(key: string): boolean {
  try {
    return Taro.getStorageSync<boolean>(key) ?? false
  } catch {
    return false
  }
}

function saveCollapsed(key: string, value: boolean) {
  try {
    Taro.setStorageSync(key, value)
  } catch { /* ignore */ }
}

/** 格式化时间为短文本 */
function formatTime(dateStr?: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function DesktopSidebar() {
  const gameMode = useGameStore((s) => s.gameMode)
  const darkMode = useThemeStore((s) => s.isDark)
  const { isLoggedIn, user } = useAuthStore()
  const sessions = useChatStore((s) => s.sessions)
  const loadSessions = useChatStore((s) => s.loadSessions)

  const navItems = useMemo(() => (gameMode ? GAME_NAV : TAVERN_NAV), [gameMode])

  // ── 激活路由索引 ──
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showLogin, setShowLogin] = useState(false)

  const syncActiveIndex = useCallback(() => {
    const route = getCurrentRoute()
    if (!route) return
    const idx = navItems.findIndex((item) => route.endsWith(item.pagePath))
    setActiveIndex(idx !== -1 ? idx : -1)
  }, [navItems])

  // Load chat sessions for recent chats
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  useEffect(() => {
    syncActiveIndex()
  }, [syncActiveIndex])

  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') return
    window.addEventListener('hashchange', syncActiveIndex)
    return () => window.removeEventListener('hashchange', syncActiveIndex)
  }, [syncActiveIndex])

  // ── 折叠状态 ──
  const [navCollapsed, setNavCollapsed] = useState(() => loadCollapsed(NAV_COLLAPSED_KEY))
  const [chatsCollapsed, setChatsCollapsed] = useState(() => loadCollapsed(CHATS_COLLAPSED_KEY))

  const toggleNavCollapse = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev
      saveCollapsed(NAV_COLLAPSED_KEY, next)
      return next
    })
  }, [])

  const toggleChatsCollapse = useCallback(() => {
    setChatsCollapsed((prev) => {
      const next = !prev
      saveCollapsed(CHATS_COLLAPSED_KEY, next)
      return next
    })
  }, [])

  // ── 导航 ──
  const currentRoute = getCurrentRoute()

  const navigateTo = (index: number) => {
    if (index === activeIndex) return
    const item = navItems[index]
    if (!item) return
    setActiveIndex(index)
    const pagePath = item.pagePath
    if (gameMode) {
      if (pagePath === 'pages/profile/index') {
        Taro.switchTab({ url: `/${pagePath}` })
      } else {
        Taro.reLaunch({ url: `/${pagePath}` })
      }
    } else {
      Taro.switchTab({ url: `/${pagePath}` })
    }
  }

  const handleLogoClick = () => {
    setActiveIndex(-1)
    if (gameMode) {
      Taro.reLaunch({ url: '/pages/chats/index' })
    } else {
      Taro.switchTab({ url: '/pages/market/index' })
    }
  }

  const iconColor = (isActive: boolean) =>
    isActive ? '#C49A6C' : darkMode ? '#8B949E' : '#7A7570'

  const handleKeyDown =
    (action: () => void) => (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        action()
      }
    }

  // ── 最近聊天 ──
  const recentSessions = useMemo(() => {
    return [...sessions]
      .filter((s) => s.lastMessage)
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      })
      .slice(0, 5)
  }, [sessions])

  const showRecentChats = recentSessions.length > 1

  return (
    <View
      className={`desktop-sidebar ${darkMode ? 'desktop-sidebar--dark' : ''}`}
      role='banner'
      aria-label='侧边导航栏'
    >
      {/* Logo / Brand */}
      <View className='desktop-sidebar-header'>
        <H5View
          className='desktop-sidebar-logo'
          onClick={handleLogoClick}
          tabIndex={0}
          onKeyDown={handleKeyDown(handleLogoClick)}
          role='button'
          aria-label='返回首页'
        >
          <Text className='desktop-sidebar-logo-dot' />
          <Text>AI 酒馆</Text>
        </H5View>
      </View>

      {/* Pill Mode Switch (standalone) */}
      <View className='desktop-sidebar-mode-pill'>
        <H5View
          className={`desktop-sidebar-mode-pill-btn ${!gameMode ? 'desktop-sidebar-mode-pill-btn--active' : ''}`}
          onClick={() => {
            const store = useGameStore.getState()
            if (gameMode) store.disableGameMode()
          }}
          onKeyDown={handleKeyDown(() => {
            const store = useGameStore.getState()
            if (gameMode) store.disableGameMode()
          })}
          tabIndex={0}
          role='button'
          aria-label='切换到主菜单模式'
          aria-pressed={!gameMode}
        >
          <Text>主菜单</Text>
        </H5View>
        <H5View
          className={`desktop-sidebar-mode-pill-btn ${gameMode ? 'desktop-sidebar-mode-pill-btn--active' : ''}`}
          onClick={() => {
            const store = useGameStore.getState()
            if (!gameMode) store.enableGameMode()
          }}
          onKeyDown={handleKeyDown(() => {
            const store = useGameStore.getState()
            if (!gameMode) store.enableGameMode()
          })}
          tabIndex={0}
          role='button'
          aria-label='切换到游戏模式'
          aria-pressed={gameMode}
        >
          <Text>游戏中</Text>
        </H5View>
      </View>

      {/* Navigation Group (collapsible) */}
      <View className='desktop-sidebar-section'>
        <H5View
          className='desktop-sidebar-section-header'
          onClick={toggleNavCollapse}
          onKeyDown={handleKeyDown(toggleNavCollapse)}
          tabIndex={0}
          role='button'
          aria-expanded={!navCollapsed}
          aria-label={navCollapsed ? '展开导航' : '折叠导航'}
        >
          <Text
            className={`desktop-sidebar-section-arrow ${navCollapsed ? 'desktop-sidebar-section-arrow--collapsed' : ''}`}
          >
            ▾
          </Text>
          <Text className='desktop-sidebar-section-title'>导航</Text>
        </H5View>
        <View
          className={`desktop-sidebar-nav ${navCollapsed ? 'desktop-sidebar-nav--collapsed' : ''}`}
          role='navigation'
          aria-label={gameMode ? '游戏模式导航' : '酒馆模式导航'}
        >
          {navItems.map((item, index) => {
            const isActive = activeIndex >= 0 && index === activeIndex
            return (
              <H5View
                key={item.pagePath}
                className={`desktop-sidebar-item ${isActive ? 'desktop-sidebar-item--active' : ''}`}
                onClick={() => navigateTo(index)}
                onKeyDown={handleKeyDown(() => navigateTo(index))}
                tabIndex={0}
                role='link'
                aria-current={isActive ? 'page' : undefined}
                aria-label={`导航到${item.text}`}
              >
                <View
                  className='desktop-sidebar-item-icon'
                  style={{
                    backgroundImage: `url(${svgToDataUri(item.svgIcon, iconColor(isActive))})`,
                  }}
                />
                <Text className='desktop-sidebar-item-label'>{item.text}</Text>
                {item.badge != null && item.badge > 0 && (
                  <View className='desktop-sidebar-item-badge'>
                    <Text className='desktop-sidebar-item-badge-text'>
                      {item.badge > 99 ? '99+' : item.badge}
                    </Text>
                  </View>
                )}
              </H5View>
            )
          })}
        </View>
      </View>

      {/* Recent Chats (collapsible) */}
      {showRecentChats && (
        <View className='desktop-sidebar-section'>
          <H5View
            className='desktop-sidebar-section-header'
            onClick={toggleChatsCollapse}
            onKeyDown={handleKeyDown(toggleChatsCollapse)}
            tabIndex={0}
            role='button'
            aria-expanded={!chatsCollapsed}
            aria-label={chatsCollapsed ? '展开最近聊天' : '折叠最近聊天'}
          >
            <Text
              className={`desktop-sidebar-section-arrow ${chatsCollapsed ? 'desktop-sidebar-section-arrow--collapsed' : ''}`}
            >
              ▾
            </Text>
            <Text className='desktop-sidebar-section-title'>最近</Text>
          </H5View>
          <View
            className={`desktop-sidebar-nav ${chatsCollapsed ? 'desktop-sidebar-nav--collapsed' : ''}`}
            role='navigation'
            aria-label='最近聊天导航'
          >
            {recentSessions.map((session) => (
              <H5View
                key={session.id}
                className='desktop-sidebar-item'
                onClick={() => {
                  Taro.navigateTo({ url: `/pages/chat/index?sessionId=${session.id}` })
                }}
                onKeyDown={handleKeyDown(() => {
                  Taro.navigateTo({ url: `/pages/chat/index?sessionId=${session.id}` })
                })}
                tabIndex={0}
                role='link'
                aria-label={`跳转到${session.characterName ?? '会话'}`}
              >
                <View className='desktop-sidebar-chat-avatar'>
                  <Text className='desktop-sidebar-chat-avatar-text'>
                    {(session.characterName ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className='desktop-sidebar-chat-info'>
                  <Text className='desktop-sidebar-chat-name'>
                    {truncate(session.characterName ?? '会话', 8)}
                  </Text>
                  <Text className='desktop-sidebar-chat-time'>
                    {formatTime(session.updatedAt)}
                  </Text>
                </View>
              </H5View>
            ))}
          </View>
        </View>
      )}

      {/* Spacer */}
      <View className='desktop-sidebar-spacer' />

      {/* User Area */}
      <H5View
        className='desktop-sidebar-user'
        onClick={() => {
          if (!isLoggedIn) {
            setShowLogin(true)
          } else {
            Taro.switchTab({ url: '/pages/profile/index' })
          }
        }}
        onKeyDown={handleKeyDown(() => {
          if (!isLoggedIn) {
            setShowLogin(true)
          } else {
            Taro.switchTab({ url: '/pages/profile/index' })
          }
        })}
        tabIndex={0}
        role='button'
        aria-label={isLoggedIn ? '个人主页' : '点击登录'}
      >
        <View className='desktop-sidebar-user-avatar'>
          <Text className='desktop-sidebar-user-avatar-text'>
            {isLoggedIn && user?.nickname ? user.nickname.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <View className='desktop-sidebar-user-info'>
          <Text className='desktop-sidebar-user-name'>
            {isLoggedIn && user?.nickname
              ? user.nickname
              : user?.uuid?.slice(0, 8) || '未登录'}
          </Text>
          <Text className='desktop-sidebar-user-status'>
            {isLoggedIn ? '已登录' : '点击登录'}
          </Text>
        </View>
        <View
          className='desktop-sidebar-user-chevron'
          style={{
            backgroundImage: `url(${svgToDataUri(
              CHEVRON_RIGHT_ICON,
              darkMode ? '#8B949E' : '#A8A39E',
            )})`,
          }}
        />
      </H5View>

      {/* Theme Toggle Row */}
      <View className='desktop-sidebar-theme-row'>
        <Text className='desktop-sidebar-theme-label'>主题切换</Text>
        <ThemeToggle />
      </View>

      {/* Login Modal */}
      <DesktopLoginModal visible={showLogin} onClose={() => setShowLogin(false)} />

      {/* Footer */}
      <View className='desktop-sidebar-footer'>
        <Text className='desktop-sidebar-footer-text'>AI 酒馆 v1.0.0</Text>
      </View>
    </View>
  )
}
