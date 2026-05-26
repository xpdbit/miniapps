# Tavern 底部栏逻辑修正 + Web 响应式布局实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正 tavern 底部导航栏逻辑（home 按钮 + 离开游戏按钮），并将 Web 端布局改造为 GitHub 风格三端自适应（桌面浏览器/移动浏览器/weapp）

**Architecture:** 
- Phase 1: 修改 WebNavBar 为可点击 home 按钮，重命名 profile 页的"回到酒馆"为"离开游戏"，在 gameStore 添加 `leaveGame()` 方法确保状态清理
- Phase 2: 创建 `DesktopSidebar` 组件替代桌面端底部栏，使用媒体查询 + 编译时平台判断实现三端布局自动切换

**Tech Stack:** Taro 4.x + React 18 + Zustand 5 + TypeScript + Sass

---

## Phase 1: 底部栏逻辑修正

### Task 1.1: gameStore 添加 leaveGame 方法

**Files:**
- Modify: `apps/tavern/client/src/stores/gameStore.ts`

- [ ] **Step 1: 添加 leaveGame action**

在 `gameStore.ts` 的 `GameState` interface 和 store 实现中添加 `leaveGame` 方法，合并 `setActiveSave(null)` + `disableGameMode()` 两个操作，确保离开游戏时彻底清理状态。

```typescript
// 在 GameState interface 中添加（disableGameMode 之后）:
leaveGame: () => void

// 在 store 实现中添加（disableGameMode 之后）:
leaveGame: () => {
  set({ activeSaveId: null, gameMode: false })
  try { Taro.setStorageSync(ACTIVE_KEY, '') } catch { /* ignore */ }
  try { Taro.setStorageSync(GAME_MODE_KEY, false) } catch { /* ignore */ }
  Taro.eventCenter.trigger('gameModeChange', false)
},
```

- [ ] **Step 2: 验证 TypeScript 类型**

运行 `lsp_diagnostics` 检查 `gameStore.ts` 无错误。

---

### Task 1.2: WebNavBar 添加 Home 按钮行为

**Files:**
- Modify: `apps/tavern/client/src/components/WebNavBar/index.tsx`

- [ ] **Step 1: 导入必要依赖**

在文件顶部导入 `useGameStore` 和 `Taro`（Taro 已导入）：

```tsx
import { useGameStore } from '@/stores/gameStore'
```

- [ ] **Step 2: 添加点击导航逻辑**

将标题文本改为可点击的 View，根据 gameMode 状态导航到不同页面：

```tsx
export default function WebNavBar() {
  if (!isH5) return null

  const gameMode = useGameStore(s => s.gameMode)

  const handleHomeClick = () => {
    if (gameMode) {
      // 游戏进行中 → 回到通信页面
      Taro.reLaunch({ url: '/pages/chats/index' })
    } else {
      // 非游戏状态 → 回到酒馆页面
      Taro.switchTab({ url: '/pages/market/index' })
    }
  }

  return (
    <View
      className='web-navbar'
      style={navStyle}
      role='banner'
      aria-label='顶部导航'
    >
      <View
        onClick={handleHomeClick}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        hoverClass='web-navbar-title--hover'
      >
        <Text style={titleStyle}>🏠 AI 酒馆</Text>
      </View>
      <ThemeToggle />
    </View>
  )
}
```

- [ ] **Step 3: 添加 hover 样式**

在 `app.scss` 的 `@media (min-width: 768px)` 块中添加：

```scss
.web-navbar-title--hover {
  opacity: 0.7;
}
```

- [ ] **Step 4: 验证**

运行 `lsp_diagnostics` 检查 `WebNavBar/index.tsx` 无错误。

---

### Task 1.3: Profile 页重命名"回到酒馆"为"离开游戏"

**Files:**
- Modify: `apps/tavern/client/src/pages/profile/index.tsx`

- [ ] **Step 1: 重命名按钮和弹窗文本**

将 profile 页面中的"回到酒馆"相关内容全部替换为"离开游戏"，并改用 `leaveGame()` 方法：

```tsx
// 替换原有的 {gameMode && (...)} 块（约第 794-811 行）
{gameMode && (
  <View
    className='page-profile-back-btn'
    onClick={() => {
      Taro.showModal({
        title: '离开游戏',
        content: '离开游戏后，底部导航将恢复为 酒馆/开始/我的。确定离开？',
        success: (res) => {
          if (res.confirm) {
            leaveGame()  // 使用新的 leaveGame 方法
          }
        },
      })
    }}
  >
    <Text>离开游戏</Text>
  </View>
)}
```

