import axios from 'axios'
import { getToken } from '../utils/token'
import { message } from 'antd'

const apiClient = axios.create({
  timeout: 30000, // 30s
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor - dynamically set baseURL + token
apiClient.interceptors.request.use((config) => {
  // Get baseURL from sessionStorage directly (avoid Zustand import in non-React context)
  try {
    const saved = sessionStorage.getItem('currentProject')
    if (saved) {
      const project = JSON.parse(saved)
      if (project.apiBaseUrl) {
        config.baseURL = project.apiBaseUrl
      }
    }
  } catch {
    // ignore parse errors
  }

  if (!config.baseURL) {
    config.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
  }

  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor - error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 401:
          // 注意：不调用 removeToken()
          // apiClient 的 token 是 admin token，由 adminApiClient 管理其生命周期
          // 主 Server（3000）返回 401 是因为 admin token 无法通过其认证中间件验证
          // 所以这里不应该弹窗或跳转登录页，静默忽略即可
          break
        case 403:
          message.error('没有操作权限')
          break
        case 500:
          message.error(data?.message || '服务器内部错误')
          break
        default:
          message.error(data?.message || `请求失败 (${status})`)
      }
    } else if (error.request) {
      message.error('网络连接失败，请检查网络')
    }
    return Promise.reject(error)
  },
)

export default apiClient
