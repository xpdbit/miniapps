import adminApiClient from './adminApiClient'

// ─── 类型定义 ──────────────────────────────────────────────

export type ApiKeyStatus = 'active' | 'inactive' | 'expired'

export interface ApiKey {
  id: number
  serviceName: string
  /** 密钥值（后端返回时已脱敏，仅用于展示 ****） */
  keyValue: string
  status: ApiKeyStatus
  /** 是否启用 */
  active: boolean
  createdAt: string
  updatedAt: string
  lastUsedAt: string | null
}

export interface CreateKeyRequest {
  serviceName: string
  keyValue: string
}

export interface UpdateKeyRequest {
  active?: boolean
  serviceName?: string
}

// ─── API ────────────────────────────────────────────────────

export const keysApi = {
  /** 获取所有 API 密钥 */
  list: () =>
    adminApiClient.get<{ success: boolean; data: { keys: ApiKey[] } }>('/admin/api-keys'),

  /** 创建密钥 */
  create: (data: CreateKeyRequest) =>
    adminApiClient.post<{ success: boolean; data: { key: ApiKey } }>('/admin/api-keys', data),

  /** 更新密钥（启用/禁用 / 修改） */
  update: (id: number, data: UpdateKeyRequest) =>
    adminApiClient.put<{ success: boolean; data: { key: ApiKey } }>(`/admin/api-keys/${id}`, data),

  /** 删除密钥 */
  delete: (id: number) =>
    adminApiClient.delete<{ success: boolean }>(`/admin/api-keys/${id}`),
}
