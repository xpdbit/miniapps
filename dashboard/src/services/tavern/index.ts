/**
 * AI-Tavern API 服务
 * 通过 Dashboard Admin API 代理（/api/admin/tavern/*）或直接代理（/api/tavern/*）
 * 调用 Tavern Server 的管理接口
 */
import adminApiClient from '@/services/adminApiClient'

// ─── Types ──────────────────────────────────────────────────

export interface TavernCharacter {
  id: string
  name: string
  creator: {
    id: string
    nickname: string
  }
  status: string
  chatCount: number
  likeCount: number
  createdAt: string
}

export interface TavernStats {
  totalCharacters: number
  totalChats: number
  activeUsers: number
  pendingReviews: number
}

export interface CharactersResponse {
  items: TavernCharacter[]
  total: number
}

export interface ModerationLog {
  id: string
  action: string
  operatorId: string
  reason: string | null
  createdAt: string
}

// ─── Admin API ─────────────────────────────────────────────

export const tavernAdminApi = {
  /** 获取角色卡列表 */
  getCharacters: (params?: { page?: number; pageSize?: number }) =>
    adminApiClient.get<CharactersResponse>('/admin/tavern/characters', { params }),

  /** 获取仪表盘统计 */
  getStats: () =>
    adminApiClient.get<TavernStats>('/admin/tavern/dashboard/stats'),

  /** 待审核列表 */
  getPendingList: (page?: number) =>
    adminApiClient.get<TavernCharacter[]>('/admin/tavern/pending', { params: { page } }),

  /** 批准角色卡 */
  approveCharacter: (id: string) =>
    adminApiClient.post(`/admin/tavern/approve/${id}`),

  /** 拒绝角色卡 */
  rejectCharacter: (id: string, reason?: string) =>
    adminApiClient.post(`/admin/tavern/reject/${id}`, { reason }),

  /** 封禁角色卡 */
  banCharacter: (id: string, reason?: string) =>
    adminApiClient.post(`/admin/tavern/ban/${id}`, { reason }),

  /** 获取审核日志 */
  getModerationLogs: (cardId: string) =>
    adminApiClient.get<ModerationLog[]>(`/admin/tavern/logs/${cardId}`),
}