- [ ] **Step 2: 更新 import**

从 gameStore 中解构 `leaveGame` 替代 `disableGameMode`：

```tsx
// 将第 112 行的：
const { gameMode, disableGameMode, cardsPerRow, setCardsPerRow } = useGameStore()
// 改为：
const { gameMode, leaveGame, cardsPerRow, setCardsPerRow } = useGameStore()
```

- [ ] **Step 3: 验证**

运行 `lsp_diagnostics` 检查 `profile/index.tsx` 无错误。

---

### Task 1.4: 确保 TabBar 在 leaveGame 后正确响应

**Files:**
- Modify: `apps/tavern/client/src/custom-tab-bar/index.tsx`

- [ ] **Step 1: 验证现有逻辑**

确认 `custom-tab-bar/index.tsx` 中的 `modeHandler`（监听 `gameModeChange` 事件）在接收到 `false` 时会：
1. 切换到 `TAVERN_TAB_LIST`
2. 选中第一个 tab（`market/index`）
3. 导航到酒馆页面

现有代码已正确实现，无需修改。验证逻辑：

```typescript
// 第 134-141 行 — 已正确实现
const modeHandler = (isGameMode: boolean) => {
  setGameMode(isGameMode);
  const newList = isGameMode ? GAME_TAB_LIST : TAVERN_TAB_LIST;
  setSelected(0);
  if (newList[0]) {
    navigateTab(newList[0].pagePath);
  }
};
```

---

## Phase 2: Web 响应式布局 — GitHub 风格三端适配

### Task 2.1: 创建响应式布局检测 Hook

**Files:**
- Create: `apps/tavern/client/src/hooks/useResponsive.ts`

- [ ] **Step 1: 创建 useResponsive hook**

```typescript
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'

export interface ResponsiveInfo {
  /** 是否为微信小程序环境 */
  isWeapp: boolean
  /** 是否为桌面浏览器（宽度 >= 1024px） */
  isDesktop: boolean
  /** 是否为移动端浏览器（H5 且宽度 < 1024px） */
  isMobile: boolean
  /** 当前窗口宽度 */
  windowWidth: number
}

const BREAKPOINT_DESKTOP = 1024

export function useResponsive(): ResponsiveInfo {
  const isWeapp = process.env.TARO_ENV === 'weapp'
  const [windowWidth, setWindowWidth] = useState(() => {
    if (isWeapp) return 375 // weapp 默认宽度
    if (typeof window !== 'undefined') return window.innerWidth
    return 375
  })

  useEffect(() => {
    // 仅 H5 环境监听 resize
    if (isWeapp) return

    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    // 初始值可能不准确，立即更新一次
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [isWeapp])

  return {
    isWeapp,
    isDesktop: !isWeapp && windowWidth >= BREAKPOINT_DESKTOP,
    isMobile: !isWeapp && windowWidth < BREAKPOINT_DESKTOP,
    windowWidth,
  }
}
```

- [ ] **Step 2: 更新 hooks 导出**

在 `apps/tavern/client/src/hooks/index.ts` 中添加导出。

---

### Task 2.2: 创建 DesktopSidebar 桌面端侧边栏组件

**Files:**
- Create: `apps/tavern/client/src/components/DesktopSidebar/index.tsx`
- Create: `apps/tavern/client/src/components/DesktopSidebar/index.scss`

- [ ] **Step 1: 创建 DesktopSidebar 组件**

该组件在桌面端替代底部 tab bar，采用 GitHub 风格左侧垂直导航：

