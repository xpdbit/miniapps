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
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => void
  restoreSession: () => Promise<void>
  hasPermission: (permission: Permission) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getToken(),
  user: null,
  isAuthenticated: !!getToken(),

  login: async (username: string, password: string, rememberMe = true) => {
    setRememberMe(rememberMe)
    const { token, user } = await authApi.login({ username, password })
    setToken(token)
    set({ token, user, isAuthenticated: true })
  },

  logout: () => {
    removeToken()
    set({ token: null, user: null, isAuthenticated: false })
  },

  restoreSession: async () => {
    const token = getToken()
    if (!token) {
      set({ token: null, user: null, isAuthenticated: false })
      return
    }

    // Token exists — fetch user info (includes role) to verify session is still valid
    try {
      const user = await authApi.getMe()
      set({ token, user, isAuthenticated: true })
    } catch {
      // Token expired or invalid — clear session
      removeToken()
      set({ token: null, user: null, isAuthenticated: false })
    }
  },

  hasPermission: (permission: Permission) => {
    const state = get()
    return hasPermission(state.user?.role, permission)
  },
}))
