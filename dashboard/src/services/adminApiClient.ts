/**
 * Admin API 专用 axios 实例
 * 用于调用 Dashboard Admin API (端口 3001) 的所有接口
 *
 * 所有环境均使用相对路径 /api：
 * - 开发模式：Vite dev server 代理 /api/admin → localhost:3001
 * - 生产模式：Nginx 代理 /api/admin/* → Admin API (3001)
 * 同源请求，无需 CORS 配置
 */
import axios from 'axios'
import { getToken, removeToken } from '../utils/token'
import { message } from 'antd'

const ADMIN_API_BASE_URL = '/api'

const adminApiClient = axios.create({
  baseURL: ADMIN_API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor — 附加 token
adminApiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — 401 处理
adminApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 401:
          removeToken()
          message.error(data?.message || '登录已过期，请重新登录')
          if (window.location.pathname !== '/login') {
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
          }
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

export default adminApiClient
