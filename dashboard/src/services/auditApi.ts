import adminApiClient from './adminApiClient'

// --- Types ---

export interface AuditLogItem {
  id: number
  adminId: number
  action: string
  targetType: string | null
  targetId: string | null
  details: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
  admin: { id: number; username: string }
}

interface AuditLogListData {
  list: AuditLogItem[]
  total: number
}

interface AuditLogActionsData {
  actions: string[]
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

// --- Query params ---

export interface AuditLogQueryParams {
  page?: number
  pageSize?: number
  adminId?: number
  action?: string
  startDate?: string
  endDate?: string
}

// --- API ---

interface AdminUserBrief {
  id: number
  username: string
}

interface AdminUsersData {
  users: AdminUserBrief[]
}

export const auditApi = {
  /** 获取审计日志列表（分页） */
  list: (params: AuditLogQueryParams = {}) =>
    adminApiClient.get<ApiResponse<AuditLogListData>>('/admin/audit-logs', { params }),

  /** 获取所有操作类型（用于筛选下拉） */
  getActions: () =>
    adminApiClient.get<ApiResponse<AuditLogActionsData>>('/admin/audit-logs/actions'),

  /** 获取所有管理员（用于操作人筛选下拉） */
  getAdminUsers: () =>
    adminApiClient.get<ApiResponse<AdminUsersData>>('/admin/users'),
}
