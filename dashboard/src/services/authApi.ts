import axios from 'axios'
import { getToken } from '../utils/token'

interface LoginRequest {
  username: string
  password: string
}

/** 前端统一使用的用户信息接口（对内） */
export interface AuthUserInfo {
  uuid: string
  nickname: string | null
  avatar_url: string | null
  role: string
}

// ── Admin API 响应类型（/api/admin/*） ──

interface AdminLoginResponse {
  success: boolean
  message?: string
  data?: {
    token: string
    user: {
      id: string
      username: string
      role: string
    }
  }
}

interface AdminMeResponse {
  success: boolean
  message?: string
  data?: {
    user: {
      id: string
      username: string
      role: string
      status: string
      created_at: string
    }
  }
}

/** 将 Admin API 的用户对象映射为前端统一的 AuthUserInfo */
function mapAdminUser(admin: { id: string; username: string; role: string }): AuthUserInfo {
  return {
    uuid: admin.id,
    nickname: admin.username,
    avatar_url: null,
    role: admin.role,
  }
}

export async function login(data: LoginRequest): Promise<{ access_token: string; refresh_token: string; user: AuthUserInfo }> {
  try {
    const response = await axios.post<AdminLoginResponse>('/api/v1/admin/login', {
      username: data.username,
      password: data.password,
    })

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || '登录失败')
    }
    const { token, user: adminUser } = response.data.data
    return {
      access_token: token,
      refresh_token: '', // Admin auth 使用 24h 有效期 JWT，无需 refresh
      user: mapAdminUser(adminUser),
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      throw new Error(error.response.data.message)
    }
    throw error
  }
}

export async function getMe(): Promise<AuthUserInfo> {
  try {
    const response = await axios.get<AdminMeResponse>('/api/v1/admin/me', {
      headers: { Authorization: `Bearer ${getToken() || ''}` },
    })
    if (!response.data.success || !response.data.data?.user) {
      throw new Error('获取用户信息失败')
    }
    return mapAdminUser(response.data.data.user)
  } catch (error) {
    // 401 is expected during token refresh - only log unexpected errors
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      console.error('[Auth] /api/admin/me 请求失败:', error)
    }
    throw error
  }
}

export async function refreshToken(_token: string): Promise<string> {
  // Admin JWT 有 24h 有效期，无需 refresh。返回原 token 以避免中断流程
  return _token
}
