import adminApiClient from './adminApiClient'
import type { AdminRole } from '@/types'

export interface CreateAdminParams {
  username: string
  password: string
  role: AdminRole
}

export interface AdminUserResponse {
  success: boolean
  data: {
    users: Array<{
      id: number
      username: string
      role: AdminRole
      status: string
      createdAt: string
      updatedAt: string
    }>
  }
}

export interface RolesResponse {
  success: boolean
  data: {
    roles: Array<{
      name: AdminRole
      label: string
      permissions: string[]
    }>
  }
}

export interface SingleUserResponse {
  success: boolean
  data: {
    user: {
      id: number
      username: string
      role: AdminRole
      status: string
      createdAt: string
      updatedAt: string
    }
  }
}

export interface DeleteResponse {
  success: boolean
  message: string
}

export const adminApi = {
  /** 获取所有管理员 */
  list: () =>
    adminApiClient.get<AdminUserResponse>('/admin/users'),

  /** 获取角色列表 */
  getRoles: () =>
    adminApiClient.get<RolesResponse>('/admin/roles'),

  /** 创建管理员 */
  create: (data: CreateAdminParams) =>
    adminApiClient.post<SingleUserResponse>('/admin/users', data),

  /** 修改角色 */
  changeRole: (id: number, role: AdminRole) =>
    adminApiClient.put<SingleUserResponse>(`/admin/users/${id}/role`, { role }),

  /** 删除管理员 */
  delete: (id: number) =>
    adminApiClient.delete<DeleteResponse>(`/admin/users/${id}`),
}