```tsx
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useGameStore } from '@/stores/gameStore'
import { useThemeStore } from '@/stores/themeStore'
import { Icon } from '@/components'
import './index.scss'

/* ---- SVG Icons ---- */
const GALLERY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`
const CHAT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
const USER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
const CHATS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
const CONTACTS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
const DISCOVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__COLOR__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="none"/></svg>`

function svgToDataUri(svg: string, color: string): string {
  const colored = svg.replace(/__COLOR__/g, color)
  return `data:image/svg+xml;utf-8,${encodeURIComponent(colored)}`
}

interface NavItem {
  pagePath: string
  text: string
  svgIcon: string
  iconName?: string
}

const TAVERN_NAV: NavItem[] = [
  { pagePath: 'pages/market/index', text: '酒馆', svgIcon: GALLERY_SVG, iconName: 'gallery' },
  { pagePath: 'pages/chat/index', text: '开始', svgIcon: CHAT_SVG, iconName: 'chat' },
  { pagePath: 'pages/profile/index', text: '我的', svgIcon: USER_SVG, iconName: 'user' },
]

const GAME_NAV: NavItem[] = [
  { pagePath: 'pages/chats/index', text: '通信', svgIcon: CHATS_SVG, iconName: 'chats' },
  { pagePath: 'pages/contacts/index', text: '通讯录', svgIcon: CONTACTS_SVG, iconName: 'contacts' },
  { pagePath: 'pages/discover/index', text: '发现', svgIcon: DISCOVER_SVG, iconName: 'discover' },
  { pagePath: 'pages/profile/index', text: '我的', svgIcon: USER_SVG, iconName: 'user' },
]

function getCurrentRoute(): string {
  try {
    const pages = Taro.getCurrentPages()
    const currentPage = pages[pages.length - 1]
    return currentPage?.route ?? ''
  } catch { return '' }
}

export default function DesktopSidebar() {
  const gameMode = useGameStore(s => s.gameMode)
  const darkMode = useThemeStore(s => s.dark)
  const navItems = gameMode ? GAME_NAV : TAVERN_NAV
  const currentRoute = getCurrentRoute()

  const navigateTo = (pagePath: string) => {
    if (pagePath === 'pages/profile/index') {
      Taro.switchTab({ url: `/${pagePath}` })
    } else if (gameMode) {
      Taro.reLaunch({ url: `/${pagePath}` })
    } else {
      Taro.switchTab({ url: `/${pagePath}` })
    }
  }

  return (
    <View className={`desktop-sidebar ${darkMode ? 'desktop-sidebar--dark' : ''}`}>
      {/* Logo / Home */}
      <View className='desktop-sidebar-header'>
        <Text
          className='desktop-sidebar-logo'
          onClick={() => {
            if (gameMode) {
              Taro.reLaunch({ url: '/pages/chats/index' })
            } else {
              Taro.switchTab({ url: '/pages/market/index' })
            }
          }}
        >
          🏠 AI 酒馆
        </Text>
      </View>

      {/* Navigation */}
      <View className='desktop-sidebar-nav'>
        {navItems.map((item) => {
          const isActive = currentRoute.endsWith(item.pagePath)
          const iconColor = isActive ? '#C49A6C' : (darkMode ? '#8B949E' : '#7A7570')
          return (
            <View
              key={item.pagePath}
              className={`desktop-sidebar-item ${isActive ? 'desktop-sidebar-item--active' : ''}`}
              onClick={() => navigateTo(item.pagePath)}
            >
              <View
                className='desktop-sidebar-item-icon'
                style={{
                  backgroundImage: `url(${svgToDataUri(item.svgIcon, iconColor)})`,
                }}
              />
              <Text className='desktop-sidebar-item-label'>{item.text}</Text>
            </View>
          )
        })}
      </View>

      {/* Footer */}
      <View className='desktop-sidebar-footer'>
        <Text className='desktop-sidebar-footer-text'>AI 酒馆 v1.0.0</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 创建样式文件**

```scss
// DesktopSidebar 样式 — GitHub 风格侧边栏

