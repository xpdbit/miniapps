/**
 * themeStore — 日夜模式切换
 *
 * H5: localStorage 持久化 + document.documentElement class 切换
 *     同时给 html 和 body 添加 dark-mode 类：
 *     - html.dark-mode → index.html FOUC 防护 + 全局 body 背景
 *     - body.dark-mode → Taro H5 编译 page { } → body { } 的暗色变量覆盖
 * 小程序: Taro Storage 持久化 + eventCenter 事件广播
 *
 * 与 app.ts 中已有的 darkModeChange 事件向后兼容 —
 * 切换主题时同时触发 Taro.eventCenter.trigger('darkModeChange', isDark)
 */
import { create } from 'zustand'
import Taro from '@tarojs/taro'

const STORAGE_KEY = 'tavern_dark_mode'
const isH5 = process.env.TARO_ENV === 'h5'

function readStoredDark(): boolean {
  try {
    if (isH5) {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    }
    const val = Taro.getStorageSync(STORAGE_KEY)
    return val === true || val === 'true'
  } catch {
    return false
  }
}

function writeStoredDark(isDark: boolean): void {
  try {
    if (isH5) {
      localStorage.setItem(STORAGE_KEY, isDark ? 'true' : 'false')
    } else {
      Taro.setStorageSync(STORAGE_KEY, isDark)
    }
  } catch {
    // 静默处理存储失败
  }
}

function applyDarkClass(enable: boolean): void {
  try {
    if (isH5) {
      // 同时给 html（FOUC + body 背景）和 body（Taro page→body 编译）添加
      document.documentElement.classList.toggle('dark-mode', enable)
      document.body.classList.toggle('dark-mode', enable)
    }
  } catch {
    // ignore
  }
}

interface ThemeState {
  isDark: boolean
  /** 初始化：从存储恢复并应用 */
  init: () => void
  /** 切换亮/暗模式 */
  toggle: () => void
  /** 直接设置模式 */
  setDark: (isDark: boolean) => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: readStoredDark(),

  init: () => {
    const isDark = get().isDark
    applyDarkClass(isDark)
  },

  toggle: () => {
    const next = !get().isDark
    set({ isDark: next })
    writeStoredDark(next)
    applyDarkClass(next)
    // 向后兼容：通知 app.ts 中已有的监听逻辑
    Taro.eventCenter.trigger('darkModeChange', next)
  },

  setDark: (isDark: boolean) => {
    set({ isDark })
    writeStoredDark(isDark)
    applyDarkClass(isDark)
    Taro.eventCenter.trigger('darkModeChange', isDark)
  },
}))
