import adminApiClient from './adminApiClient'

// --- Types ---

export interface DashboardStats {
  totalUsers: number
  newUsersToday: number
  newUsersThisMonth: number
  totalFoodRecords: number
  recognitionsToday: number
  totalCheckIns: number
  checkInsToday: number
}

export interface TrendItem {
  date: string
  value: number
}

export interface DistributionItem {
  type: string
  value: number
}

// --- Dashboard API ---

export const dashboardApi = {
  /** 聚合统计概览 */
  getStats: () =>
    adminApiClient.get<DashboardStats>('/admin/dashboard/stats'),

  /** 近30天识别量趋势 */
  getRecognitionTrend: () =>
    adminApiClient.get<TrendItem[]>('/admin/dashboard/stats/recognition-trend'),

  /** 近30天新用户趋势 */
  getUserTrend: () =>
    adminApiClient.get<TrendItem[]>('/admin/dashboard/stats/user-trend'),

  /** 食物类型分布 */
  getFoodTypeDistribution: () =>
    adminApiClient.get<DistributionItem[]>('/admin/dashboard/stats/food-type-distribution'),

  /** 主题使用分布 */
  getThemeUsageDistribution: () =>
    adminApiClient.get<DistributionItem[]>('/admin/dashboard/stats/theme-usage-distribution'),
}
