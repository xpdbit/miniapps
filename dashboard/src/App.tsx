import { useEffect, useMemo, lazy, Suspense } from 'react'
import { ConfigProvider, App as AntApp, Skeleton, theme as antTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useThemeStore } from '@/stores/themeStore'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/services/query-client'
import { ROUTES } from '@/constants/routes'
import { useAuthStore } from '@/stores/authStore'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import Login from '@/pages/Login'

// ─── 懒加载页面组件 ──────────────────────────────────
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Users = lazy(() => import('@/pages/Users'))
const FoodRecords = lazy(() => import('@/pages/FoodRecords'))
const Themes = lazy(() => import('@/pages/Themes'))
const ThemeClasses = lazy(() => import('@/pages/ThemeClasses'))
const Achievements = lazy(() => import('@/pages/Achievements'))
const ApiKeys = lazy(() => import('@/pages/ApiKeys'))
const Monitoring = lazy(() => import('@/pages/Monitoring'))
const Admin = lazy(() => import('@/pages/Admin'))
const AuditLogs = lazy(() => import('@/pages/AuditLogs'))
const Projects = lazy(() => import('@/pages/Projects'))
const Game1Dashboard = lazy(() => import('@/pages/Game1Dashboard'))
const Game1Players = lazy(() => import('@/pages/Game1Players'))
const Game1Config = lazy(() => import('@/pages/Game1Config'))
const Game1Achievements = lazy(() => import('@/pages/Game1Achievements'))
const Game1Pvp = lazy(() => import('@/pages/Game1Pvp'))
const Tavern = lazy(() => import('@/pages/Tavern'))
const TavernCards = lazy(() => import('@/pages/Tavern/TavernCards'))
const TavernChats = lazy(() => import('@/pages/Tavern/TavernChats'))
const TavernKeys = lazy(() => import('@/pages/Tavern/TavernKeys'))
const TavernUsers = lazy(() => import('@/pages/Tavern/TavernUsers'))
const AiManager = lazy(() => import('@/pages/AiManager'))
const NotFound = lazy(() => import('@/pages/NotFound'))

// ─── 全局加载态 ──────────────────────────────────────
const PageLoading = () => (
  <div style={{ padding: 24 }}>
    <Skeleton active paragraph={{ rows: 4 }} />
  </div>
)

const App = () => {
  const restoreSession = useAuthStore((state) => state.restoreSession)
  const isDark = useThemeStore((state) => state.isDark)

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  const themeConfig = useMemo(
    () => ({
      algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      token: {
        colorPrimary: '#1677ff',
        colorSuccess: '#52c41a',
        colorWarning: '#faad14',
        colorError: '#ff4d4f',
        colorInfo: '#1677ff',
        borderRadius: 6,
        wireframe: false,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
        fontSize: 14,
        controlHeight: 36,
      },
      components: {
        Table: {
          headerBg: isDark ? '#1f1f1f' : '#fafafa',
          headerBorderRadius: 6,
          rowHoverBg: isDark ? '#2a2a2a' : '#f5f5f5',
        },
        Card: {
          paddingLG: 24,
        },
        Menu: {
          darkItemBg: '#001529',
          darkItemSelectedBg: '#1677ff',
        },
      },
    }),
    [isDark],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN} theme={themeConfig}>
        <AntApp>
        <BrowserRouter>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<Login />} />
          <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route
                path={ROUTES.DASHBOARD}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Dashboard />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.USERS}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Users />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.FOOD_RECORDS}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <FoodRecords />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.THEMES}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Themes />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.THEME_CLASSES}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <ThemeClasses />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.ACHIEVEMENTS}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Achievements />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.API_KEYS}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <ApiKeys />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.MONITORING}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Monitoring />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.ADMIN}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Admin />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.AUDIT_LOGS}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <AuditLogs />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.PROJECTS}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Projects />
                  </Suspense>
                }
              />
              {/* ── Tavern 页面 ── */}
              <Route
                path={ROUTES.TAVERN}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Tavern />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.TAVERN_CARDS}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <TavernCards />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.TAVERN_CHATS}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <TavernChats />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.TAVERN_KEYS}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <TavernKeys />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.TAVERN_MODELS}
                element={<Navigate to={`${ROUTES.AI_MANAGER}?tab=models`} replace />}
              />
              <Route
                path={ROUTES.TAVERN_USERS}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <TavernUsers />
                  </Suspense>
                }
              />
              {/* ── AI 管理 ── */}
              <Route
                path={ROUTES.AI_MANAGER}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <AiManager />
                  </Suspense>
                }
              />
              {/* ── Game1 页面 ── */}
              <Route
                path={ROUTES.GAME1_DASHBOARD}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Game1Dashboard />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.GAME1_PLAYERS}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Game1Players />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.GAME1_CONFIG}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Game1Config />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.GAME1_ACHIEVEMENTS}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Game1Achievements />
                  </Suspense>
                }
              />
              <Route
                path={ROUTES.GAME1_PVP}
                element={
                  <Suspense fallback={<PageLoading />}>
                    <Game1Pvp />
                  </Suspense>
                }
              />
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <Suspense fallback={<PageLoading />}>
                <NotFound />
              </Suspense>
            }
          />
        </Routes>
        </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

export default App
