import apiClient from './apiClient'
import adminApiClient from './adminApiClient'

// --- Users API ---
export const usersAPI = {
  list: (params?: {
    page?: number
    pageSize?: number
    keyword?: string
    startDate?: string
    endDate?: string
    status?: string
  }) => apiClient.get('/users', { params }),
  getById: (id: number) =>
    apiClient.get(`/users/${id}`),
  getStats: (userId: number) =>
    apiClient.get(`/users/${userId}/stats`),
  update: (id: number, data: Record<string, unknown>) =>
    apiClient.put(`/users/${id}`, data),
}

// --- Food Record Types ---
export interface FoodRecordListItem {
  id: number
  foodName: string
  foodType: string
  thumbnailUrl: string
  themeId: number
  themeName?: string
  userOpenId: string
  calories: number
  createdAt: string
  deletedAt: string | null
}

export interface FoodRecordDetail {
  id: number
  foodName: string
  foodType: string
  thumbnailUrl: string
  originalImageUrl: string
  themeImageUrl: string
  themeId: number
  themeName?: string
  userOpenId: string
  calories: number
  aiDescription: {
    short: string
    gameStyle: string
    detail: string
  }
  nutrition: {
    protein: number
    fiber?: number
    fat: number
    carbs: number
  }
  location: {
    latitude: number
    longitude: number
    locationName: string
  }
  checkInRecords?: Array<{
    id: number
    checkInDate: string
    mealType: string
  }>
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface FoodRecordListParams {
  page?: number
  pageSize?: number
  foodName?: string
  foodType?: string
  themeId?: number
  startDate?: string
  endDate?: string
  showDeleted?: boolean
}

// --- Food Records API (Admin API) ---
export const recordsAPI = {
  list: (params?: FoodRecordListParams) =>
    adminApiClient.get<{ success: boolean; data: { records: FoodRecordListItem[]; total: number; page: number; pageSize: number } }>('/admin/food-records', { params }),
  getById: (id: number) =>
    adminApiClient.get<{ success: boolean; data: { record: FoodRecordDetail } }>(`/admin/food-records/${id}`),
  delete: (id: number) =>
    adminApiClient.delete<{ success: boolean }>(`/admin/food-records/${id}`),
  restore: (id: number) =>
    adminApiClient.post<{ success: boolean }>(`/admin/food-records/${id}/restore`),
  batchDelete: (ids: number[]) =>
    adminApiClient.post<{ success: boolean }>('/admin/food-records/batch-delete', { ids }),
}

// --- Themes API ---
export const themesAPI = {
  list: (params?: { isActive?: boolean; projectId?: string }) =>
    apiClient.get('/themes', { params }),
  getById: (themeId: string) =>
    apiClient.get(`/themes/${themeId}`),
  getByShortName: (shortName: string) =>
    apiClient.get(`/themes/by-short/${shortName}`),
  getStats: (themeId: string) =>
    apiClient.get(`/themes/${themeId}/stats`),
  create: (data: Record<string, unknown>) =>
    apiClient.post('/themes', data),
  update: (themeId: string, data: Record<string, unknown>) =>
    apiClient.put(`/themes/${themeId}`, data),
  delete: (themeId: string) =>
    apiClient.delete(`/themes/${themeId}`),
  toggleActive: (themeId: string) =>
    apiClient.patch(`/themes/${themeId}/toggle`),
  recordUsage: (themeId: string, data: { recordId: string; userId: number }) =>
    apiClient.post(`/themes/${themeId}/usage`, data),
}

// --- Theme Classes API ---
export const themeClassesAPI = {
  list: (params?: { projectId?: string; category?: string }) =>
    apiClient.get('/theme-classes', { params }),
  getById: (classId: string) =>
    apiClient.get(`/theme-classes/${classId}`),
  getAllowedProperties: () =>
    apiClient.get('/theme-classes/allowed-properties'),
  create: (data: Record<string, unknown>) =>
    apiClient.post('/theme-classes', data),
  update: (classId: string, data: Record<string, unknown>) =>
    apiClient.put(`/theme-classes/${classId}`, data),
  delete: (classId: string) =>
    apiClient.delete(`/theme-classes/${classId}`),
}

// --- Theme Render API ---
export const themeRenderAPI = {
  renderPreview: (data: { templateMarkup: string; cssClassIds?: string[]; data?: Record<string, string>; mode?: 'h5' | 'miniapp' }) =>
    apiClient.post('/theme/render-preview', data),
  render: (data: { templateMarkup: string; cssClasses?: Record<string, string>[]; data?: Record<string, string>; mode?: 'h5' | 'miniapp' }) =>
    apiClient.post('/theme/render', data),
}

// --- Achievements API ---
export const achievementsAPI = {
  list: () =>
    apiClient.get('/achievements'),
  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/achievements/${id}`, data),
}

// --- API Keys API ---
export const keysAPI = {
  list: (params?: { userId?: number }) =>
    apiClient.get('/api-keys', { params }),
  create: (data: { userId: number; serviceName: string; apiKey: string }) =>
    apiClient.post('/api-keys', data),
  delete: (id: number) =>
    apiClient.delete(`/api-keys/${id}`),
}

// --- Monitoring API ---
export const monitorAPI = {
  health: () =>
    apiClient.get('/health'),
  stats: () =>
    apiClient.get('/monitor/stats'),
}
