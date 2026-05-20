import axios from 'axios'

interface LoginRequest {
  username: string
  password: string
}

export interface AuthUserInfo {
  uuid: string
  nickname: string | null
  avatar_url: string | null
  role: string
}

interface LoginResponse {
  code: number
  message?: string
  data?: {
    access_token: string
    refresh_token: string
    user: AuthUserInfo
  }
}

interface MeResponse {
  code: number
  data?: {
    user: AuthUserInfo
  }
}

export async function login(data: LoginRequest): Promise<{ access_token: string; refresh_token: string; user: AuthUserInfo }> {
  try {
    // 使用独立 axios 实例（不走 adminApiClient 的 /admin 前缀）
    const response = await axios.post<LoginResponse>('/api/auth/login', {
      credential: data.username,
      password: data.password,
    })

    if (!response.data.data) {
      throw new Error(response.data.message || '登录失败')
    }
    return response.data.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      throw new Error(error.response.data.message)
    }
    throw error
  }
}

export async function getMe(): Promise<AuthUserInfo> {
  try {
    const response = await axios.get<MeResponse>('/api/auth/me', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
    if (!response.data.data?.user) {
      throw new Error('获取用户信息失败')
    }
    return response.data.data.user
  } catch (error) {
    console.error('[Auth] /api/auth/me 请求失败:', error)
    throw error
  }
}

export async function refreshToken(token: string): Promise<string> {
  const response = await axios.post<LoginResponse>('/api/auth/refresh', { refresh_token: token })
  if (!response.data.data?.access_token) {
    throw new Error('刷新失败')
  }
  return response.data.data.access_token
}
