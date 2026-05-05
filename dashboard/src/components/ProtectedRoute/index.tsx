import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { ROUTE_PERMISSION_MAP } from '@/constants/permissions'
import { useAuthStore } from '@/stores/authStore'
import Forbidden from '@/pages/Forbidden'

const ProtectedRoute = () => {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasPermission = useAuthStore((state) => state.hasPermission)

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
