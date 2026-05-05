import adminApiClient from './adminApiClient'

// ─── 类型定义 ──────────────────────────────────────────────

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  conditionType: string
  conditionValue: number
  themeId: number | null
  themeName: string | null
  isPreset: boolean
  order: number
  createdAt?: string
  updatedAt?: string
}

export interface AchievementStats {
  totalUsers: number
  unlockedUsersCount: number
  overallUnlockRate: number
  achievementRates: Array<{
    achievementId: string
    achievementName: string
    unlockedCount: number
    totalCount: number
    rate: number
  }>
  recentUnlocks: Array<{
    id: number
    achievementId: string
    achievementName: string
    userName: string
    userOpenId: string
    unlockedAt: string
  }>
}

export interface UnlockedUser {
  id: number
  userName: string
  userOpenId: string
  unlockedAt: string
}

export interface AchievementUpdateData {
  icon?: string
  description?: string
  conditionValue?: number
  themeId?: number | null
}

// ─── API ────────────────────────────────────────────────────

export const achievementApi = {
  /** 获取所有成就定义 */
  list: () =>
    adminApiClient.get<{ success: boolean; data: { achievements: Achievement[] } }>('/admin/achievements'),

  /** 获取成就统计面板数据 */
  getStats: () =>
    adminApiClient.get<{ success: boolean; data: AchievementStats }>('/admin/achievements/stats'),

  /** 更新成就配置（只能修改图标、描述、条件值、关联主题） */
  update: (id: string, data: AchievementUpdateData) =>
    adminApiClient.put<{ success: boolean }>(`/admin/achievements/${id}`, data),

  /** 获取已解锁指定成就的用户列表 */
  getUnlockedUsers: (achievementId: string) =>
    adminApiClient.get<{ success: boolean; data: { users: UnlockedUser[] } }>(
      `/admin/achievements/${achievementId}/users`,
    ),

  /** 手动触发成就检测 */
  triggerCheck: (userOpenId: string, achievementId?: string) =>
    adminApiClient.post<{ success: boolean; data: { unlocked: string[] } }>(
      '/admin/achievements/trigger',
      { userOpenId, achievementId },
    ),
}