.desktop-sidebar {
  width: 260px;
  min-width: 260px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-elevated, #FCF9F6);
  border-right: 1px solid var(--color-border, #E5DDD4);
  overflow-y: auto;
  position: sticky;
  top: 0;
  z-index: 50;

  &--dark {
    background: var(--color-bg-card, #161B22);
    border-right-color: var(--color-border, #30363D);
  }
}

.desktop-sidebar-header {
  padding: 20px 16px 12px;
  border-bottom: 1px solid var(--color-border, #E5DDD4);
}

.desktop-sidebar-logo {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary, #2D2A26);
  cursor: pointer;
  user-select: none;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.7;
  }
}

.desktop-sidebar-nav {
  flex: 1;
  padding: 8px 0;
}

.desktop-sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 3px solid transparent;

  &:hover {
    background: var(--color-bg-surface-hover, #F5F1EB);
  }

  &--active {
    background: var(--color-primary-bg, rgba(196, 154, 108, 0.1));
    border-left-color: var(--color-primary, #C49A6C);
  }
}

.desktop-sidebar-item-icon {
  width: 20px;
  height: 20px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  flex-shrink: 0;
}

.desktop-sidebar-item-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #2D2A26);
  line-height: 1.4;
}

.desktop-sidebar-item--active .desktop-sidebar-item-label {
  color: var(--color-primary, #C49A6C);
  font-weight: 600;
}

.desktop-sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--color-border, #E5DDD4);
}

.desktop-sidebar-footer-text {
  font-size: 12px;
  color: var(--color-text-tertiary, #A8A39E);
}
```

---

### Task 2.3: 修改 app.ts 支持桌面端布局

**Files:**
- Modify: `apps/tavern/client/src/app.ts`

- [ ] **Step 1: 修改 app.ts 渲染逻辑**

将 `app.ts` 改为根据平台和屏幕宽度条件渲染不同布局：

```tsx
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

// 桌面端布局组件（客户端组件 — 需要 hooks）
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
    return (
      <>
        <WebNavBar />
        {children}
      </>
    )
  }

  return (
    <div className='desktop-app-layout'>
      <DesktopSidebar />
      <div className='desktop-app-content'>
        <WebNavBar />
        {children}
      </div>
    </div>
  )
}

class App extends Component<AppProps> {
  componentDidMount() {
    console.log('========================================');
    console.log('  AI-Tavern 角色聊天');
    console.log('========================================');
    console.log(`  平台:       ${process.env.TARO_ENV || '未知'}`);
    console.log(`  API 地址:   ${process.env.TARO_APP_API_BASE || '未配置'}`);
    console.log('========================================');

    this.bindGlobalErrorHandler()
    useThemeStore.getState().init()

    setTimeout(() => {
      void useAuthStore.getState().initialize()
      useGameStore.getState().restoreSaves()
    }, 100)

    Taro.eventCenter.on('darkModeChange', (isDark: boolean) => {
      useThemeStore.getState().setDark(isDark)
    })
  }

  componentDidShow() {
    if (useAuthStore.getState().isLoggedIn) {
      void useAuthStore.getState().refreshQuota()
    }
  }

  componentDidHide() {}

  componentDidCatchError(err: string) {
    const errStr = typeof err === 'string' ? err : String(err)
    const networkErrors = ['fetch', 'request:fail', 'timeout', '网络连接', '请求超时']
    const isNetworkError = networkErrors.some(keyword => errStr.toLowerCase().includes(keyword.toLowerCase()))
    if (isNetworkError) return
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
    } catch { }
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

    // weapp: 保持原有布局
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(WebNavBar),
      this.props.children,
    )
  }
}

export default App
```

- [ ] **Step 2: 更新 app.scss 桌面端布局样式**

在 `app.scss` 的 `@media (min-width: 1024px)` 块中添加桌面端布局样式：

```scss
@media (min-width: 1024px) {
  // 移除原有的 #app 居中限制
  #app {
    max-width: none;
    margin: 0;
    box-shadow: none;
  }

  // 桌面端双栏布局
  .desktop-app-layout {
    display: flex;
    min-height: 100vh;
  }

  .desktop-app-content {
    flex: 1;
    min-width: 0; // 防止 flex 溢出
    display: flex;
    flex-direction: column;
  }

  // 桌面端隐藏底部 tab bar
  .custom-tab-bar,
  .index--custom-tab-bar {
    display: none !important;
  }

  // WebNavBar 桌面端样式调整
  .web-navbar {
    position: sticky;
    top: 0;
    z-index: 40;
    border-bottom: 1px solid var(--color-border, #E5DDD4);
  }
}
```

---

### Task 2.4: 更新全局样式 — 桌面端暗色模式

**Files:**
- Modify: `apps/tavern/client/src/app.scss`

- [ ] **Step 1: 添加桌面端暗色模式样式**

在 `app.scss` 的 `page.dark-mode { ... }` 块中添加：

```scss
page.dark-mode {
  // ... existing styles ...

  /* ── 桌面端侧边栏暗色模式 ── */
  @media (min-width: 1024px) {
    .desktop-sidebar {
      background: var(--color-bg-card, #161B22);
      border-right-color: var(--color-border, #30363D);
    }
  }
}
```

---

### Task 2.5: 确保 weapp 不受影响

**Files:**
- No changes needed — weapp 已验证不受影响

- [ ] **Step 1: 验证 weapp 兼容性**

确认以下关键点：
1. `DesktopLayout` 仅在 `process.env.TARO_ENV === 'h5'` 时渲染 → weapp 不受影响 ✅
2. `DesktopSidebar` 仅被 `DesktopLayout` 引用 → weapp 不会加载 ✅
3. `custom-tab-bar` 在 weapp 中不受 `@media` 影响 → 正常工作 ✅
4. `gameStore.leaveGame()` 是新增方法，不影响现有 `disableGameMode()` → 向后兼容 ✅

---

## 验证清单

- [ ] 所有修改文件的 `lsp_diagnostics` 无错误
- [ ] `npm run type-check` 通过（如果项目配置了）
- [ ] H5 构建 `npm run build:h5` 无报错
- [ ] weapp 构建 `npm run build:weapp` 无报错
