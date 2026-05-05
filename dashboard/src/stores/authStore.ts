import { create } from 'zustand'
import * as authApi from '../services/authApi'
import { getToken, setToken, removeToken, setRememberMe } from '../utils/token'
import { hasPermission, type Permission } from '../constants/permissions'

interface AdminUser {
  id: number
  username: string
  role: string
}

interface AuthState {
  token: string | null
  user: AdminUser | null
  isAuthenticated: boolean
  /** 标记 restoreSession 是否已完成（无论成功/失败） */
  initialized: boolean
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => void
  restoreSession: () => Promise<void>
  hasPermission: (permission: Permission) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getToken(),
  user: null,
  isAuthenticated: !!getToken(),
  /** 初始化标志，避免 ProtectedRoute 在 user 尚未加载时就做权限判断 */
  initialized: false,

  login: async (username: string, password: string, rememberMe = true) => {
    setRememberMe(rememberMe)
    const { token, user } = await authApi.login({ username, password })
    setToken(token)
    set({ token, user, isAuthenticated: true, initialized: true })
  },

  logout: () => {
    removeToken()
    set({ token: null, user: null, isAuthenticated: false })
  },

  restoreSession: async () => {
    const token = getToken()
    if (!token) {
      set({ token: null, user: null, isAuthenticated: false, initialized: true })
      return
    }

    // Token exists — fetch user info (includes role) to verify session is still valid
    try {
      const user = await authApi.getMe()
      set({ token, user, isAuthenticated: true, initialized: true })
    } catch {
      // Token expired or invalid — clear session
      removeToken()
      set({ token: null, user: null, isAuthenticated: false, initialized: true })
    }
  },

  hasPermission: (permission: Permission) => {
    const state = get()
    return hasPermission(state.user?.role, permission)
  },
}))
