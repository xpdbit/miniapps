import adminApiClient from '@/services/adminApiClient'

// ─── Types（匹配 game1-server 实际响应字段）───

export interface Game1Player {
  id: number
  openid: string
  nickname: string | null
  avatarUrl: string | null
  level: number
  exp: number                // Game1 返回 exp（非 experience）
  totalMileage: number       // Game1 返回 totalMileage（非 mileage）
  playTime: number
  prestigeCount: number      // Game1 返回 prestigeCount（非 rebirthCount）
  loginDays: number
  lastLoginAt: string | null
  createdAt: string
}

export interface Game1DashboardStats {
  totalPlayers: number
  todayNewPlayers: number    // Game1 返回 todayNewPlayers（非 newPlayersToday）
  weekNewPlayers: number     // Game1 返回 weekNewPlayers（非 newPlayersThisWeek）
  totalPvpMatches: number
  todayPvpMatches: number
  totalCloudSaves: number
  activeStats: {             // Game1 返回对象而非数字
    totalPlayers: number
    activePlayers: number
    newPlayers: number
    periodDays: number
  }
}

export interface Game1PlayerListResponse {
  items: Game1Player[]       // Game1 返回 items（非 players）
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface Game1ConfigEntry {
  key: string
  value: string
  updatedAt: string
}

export interface AchievementDefinition {
  id: string
  title: string
  description: string
  condition: string
  unlockedCount: number
  totalPlayers: number
}

export interface PvpLeaderboardEntry {
  rank: number
  playerName: string
  tier: string
  rating: number
  winRate: string
}

export interface PvpLeaderboardResponse {
  items: PvpLeaderboardEntry[]
}

/** 通用 API 响应包装 */
interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

// ─── Admin API ─────────────────────────────────────────────

export const game1AdminApi = {
  /** 运营数据概览 */
  getDashboard: async () => {
    const res = await adminApiClient.get<ApiResponse<Game1DashboardStats>>('/admin/game1/dashboard')
    return res.data
  },

  /** 玩家列表 */
  getPlayers: async (params?: {
    page?: number
    pageSize?: number
    search?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }) => {
    const res = await adminApiClient.get<ApiResponse<Game1PlayerListResponse>>('/admin/game1/players', { params })
    return res.data
  },

  /** 软删除玩家 */
  softDeletePlayer: async (playerId: number) => {
    const res = await adminApiClient.delete<ApiResponse<null>>(`/admin/game1/players/${playerId}`)
    return res.data
  },

  /** 成就列表 */
  getAchievements: async (params?: { page?: number; pageSize?: number }) => {
    const res = await adminApiClient.get<ApiResponse<{ items: AchievementDefinition[] }>>('/admin/game1/achievements', { params })
    return res.data
  },

  /** PVP 排行榜 */
  getPvpLeaderboard: async (params?: { limit?: number; offset?: number }) => {
    const res = await adminApiClient.get<ApiResponse<PvpLeaderboardResponse>>('/admin/game1/pvp/leaderboard', { params })
    return res.data
  },
}

// ─── Config API ────────────────────────────────────────────

export const game1ConfigApi = {
  /** 获取所有配置键 */
  listKeys: async () => {
    const res = await adminApiClient.get<ApiResponse<string[]>>('/admin/game1/config/keys')
    return res.data
  },

  /** 获取单个配置 */
  getValue: async (key: string) => {
    const res = await adminApiClient.get<ApiResponse<Game1ConfigEntry>>(`/admin/game1/config/${key}`)
    return res.data
  },

  /** 更新配置 */
  updateConfig: async (key: string, value: string) => {
    const res = await adminApiClient.put<ApiResponse<null>>(`/admin/game1/config/${key}`, { key, value })
    return res.data
  },
}
