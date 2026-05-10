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
        useAuthStore.getState().logout()
        Taro.navigateTo({ url: '/pages/profile/index' })
        throw new Error('登录已过期，请重新登录')
      }

      return res.data as T
    } catch (err: unknown) {
      const error = err as { errMsg?: string }
      if (error.errMsg?.includes('timeout')) {
        throw new Error('请求超时，请检查网络')
      }
      if (error.errMsg?.includes('fail')) {
        throw new Error('网络连接失败，请稍后重试')
      }
      throw err
    }
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>({ method: 'GET', url, data: params })
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