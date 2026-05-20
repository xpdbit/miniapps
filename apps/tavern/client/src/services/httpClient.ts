import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/constants'
import { useAuthStore } from '@/stores/authStore'

export class HttpClient {
  private baseUrl: string
  private timeout: number

  constructor(baseUrl: string = API_BASE_URL, timeout: number = 30000) {
    this.baseUrl = baseUrl
    this.timeout = timeout
  }

  private getToken(): string | null {
    try {
      return Taro.getStorageSync('tavern_token') || null
    } catch {
      return null
    }
  }

  async request<T>(config: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    url: string
    data?: unknown
    isSSE?: boolean
    customTimeout?: number
  }): Promise<T> {
    const token = this.getToken()
    const header: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }

    try {
      const res = await Taro.request({
        url: `${this.baseUrl}${config.url}`,
        method: config.method,
        data: config.data,
        header,
        timeout: config.customTimeout || this.timeout,
        enableChunked: config.isSSE || false,
      })

      if (res.statusCode === 401) {
        const auth = useAuthStore.getState()
        const hadToken = !!auth.token
        auth.logout()
        // 初始化期间 401（旧 token 失效）→ 不重定向，由 initialize() 处理重登录
        if (auth.initialized) {
          Taro.switchTab({ url: '/pages/profile/index' })
        }
        throw new Error(hadToken ? '登录已过期，请重新登录' : '请先登录')
      }

      return res.data as T
    } catch (err: unknown) {
      // 统一处理所有网络错误，提供友好提示
      // 始终返回友好错误消息，绝不泄露原始 TypeError/网络错误到控制台
      const error = err as { errMsg?: string; message?: string }
      const errMsg = error.errMsg || error.message || ''
      if (errMsg.includes('timeout') || errMsg.includes('超时')) {
        throw new Error('请求超时，请检查网络')
      }
      if (errMsg.includes('fail') || errMsg.includes('fetch') || errMsg.includes('Failed to fetch')) {
        throw new Error('网络连接失败，请检查服务器状态或网络设置')
      }
      // 兜底：任何未匹配的网络错误也转为友好消息
      if (errMsg) {
        throw new Error('网络请求失败，请稍后重试')
      }
      throw err
    }
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    // 过滤掉 undefined 和空字符串参数，避免被序列化为 "undefined" 字符串
    const cleaned = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([, v]) => v !== undefined && v !== '' && v !== null,
          ),
        )
      : undefined
    return this.request<T>({ method: 'GET', url, data: cleaned })
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    return this.request<T>({ method: 'POST', url, data })
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    return this.request<T>({ method: 'PUT', url, data })
  }

  async delete<T>(url: string): Promise<T> {
    return this.request<T>({ method: 'DELETE', url })
  }
}

export const httpClient = new HttpClient()