import adminApiClient from './adminApiClient'

export interface AiProvider {
  id: string
  provider: string
  name: string
  apiKey?: string
  baseUrl?: string
  config?: {
    qpsLimit?: number
    hourlyLimit?: number
    dailyLimit?: number
    weight?: number
    fallbackProviders?: string[]
  }
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// 后端统一响应格式
interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

// 列表响应
interface ListData {
  providers: AiProvider[]
}

// 单条 Provider 响应
interface ProviderData {
  provider: AiProvider
}

// 测试连接响应
interface TestData {
  reachable: boolean
  statusCode: number | null
  message: string
}

// 同步结果条目
interface SyncResult {
  provider: string
  action: 'created' | 'updated'
}

// 同步响应
interface SyncData {
  results: SyncResult[]
}

export const aiManagerApi = {
  list: (params?: { isActive?: boolean }) =>
    adminApiClient.get<ApiResponse<ListData>>('/admin/ai-manager', { params }),

  get: (provider: string) =>
    adminApiClient.get<ApiResponse<ProviderData>>(`/admin/ai-manager/${provider}`),

  create: (data: Partial<AiProvider>) =>
    adminApiClient.post<ApiResponse<ProviderData>>('/admin/ai-manager', data),

  update: (provider: string, data: Partial<AiProvider>) =>
    adminApiClient.put<ApiResponse<ProviderData>>(`/admin/ai-manager/${provider}`, data),

  delete: (provider: string) =>
    adminApiClient.delete<ApiResponse<null>>(`/admin/ai-manager/${provider}`),

  testConnection: (provider: string) =>
    adminApiClient.post<ApiResponse<TestData>>(`/admin/ai-manager/${provider}/test`),

  syncDefaults: () =>
    adminApiClient.post<ApiResponse<SyncData>>('/admin/ai-manager/sync'),
}
