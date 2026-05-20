import { create } from 'zustand'
import * as authApi from '../services/authApi'
import { getToken, setToken, removeToken, setRememberMe } from '../utils/token'
import { hasPermission, type Permission } from '../constants/permissions'

interface AdminUser {
  uuid: string
  nickname: string | null
  role: string
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: AdminUser | null
  isAuthenticated: boolean
  initialized: boolean
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => void
  restoreSession: () => Promise<void>
  hasPermission: (permission: Permission) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getToken(),
  refreshToken: localStorage.getItem('refresh_token'),
  user: null,
  isAuthenticated: !!getToken(),
  initialized: false,

  login: async (username: string, password: string, rememberMe = true) => {
    setRememberMe(rememberMe)
    const { access_token, refresh_token, user } = await authApi.login({ username, password })
    setToken(access_token)
    if (refresh_token) {
      localStorage.setItem('refresh_token', refresh_token)
    }
    set({ token: access_token, refreshToken: refresh_token, user, isAuthenticated: true, initialized: true })
  },

  logout: () => {
    removeToken()
    localStorage.removeItem('refresh_token')
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false })
  },

  restoreSession: async () => {
    const token = getToken()
    if (!token) {
      set({ token: null, user: null, isAuthenticated: false, initialized: true })
      return
    }

    try {
      const user = await authApi.getMe()
      set({ token, user, isAuthenticated: true, initialized: true })
    } catch (error) {
      console.error('[Auth] restoreSession 失败:', error)
      // Try refreshing the token
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const newToken = await authApi.refreshToken(refreshToken)
          setToken(newToken)
          const user = await authApi.getMe()
          set({ token: newToken, user, isAuthenticated: true, initialized: true })
          return
        } catch {
          // Refresh failed, clear everything
        }
      }
      removeToken()
      localStorage.removeItem('refresh_token')
      set({ token: null, refreshToken: null, user: null, isAuthenticated: false, initialized: true })
    }
  },

  hasPermission: (permission: Permission) => {
    const state = get()
    return hasPermission(state.user?.role, permission)
  },
}))
