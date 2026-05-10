import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { httpClient } from '@/services/httpClient'

interface UserInfo {
  id: string
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

  login: (code: string) => Promise<void>
  logout: () => void
  restoreSession: () => Promise<void>
  refreshQuota: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoggedIn: false,
  initialized: false,

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