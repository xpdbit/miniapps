/** FTG 专属 API 服务 */
import apiClient from '@/services/apiClient'

// ─── Users API ─────────────────────────────────

export interface FtgUser {
  id: number
  nickname: string
  openid: string
  avatar: string
  foodRecordCount: number
  checkInCount: number
  registeredAt: string
  status: 'active' | 'disabled'
}

export interface FtgUserStats {
  totalFoodRecords: number
  totalCheckIns: number
  foodTypeDistribution: Array<{ type: string; count: number }>
  achievementProgress: Array<{ id: string; name: string; progress: number }>
  recentFoodRecords: Array<{ id: number; foodName: string; foodType: string; createdAt: string }>
}

export interface FtgUserListResponse {
  list: FtgUser[]
  total: number
}

export const ftgUsersApi = {
  list: (params?: {
    page?: number
    pageSize?: number
    keyword?: string
    startDate?: string
    endDate?: string
    status?: string
  }) => apiClient.get<FtgUserListResponse>('/users', { params }),

  getById: (id: number) =>
    apiClient.get<FtgUser>(`/users/${id}`),

  getStats: (userId: number) =>
    apiClient.get<FtgUserStats>(`/users/${userId}/stats`),

  update: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/users/${id}`, data),
}

// ─── Theme API ─────────────────────────────────

export interface Theme {
  id: string
  name: string
  shortName: string
  description: string
  templateMarkup: string
  isActive: boolean
  usageCount: number
  createdAt: string
}

export const ftgThemesApi = {
  list: (params?: { isActive?: boolean; projectId?: string }) =>
    apiClient.get<Theme[]>('/themes', { params }),
  getById: (themeId: string) =>
    apiClient.get<Theme>(`/themes/${themeId}`),
  create: (data: Record<string, unknown>) =>
    apiClient.post('/themes', data),
  update: (themeId: string, data: Record<string, unknown>) =>
    apiClient.put(`/themes/${themeId}`, data),
  delete: (themeId: string) =>
    apiClient.delete(`/themes/${themeId}`),
  toggleActive: (themeId: string) =>
    apiClient.patch(`/themes/${themeId}/toggle`),
}

// ─── Theme Classes API ─────────────────────────

export interface ThemeClassItem {
  id: string
  name: string
  cssProperties: Record<string, string>
  category: string
  createdAt: string
}

export const ftgClassesApi = {
  list: (params?: { projectId?: string; category?: string }) =>
    apiClient.get<ThemeClassItem[]>('/theme-classes', { params }),
  getById: (classId: string) =>
    apiClient.get<ThemeClassItem>(`/theme-classes/${classId}`),
  getAllowedProperties: () =>
    apiClient.get<string[]>('/theme-classes/allowed-properties'),
  create: (data: Record<string, unknown>) =>
    apiClient.post('/theme-classes', data),
  update: (classId: string, data: Record<string, unknown>) =>
    apiClient.put(`/theme-classes/${classId}`, data),
  delete: (classId: string) =>
    apiClient.delete(`/theme-classes/${classId}`),
}

// ─── Theme Render API ─────────────────────────

export const ftgRenderApi = {
  renderPreview: (data: {
    templateMarkup: string
    cssClassIds?: string[]
    data?: Record<string, string>
    mode?: 'h5' | 'miniapp'
  }) => apiClient.post('/theme/render-preview', data),
  render: (data: {
    templateMarkup: string
    cssClasses?: Record<string, string>[]
    data?: Record<string, string>
    mode?: 'h5' | 'miniapp'
  }) => apiClient.post('/theme/render', data),
}

// ─── Achievements API ─────────────────────────

export const ftgAchievementsApi = {
  list: () =>
    apiClient.get('/achievements'),
  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/achievements/${id}`, data),
}

// ─── API Keys API ─────────────────────────────

export const ftgKeysApi = {
  list: (params?: { userId?: number }) =>
    apiClient.get('/api-keys', { params }),
  create: (data: { userId: number; serviceName: string; apiKey: string }) =>
    apiClient.post('/api-keys', data),
  delete: (id: number) =>
    apiClient.delete(`/api-keys/${id}`),
}

// ─── Monitor API ──────────────────────────────

export const ftgMonitorApi = {
  health: () =>
    apiClient.get('/health'),
  stats: () =>
    apiClient.get('/monitor/stats'),
}
