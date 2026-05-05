import { useEffect, lazy, Suspense } from 'react'
import { ConfigProvider, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
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
const NotFound = lazy(() => import('@/pages/NotFound'))

// ─── 全局加载态 ──────────────────────────────────────
const PageLoading = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
    }}
  >
    <Spin size="large" />
  </div>
)

const App = () => {
  const restoreSession = useAuthStore((state) => state.restoreSession)

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 6,
          },
        }}
      >
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
      </ConfigProvider>
    </QueryClientProvider>
  )
}

export default App
