import { create } from 'zustand'

interface ThemeState {
  isDark: boolean
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: localStorage.getItem('dashboard_theme') === 'dark',
  toggleTheme: () =>
    set((state) => {
      const next = !state.isDark
      localStorage.setItem('dashboard_theme', next ? 'dark' : 'light')
      return { isDark: next }
    }),
}))
