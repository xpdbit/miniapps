import adminApiClient from './adminApiClient'
import type { Project } from '@/types'

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

interface ProjectListData {
  projects: Project[]
}

interface ProjectData {
  project: Project
}

export const projectApi = {
  list: () => adminApiClient.get<ApiResponse<ProjectListData>>('/admin/projects'),

  create: (data: { name: string; apiBaseUrl: string; description?: string }) =>
    adminApiClient.post<ApiResponse<ProjectData>>('/admin/projects', data),

  update: (id: string, data: Partial<Pick<Project, 'name' | 'apiBaseUrl' | 'description' | 'status'>>) =>
    adminApiClient.put<ApiResponse<ProjectData>>(`/admin/projects/${id}`, data),

  delete: (id: string) =>
    adminApiClient.delete<ApiResponse<null>>(`/admin/projects/${id}`),

  testConnection: (id: string) =>
    adminApiClient.post<ApiResponse<{ status: number | string; data?: unknown }>>(`/admin/projects/${id}/test`),
}
