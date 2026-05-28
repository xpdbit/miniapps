/**
 * AI-Tavern API 服务
 * 通过 Dashboard Admin API 代理（/api/admin/tavern/*）或直接代理（/api/tavern/*）
 * 调用 Tavern Server 的管理接口
 */
import adminApiClient from '@/services/adminApiClient'

// ─── 响应展开工具 ─────────────────────────────────────────────

/**
 * 展开 Tavern API 统一响应格式 { code, data, message } → data
 * Tavern Server 所有管理接口均返回此格式，前端需展开后使用
 */
export function unwrapTavernResponse<T>(responseData: unknown): T {
  const body = responseData as { code?: number; data?: T }
  return body?.data as T
}

// ─── Types ──────────────────────────────────────────────────

export interface TavernCharacter {
  id: string
  name: string
  creator?: {
    id: string
    nickname: string
  }
  status: string
  locked: boolean
  chatCount: number
  likeCount: number
  createdAt: string
  updatedAt: string
  // 编辑/创建表单所需的扩展字段
  tags?: string[]
  description?: string
  avatar?: string
  prompt?: string
  scenario?: string
  firstMsg?: string
  cardType?: string
  isOfficial?: boolean
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

// ─── 聊天监控 Types ───────────────────────────────────────

export interface TavernChatItem {
  id: string
  userId: string
  userName: string
  characterId: string
  characterName: string
  messageCount: number
  createdAt: string
  lastMessageAt: string
}

export interface TavernChatStats {
  totalChatsToday: number
  activeConversations: number
  totalMessages: number
  averageSessionLength: number
}

export interface TavernChatMessage {
  id: string
  role: string
  content: string
  tokens: number | null
  createdAt: string
}

export interface TavernChatListResponse {
  items: TavernChatItem[]
  total: number
  page: number
  pageSize: number
}

export interface TavernChatMessagesResponse {
  items: TavernChatMessage[]
  total: number
  page: number
  pageSize: number
}

// ─── Key 管理 Types ────────────────────────────────────────

export interface TavernApiKeyItem {
  id: string
  userId: string
  userName: string
  provider: string
  isActive: boolean
  createdAt: string
}

export interface TavernApiKeyListResponse {
  items: TavernApiKeyItem[]
  total: number
  page: number
  pageSize: number
}

// ─── 模型管理 Types ─────────────────────────────────────

export interface TavernModelItem {
  modelId: string
  displayName: string
  provider: string
  description: string | null
  icon: string | null
  minTier: 'FREE' | 'PAID' | 'TESTER'
  minLevel: number
  quotaCost: number
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface TavernModelListResponse {
  items: TavernModelItem[]
  total: number
  page: number
  pageSize: number
}

// ─── 用户管理 Types ────────────────────────────────────────

export interface TavernUserItem {
  uuid: string
  nickname: string
  role: string
  status: string
  sessionCount: number
  messageCount: number
  tokensUsed: number
  cardCount: number
  createdAt: string
}

export interface TavernUserListResponse {
  items: TavernUserItem[]
  total: number
  page: number
  pageSize: number
}

// ─── Admin API ─────────────────────────────────────────────

export const tavernAdminApi = {
  /** 获取角色卡列表 */
  getCharacters: (params?: { page?: number; pageSize?: number; cardType?: string; status?: string; search?: string }) =>
    adminApiClient.get<CharactersResponse>('/admin/tavern/characters', { params }),

  /** 删除角色卡 */
  deleteCharacter: (id: string) =>
    adminApiClient.delete(`/admin/tavern/characters/${id}`),

  /** 锁定卡片 */
  lockCharacter: (id: string) =>
    adminApiClient.post(`/admin/tavern/characters/${id}/lock`),

  /** 解锁卡片 */
  unlockCharacter: (id: string) =>
    adminApiClient.post(`/admin/tavern/characters/${id}/unlock`),

  /** 管理员更新角色卡 */
  updateCharacter: (id: string, data: Record<string, unknown>) =>
    adminApiClient.put(`/admin/tavern/characters/${id}`, data),

  /** 管理员创建角色卡 */
  createCharacter: (data: Record<string, unknown>) =>
    adminApiClient.post('/admin/tavern/characters', data),

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

  // ── 聊天监控 ──
  /** 获取聊天会话列表 */
  getChats: (params?: { page?: number; pageSize?: number; characterId?: string; userId?: string; startDate?: string; endDate?: string }) =>
    adminApiClient.get<TavernChatListResponse>('/admin/tavern/chats', { params }),

  /** 获取聊天统计 */
  getChatStats: () =>
    adminApiClient.get<TavernChatStats>('/admin/tavern/chats/stats'),

  /** 获取聊天消息列表 */
  getChatMessages: (chatId: string, params?: { page?: number; pageSize?: number }) =>
    adminApiClient.get<TavernChatMessagesResponse>(`/admin/tavern/chats/${chatId}/messages`, { params }),

  // ── Key 管理 ──
  /** 获取用户 API Key 列表 */
  getApiKeys: (params?: { page?: number; pageSize?: number; userId?: string }) =>
    adminApiClient.get<TavernApiKeyListResponse>('/admin/tavern/keys', { params }),

  /** 吊销 API Key */
  revokeApiKey: (keyId: string) =>
    adminApiClient.post(`/admin/tavern/keys/${keyId}/revoke`),

  /** 批量导入角色卡 JSON */
  importCards: (cards: Record<string, unknown>[]) =>
    adminApiClient.post<{ created: number; failed: number; errors: string[] }>('/admin/tavern/import', { cards }),

  // ── 模型同步 ──
  /** 手动触发模型同步（从 One API 等服务商拉取最新模型列表） */
  syncModels: () =>
    adminApiClient.post<{ results: Array<{ provider: string; added: number; updated: number; deactivated: number; error?: string }>; summary: { total: number; success: number; failed: number; added: number; updated: number } }>('/admin/tavern/sync-models'),

  /** 获取模型列表（分页） */
  getModels: (params?: { page?: number; pageSize?: number; provider?: string; search?: string }) =>
    adminApiClient.get<TavernModelListResponse>('/admin/tavern/models', { params }),

  /** 更新模型（开关/等级/配额） */
  updateModel: (modelId: string, data: { isActive?: boolean; minTier?: 'FREE' | 'PAID' | 'TESTER'; minLevel?: number; quotaCost?: number }) =>
    adminApiClient.put(`/admin/tavern/models/${modelId}`, data),

  /** 获取模型统计信息 */
  getModelStats: () =>
    adminApiClient.get<{ total: number; active: number; byProvider: Array<{ provider: string; _count: { modelId: number } }> }>('/admin/tavern/model-stats'),

  // ── 用户管理 ──
  /** 获取用户列表 */
  getUsers: (params?: { page?: number; pageSize?: number; search?: string }) =>
    adminApiClient.get<TavernUserListResponse>('/admin/tavern/users', { params }),

  /** 封禁/解封用户 */
  banUser: (uuid: string, action: 'ban' | 'unban', reason?: string) =>
    adminApiClient.post(`/admin/tavern/users/${uuid}/ban`, { action, reason: reason || '管理员操作' }),

  /** 修改用户角色 */
  updateUserRole: (uuid: string, role: 'USER' | 'ADMIN') =>
    adminApiClient.put(`/admin/tavern/users/${uuid}/role`, { role }),

  // ── AI Script 管理 ──
  /** 获取事件注册表 */
  getAiScriptRegistry: () =>
    adminApiClient.get<Array<{ type: string; description: string; parameters: Record<string, unknown> }>>('/admin/tavern/ai-scripts/registry'),

  /** 获取游戏状态 */
  getAiScriptState: (saveId: string) =>
    adminApiClient.get(`/admin/tavern/ai-scripts/state/${saveId}`),

  /** 更新游戏状态 */
  updateAiScriptState: (saveId: string, data: Record<string, unknown>) =>
    adminApiClient.put(`/admin/tavern/ai-scripts/state/${saveId}`, data),

  /** 获取事件日志 */
  getAiScriptLogs: (saveId: string, params?: { limit?: number; offset?: number }) =>
    adminApiClient.get(`/admin/tavern/ai-scripts/logs/${saveId}`, { params }),
}
