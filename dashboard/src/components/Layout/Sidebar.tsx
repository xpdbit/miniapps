import { Menu, Typography } from 'antd'
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
  TeamOutlined,
  SlidersOutlined,
  ThunderboltOutlined,
  ContainerOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES, MENU_ITEMS, type ProjectScope } from '@/constants/routes'
import { PERMISSIONS, type Permission } from '@/constants/permissions'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'

const { Text } = Typography

interface MenuItemConfig {
  key: string
  icon: React.ReactNode
  label: string
  /** Required permission (undefined = super_admin only) */
  permission?: Permission
  /** 鎵€灞為」鐩綔鐢ㄥ煙 */
  scope: ProjectScope
}

/** 鍥炬爣鏄犲皠 */
const ICON_MAP: Record<string, React.ReactNode> = {
  [ROUTES.DASHBOARD]: <DashboardOutlined />,
  [ROUTES.TAVERN]: <CommentOutlined />,
  [ROUTES.TAVERN_CHATS]: <ContainerOutlined />,
  [ROUTES.TAVERN_KEYS]: <KeyOutlined />,
  [ROUTES.TAVERN_CARDS]: <AppstoreOutlined />,
  [ROUTES.USERS]: <UserOutlined />,
  [ROUTES.FOOD_RECORDS]: <FileTextOutlined />,
  [ROUTES.THEMES]: <SkinOutlined />,
  [ROUTES.THEME_CLASSES]: <AppstoreOutlined />,
  [ROUTES.ACHIEVEMENTS]: <TrophyOutlined />,
  [ROUTES.API_KEYS]: <KeyOutlined />,
  [ROUTES.GAME1_PLAYERS]: <TeamOutlined />,
  [ROUTES.GAME1_CONFIG]: <SlidersOutlined />,
  [ROUTES.GAME1_ACHIEVEMENTS]: <TrophyOutlined />,
  [ROUTES.GAME1_PVP]: <ThunderboltOutlined />,
  [ROUTES.PROJECTS]: <SettingOutlined />,
  [ROUTES.MONITORING]: <MonitorOutlined />,
  [ROUTES.ADMIN]: <SettingOutlined />,
  [ROUTES.AUDIT_LOGS]: <AuditOutlined />,
}

/** 瀹屾暣鑿滃崟閰嶇疆 */
const getMenuItems = (): MenuItemConfig[] => MENU_ITEMS.map((item) => ({
  key: item.path,
  icon: ICON_MAP[item.path] || <SettingOutlined />,
  label: item.label,
  permission: ROUTE_PERMISSION_MAP[item.path],
  scope: item.scope,
}))

/** 璺敱 鈫?鏉冮檺鏄犲皠锛堝弽鍚戝紩鐢級 */
const ROUTE_PERMISSION_MAP: Record<string, Permission> = {
  [ROUTES.DASHBOARD]: PERMISSIONS.DASHBOARD,
  [ROUTES.USERS]: PERMISSIONS.USERS,
  [ROUTES.FOOD_RECORDS]: PERMISSIONS.RECORDS,
  [ROUTES.THEMES]: PERMISSIONS.THEMES,
  [ROUTES.THEME_CLASSES]: PERMISSIONS.THEMES,
  [ROUTES.ACHIEVEMENTS]: PERMISSIONS.ACHIEVEMENTS,
  [ROUTES.API_KEYS]: PERMISSIONS.KEYS,
  [ROUTES.MONITORING]: PERMISSIONS.MONITORING,
  [ROUTES.TAVERN]: PERMISSIONS.TAVERN,
  [ROUTES.TAVERN_CHATS]: PERMISSIONS.TAVERN_CHATS,
  [ROUTES.TAVERN_KEYS]: PERMISSIONS.TAVERN_KEYS,
  [ROUTES.TAVERN_CARDS]: PERMISSIONS.TAVERN_CARDS,
  [ROUTES.GAME1_PLAYERS]: PERMISSIONS.GAME1_PLAYERS,
  [ROUTES.GAME1_CONFIG]: PERMISSIONS.GAME1_CONFIG,
  [ROUTES.GAME1_ACHIEVEMENTS]: PERMISSIONS.GAME1_ACHIEVEMENTS,
  [ROUTES.GAME1_PVP]: PERMISSIONS.GAME1_PVP,
}

/**
 * 鏍规嵁褰撳墠閫変腑椤圭洰杩囨护鑿滃崟
 * - currentProject=null锛堝叏灞€锛? 鍙樉绀?scope=null 鐨勯」鐩?
 * - currentProject=FTG: 鏄剧ず scope=null + scope=ftg
 * - currentProject=Game1: 鏄剧ず scope=null + scope=game1
 * - currentProject=Tavern: 鏄剧ず scope=null + scope=tavern
 */
const getProjectScope = (projectName: string | undefined): ProjectScope => {
  if (!projectName) return null
  const name = projectName.toLowerCase()
  if (name.includes('ftg') || name.includes('food')) return 'ftg'
  if (name.includes('game1') || name.includes('game')) return 'game1'
  if (name.includes('tavern') || name.includes('ai')) return 'tavern'
  return null
}

const Sidebar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const currentProject = useProjectStore((s) => s.currentProject)

  const role = user?.role
  const activeScope = getProjectScope(currentProject?.name)

  const allItems = getMenuItems()

  const filteredItems: MenuProps['items'] = allItems
    .filter((item) => {
      // 鏉冮檺杩囨护
      if (!role) return false
      if (item.permission) {
        if (!hasPermission(item.permission)) return false
      } else if (role !== 'super_admin') {
        return false
      }

      // 椤圭洰浣滅敤鍩熻繃婊?
      if (activeScope === null) {
        // 鍏ㄥ眬瑙嗗浘锛氬彧鏄剧ず璺ㄩ」鐩彍鍗?
        return item.scope === null
      }
      // 椤圭洰瑙嗗浘锛氭樉绀鸿法椤圭洰 + 褰撳墠椤圭洰涓撳睘鑿滃崟
      return item.scope === null || item.scope === activeScope
    })
    .map(({ key, icon, label }) => ({ key, icon, label }))

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 椤圭洰淇℃伅澶?*/}
      {activeScope && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Text
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {activeScope === 'ftg' ? 'FTG' : activeScope === 'game1' ? 'GAME1' : 'TAVERN'}
          </Text>
          <div
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: 14,
              fontWeight: 600,
              marginTop: 2,
            }}
          >
            {currentProject?.name || ''}
          </div>
        </div>
      )}

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={filteredItems}
        onClick={({ key }) => navigate(key)}
        style={{ flex: 1, borderInlineEnd: 'none' }}
      />
    </div>
  )
}

export default Sidebar
