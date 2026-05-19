import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { httpClient } from '@/services/httpClient'

interface UserInfo {
  id: string
  uuid?: string
  nickname?: string
  avatar?: string
  dailyQuota: number
  usedQuota: number
  role: 'USER' | 'ADMIN'
}

interface AuthState {
  token: string | null
  user: UserInfo | null
  isLoggedIn: boolean
  initialized: boolean

  initialize: () => Promise<void>
  login: (code: string) => Promise<void>
  logout: () => void
  restoreSession: () => Promise<void>
  refreshQuota: () => Promise<void>
}

/**
 * 生成 Mock code（H5/DevTools 调试用）
 * 服务端 dev_ 前缀 code 返回 mock 用户
 */
function generateMockCode(): string {
  return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoggedIn: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return
    try {
      const savedToken = Taro.getStorageSync<string | null>('tavern_token')
      if (savedToken) {
        // 有存储的 token → 验证有效性
        try {
          const res = await httpClient.get<{ data: UserInfo }>('/auth/me')
          set({ token: savedToken, user: res.data, isLoggedIn: true, initialized: true })
          return
        } catch {
          // token 无效 → 清除后重新登录
          Taro.removeStorageSync('tavern_token')
        }
      }

      // 无 token 或 token 失效 → 自动微信登录
      let code: string
      let isRealCode = false

      // 尝试 wx.login()
      try {
        const loginRes = await Taro.login({ timeout: 10000 })
        if (loginRes.code) {
          code = loginRes.code
          isRealCode = true
        } else {
          throw new Error('未获取到临时 code')
        }
      } catch {
        // wx.login() 失败（H5 环境等）→ 降级使用 Mock code
        code = generateMockCode()
      }

      // 尝试登录（失败时若为真实微信 code，自动降级 mock code 重试）
      try {
        const res = await httpClient.post<{ data: { token: string; user: UserInfo } }>('/auth/login', { code })
        const { token, user } = res.data
        Taro.setStorageSync('tavern_token', token)
        set({ token, user, isLoggedIn: true, initialized: true })
        return
      } catch {
        // 真实微信 code 登录失败（WECHAT_SECRET 未配置等）→ 降级 mock code
        if (isRealCode) {
          try {
            const mockCode = generateMockCode()
            const res = await httpClient.post<{ data: { token: string; user: UserInfo } }>(
              '/auth/login',
              { code: mockCode },
            )
            const { token, user } = res.data
            Taro.setStorageSync('tavern_token', token)
            set({ token, user, isLoggedIn: true, initialized: true })
            return
          } catch {
            // mock 登录也失败，继续 fallback
          }
        }
      }

      // 登录失败 → 用户以未登录状态使用
      set({ initialized: true })
    } catch {
      // 登录失败 → 用户以未登录状态使用
      set({ initialized: true })
    }
  },

  login: async (code: string) => {
    const res = await httpClient.post<{ data: { token: string; user: UserInfo } }>('/auth/login', { code })
    const { token, user } = res.data
    Taro.setStorageSync('tavern_token', token)
    set({ token, user, isLoggedIn: true })
  },

  logout: () => {
    Taro.removeStorageSync('tavern_token')
    set({ token: null, user: null, isLoggedIn: false })
  },

  restoreSession: async () => {
    try {
      const savedToken = Taro.getStorageSync('tavern_token')
      if (!savedToken) {
        set({ initialized: true })
        return
      }
      set({ token: savedToken })
      const res = await httpClient.get<{ data: UserInfo }>('/auth/me')
      set({ user: res.data, isLoggedIn: true, initialized: true })
    } catch {
      Taro.removeStorageSync('tavern_token')
      set({ token: null, user: null, isLoggedIn: false, initialized: true })
    }
  },

  refreshQuota: async () => {
    try {
      const res = await httpClient.get<{ data: UserInfo }>('/auth/me')
      set({ user: res.data })
    } catch {
      // ignore
    }
  },
}))
