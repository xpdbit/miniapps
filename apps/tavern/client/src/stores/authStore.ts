import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { httpClient } from '@/services/httpClient'

interface UserInfo {
  uuid: string
  nickname?: string
  avatar_url?: string
  role: string
}

export interface TierInfo {
  tier: 'FREE' | 'PAID' | 'TESTER'
  level: number
  maxDailyQuota: number
  maxSessions: number
  maxCharacters: number
  maxPersonas: number
  permissions: Record<string, unknown>
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: UserInfo | null
  tier: TierInfo | null
  isLoggedIn: boolean
  initialized: boolean
  loginError: string | null

  initialize: () => Promise<void>
  wechatLogin: (code: string) => Promise<void>
  passwordLogin: (username: string, password: string) => Promise<void>
  logout: () => void
  restoreSession: () => Promise<void>
  refreshQuota: () => Promise<void>
  fetchTier: () => Promise<void>
  retryLogin: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  tier: null,
  isLoggedIn: false,
  initialized: false,
  loginError: null,

  initialize: async () => {
    if (get().initialized) return
    try {
      const savedToken = Taro.getStorageSync<string | null>('tavern_token')
      if (savedToken) {
        try {
          const res = await httpClient.get<{ code: number; data: { user: UserInfo } }>('/auth/me')
          if (res.code === 0 && res.data?.user) {
            set({
              token: savedToken,
              user: res.data.user,
              isLoggedIn: true,
              initialized: true,
            })
            return
          }
        } catch {
          Taro.removeStorageSync('tavern_token')
        }
      }
      // No valid token → show login prompt
      set({ initialized: true })
    } catch {
      set({ initialized: true })
    }
  },

  /** 微信一键登录 */
  wechatLogin: async (code: string) => {
    const res = await httpClient.post<{
      code: number
      message?: string
      data?: { access_token: string; refresh_token: string; user: UserInfo }
    }>('/auth/wechat/login', { wx_code: code })

    if (res.code !== 0) { // code 0 = success (tavern convention)
      throw new Error(res.message || '微信登录失败')
    }
    if (!res.data) throw new Error('登录响应异常')

    const { access_token, refresh_token, user } = res.data
    Taro.setStorageSync('tavern_token', access_token)
    if (refresh_token) {
      Taro.setStorageSync('tavern_refresh_token', refresh_token)
    }
    set({ token: access_token, refreshToken: refresh_token, user, isLoggedIn: true, loginError: null })
  },

  /** 账号密码登录 */
  passwordLogin: async (username: string, password: string) => {
    const res = await httpClient.post<{
      code: number
      message?: string
      data?: { access_token: string; refresh_token: string; user: UserInfo }
    }>('/auth/login', { credential: username, password })

    if (res.code !== 0) {
      throw new Error(res.message || '用户名或密码错误')
    }
    if (!res.data) throw new Error('登录响应异常')

    const { access_token, refresh_token, user } = res.data
    Taro.setStorageSync('tavern_token', access_token)
    if (refresh_token) {
      Taro.setStorageSync('tavern_refresh_token', refresh_token)
    }
    set({ token: access_token, refreshToken: refresh_token, user, isLoggedIn: true, loginError: null })
  },

  logout: () => {
    Taro.removeStorageSync('tavern_token')
    Taro.removeStorageSync('tavern_refresh_token')
    set({ token: null, refreshToken: null, user: null, isLoggedIn: false, loginError: null })
  },

  restoreSession: async () => {
    try {
      const savedToken = Taro.getStorageSync<string | null>('tavern_token')
      if (!savedToken) {
        set({ initialized: true })
        return
      }
      set({ token: savedToken })
      const res = await httpClient.get<{ code: number; data: { user: UserInfo } }>('/auth/me')
      if (res.code === 0 && res.data?.user) {
        set({ user: res.data.user, isLoggedIn: true, initialized: true })
      } else {
        throw new Error('Session invalid')
      }
    } catch {
      Taro.removeStorageSync('tavern_token')
      Taro.removeStorageSync('tavern_refresh_token')
      set({ token: null, refreshToken: null, user: null, isLoggedIn: false, initialized: true })
    }
  },

  refreshQuota: async () => {
    try {
      const res = await httpClient.get<{ code: number; data: { user: UserInfo } }>('/auth/me')
      if (res.code === 0 && res.data?.user) {
        set({ user: res.data.user })
      }
    } catch {
      // ignore
    }
  },

  fetchTier: async () => {
    try {
      const res = await httpClient.get<{ code: number; data: TierInfo }>('/user/tier')
      if (res.code === 0 && res.data) {
        set({ tier: res.data })
      }
    } catch {
      // ignore
    }
  },

  retryLogin: async () => {
    set({ loginError: null })
    const savedToken = Taro.getStorageSync<string | null>('tavern_token')
    if (savedToken) {
      try {
        const res = await httpClient.get<{ code: number; data: { user: UserInfo } }>('/auth/me')
        if (res.code === 0 && res.data?.user) {
          set({ token: savedToken, user: res.data.user, isLoggedIn: true, initialized: true })
          Taro.showToast({ title: '登录成功', icon: 'success' })
          return
        }
      } catch {
        Taro.removeStorageSync('tavern_token')
        Taro.removeStorageSync('tavern_refresh_token')
      }
    }
    // Token invalid → don't auto-login, show login prompt
    set({ loginError: '请登录后使用完整功能' })
  },
}))
