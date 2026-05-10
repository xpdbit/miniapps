import { Menu } from 'antd'
import type { MenuProps } from 'antd'
import {
  DashboardOutlined,
  UserOutlined,
  FileTextOutlined,
  SkinOutlined,
  AppstoreOutlined,
  TrophyOutlined,
  KeyOutlined,
  MonitorOutlined,
  SettingOutlined,
  AuditOutlined,
  CommentOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { PERMISSIONS, type Permission } from '@/constants/permissions'
import { useAuthStore } from '@/stores/authStore'

interface MenuItemConfig {
  key: string
  icon: React.ReactNode
  label: string
  /** Required permission (undefined = super_admin only) */
  permission?: Permission
}

const menuItems: MenuItemConfig[] = [
  { key: ROUTES.DASHBOARD, icon: <DashboardOutlined />, label: '仪表盘', permission: PERMISSIONS.DASHBOARD },
  { key: ROUTES.TAVERN, icon: <CommentOutlined />, label: 'AI 酒馆', permission: PERMISSIONS.TAVERN },
  { key: ROUTES.USERS, icon: <UserOutlined />, label: '用户管理', permission: PERMISSIONS.USERS },
  { key: ROUTES.FOOD_RECORDS, icon: <FileTextOutlined />, label: '食物记录', permission: PERMISSIONS.RECORDS },
  { key: ROUTES.THEMES, icon: <SkinOutlined />, label: '主题管理', permission: PERMISSIONS.THEMES },
  { key: ROUTES.THEME_CLASSES, icon: <AppstoreOutlined />, label: 'Class 管理', permission: PERMISSIONS.THEMES },
  { key: ROUTES.ACHIEVEMENTS, icon: <TrophyOutlined />, label: '成就管理', permission: PERMISSIONS.ACHIEVEMENTS },
  { key: ROUTES.API_KEYS, icon: <KeyOutlined />, label: 'API密钥', permission: PERMISSIONS.KEYS },
  { key: ROUTES.PROJECTS, icon: <SettingOutlined />, label: '项目管理' }, // super_admin only
  { key: ROUTES.MONITORING, icon: <MonitorOutlined />, label: '系统监控', permission: PERMISSIONS.MONITORING },
  { key: ROUTES.ADMIN, icon: <SettingOutlined />, label: '管理员' }, // super_admin only
  { key: ROUTES.AUDIT_LOGS, icon: <AuditOutlined />, label: '审计日志' }, // super_admin only
]

const Sidebar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const hasPermission = useAuthStore((state) => state.hasPermission)

  const role = user?.role

  const filteredItems: MenuProps['items'] = menuItems
    .filter((item) => {
      if (!role) return false
      if (item.permission) {
        return hasPermission(item.permission)
      }
      // Items without a specific permission are super_admin only
      return role === 'super_admin'
    })
    .map(({ key, icon, label }) => ({ key, icon, label }))

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[location.pathname]}
      items={filteredItems}
      onClick={({ key }) => navigate(key)}
    />
  )
}

export default Sidebar
