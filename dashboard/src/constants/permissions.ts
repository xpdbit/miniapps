/** 所有可用的权限名称 */
export const PERMISSIONS = {
  DASHBOARD: 'dashboard',
  USERS: 'users',
  RECORDS: 'records',
  THEMES: 'themes',
  ACHIEVEMENTS: 'achievements',
  KEYS: 'keys',
  MONITORING: 'monitoring',
  TAVERN: 'tavern',
  // Game1 权限
  GAME1_PLAYERS: 'game1_players',
  GAME1_CONFIG: 'game1_config',
  GAME1_ACHIEVEMENTS: 'game1_achievements',
  GAME1_PVP: 'game1_pvp',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/**
 * RBAC 角色权限映射表
 * super_admin: 所有权限
 * admin: dashboard, users, records, themes, achievements, keys, monitoring, tavern
 * viewer: dashboard, monitoring（只读）
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: Object.values(PERMISSIONS),
  admin: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.USERS,
    PERMISSIONS.RECORDS,
    PERMISSIONS.THEMES,
    PERMISSIONS.ACHIEVEMENTS,
    PERMISSIONS.KEYS,
    PERMISSIONS.MONITORING,
    PERMISSIONS.TAVERN,
    PERMISSIONS.GAME1_PLAYERS,
    PERMISSIONS.GAME1_CONFIG,
    PERMISSIONS.GAME1_ACHIEVEMENTS,
    PERMISSIONS.GAME1_PVP,
  ],
  viewer: [PERMISSIONS.DASHBOARD, PERMISSIONS.MONITORING],
}

/** 检查角色是否有指定权限 */
export function hasPermission(role: string | undefined, permission: Permission): boolean {
  if (!role) return false
  const permissions = ROLE_PERMISSIONS[role]
  if (!permissions) return false
  return permissions.includes(permission)
}

/** 路由路径 → 所需权限的映射 */
export const ROUTE_PERMISSION_MAP: Record<string, Permission> = {
  '/dashboard': PERMISSIONS.DASHBOARD,
  '/users': PERMISSIONS.USERS,
  '/food-records': PERMISSIONS.RECORDS,
  '/themes': PERMISSIONS.THEMES,
  '/theme-classes': PERMISSIONS.THEMES,
  '/achievements': PERMISSIONS.ACHIEVEMENTS,
  '/api-keys': PERMISSIONS.KEYS,
  '/monitoring': PERMISSIONS.MONITORING,
  '/tavern': PERMISSIONS.TAVERN,
  '/game1/players': PERMISSIONS.GAME1_PLAYERS,
  '/game1/config': PERMISSIONS.GAME1_CONFIG,
  '/game1/achievements': PERMISSIONS.GAME1_ACHIEVEMENTS,
  '/game1/pvp': PERMISSIONS.GAME1_PVP,
}
