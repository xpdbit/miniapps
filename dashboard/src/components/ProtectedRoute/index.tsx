import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { ROUTES } from '@/constants/routes'
import { ROUTE_PERMISSION_MAP } from '@/constants/permissions'
import { useAuthStore } from '@/stores/authStore'
import Forbidden from '@/pages/Forbidden'

const ProtectedRoute = () => {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const initialized = useAuthStore((state) => state.initialized)
  const hasPermission = useAuthStore((state) => state.hasPermission)

  // 0. Wait for restoreSession to finish before making auth/permission decisions
  if (!initialized) {
    return (
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
  }

  // 1. Must be authenticated
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  // 2. Check route-specific permission if required
  const requiredPermission = ROUTE_PERMISSION_MAP[location.pathname]
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Forbidden />
  }

  return <Outlet />
}

export default ProtectedRoute
