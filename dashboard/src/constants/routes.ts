/** 项目作用域标识 */
export type ProjectScope = 'ftg' | 'game1' | 'tavern' | 'system' | null

interface RouteItem {
  path: string
  /** 所属项目：null 表示跨项目通用 */
  scope: ProjectScope
  /** 显示标签 */
  label: string
}

/** 完整路由常量 */
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  USERS: '/users',
  FOOD_RECORDS: '/food-records',
  THEMES: '/themes',
  THEME_CLASSES: '/theme-classes',
  ACHIEVEMENTS: '/achievements',
  API_KEYS: '/api-keys',
  MONITORING: '/monitoring',
  ADMIN: '/admin',
  AUDIT_LOGS: '/audit-logs',
  PROJECTS: '/projects',
  TAVERN: '/tavern',
  TAVERN_CHATS: '/tavern/chats',
  TAVERN_KEYS: '/tavern/keys',
  TAVERN_CARDS: '/tavern/cards',
  TAVERN_USERS: '/tavern/users',
  TAVERN_MODELS: '/tavern/models',
  TAVERN_AI_SCRIPTS: '/tavern/ai-scripts',
  // Game1 路由
  GAME1_DASHBOARD: '/game1/dashboard',
  GAME1_PLAYERS: '/game1/players',
  GAME1_CONFIG: '/game1/config',
  GAME1_ACHIEVEMENTS: '/game1/achievements',
  GAME1_PVP: '/game1/pvp',
  AI_MANAGER: '/ai-manager',
  SYSTEM: '/system',
} as const

/**
 * 侧边栏菜单项定义（含项目作用域）
 * scope=null 表示跨项目通用
 */
export const MENU_ITEMS: RouteItem[] = [
  // ── 系统管理（scope: system）──
  { path: ROUTES.SYSTEM, scope: 'system', label: '系统概览' },
  { path: ROUTES.DASHBOARD, scope: 'system', label: '仪表盘' },
  { path: ROUTES.PROJECTS, scope: 'system', label: '项目管理' },
  { path: ROUTES.AI_MANAGER, scope: 'system', label: 'AI 管理' },
  { path: ROUTES.MONITORING, scope: 'system', label: '系统监控' },
  { path: ROUTES.USERS, scope: 'system', label: '用户管理' },
  { path: ROUTES.ADMIN, scope: 'system', label: '管理员' },
  { path: ROUTES.AUDIT_LOGS, scope: 'system', label: '审计日志' },
  // ── Tavern 专属 ──
  { path: ROUTES.TAVERN, scope: 'tavern', label: 'AI 酒馆' },
  { path: ROUTES.TAVERN_CARDS, scope: 'tavern', label: '卡片管理' },
  { path: ROUTES.TAVERN_CHATS, scope: 'tavern', label: '聊天监控' },
  { path: ROUTES.TAVERN_KEYS, scope: 'tavern', label: 'Key 管理' },
  { path: ROUTES.TAVERN_AI_SCRIPTS, scope: 'tavern', label: 'AI Script' },
  { path: ROUTES.TAVERN_USERS, scope: 'tavern', label: '用户管理' },
  { path: ROUTES.USERS, scope: 'tavern', label: '用户管理' },
  // ── FTG 专属 ──
  { path: ROUTES.FOOD_RECORDS, scope: 'ftg', label: '食物记录' },
  { path: ROUTES.THEMES, scope: 'ftg', label: '主题管理' },
  { path: ROUTES.THEME_CLASSES, scope: 'ftg', label: 'Class 管理' },
  { path: ROUTES.ACHIEVEMENTS, scope: 'ftg', label: '成就管理' },
  { path: ROUTES.API_KEYS, scope: 'ftg', label: 'API 密钥' },
  // ── Game1 专属 ──
  { path: ROUTES.GAME1_DASHBOARD, scope: 'game1', label: '运营概览' },
  { path: ROUTES.GAME1_PLAYERS, scope: 'game1', label: '玩家管理' },
  { path: ROUTES.GAME1_CONFIG, scope: 'game1', label: '游戏配置' },
  { path: ROUTES.GAME1_ACHIEVEMENTS, scope: 'game1', label: '成就管理' },
  { path: ROUTES.GAME1_PVP, scope: 'game1', label: 'PVP 排行' },
]

/** 找不到匹配项目时的兜底路由 */
export const PROJECT_FALLBACK: Record<string, string> = {
  ftg: ROUTES.DASHBOARD,
  game1: ROUTES.GAME1_PLAYERS,
  tavern: ROUTES.TAVERN,
}
