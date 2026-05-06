import adminApiClient from './adminApiClient'

interface LoginRequest {
  username: string
  password: string
}

export interface AdminUserInfo {
  id: number
  username: string
  role: string
}

interface LoginSuccessResponse {
  success: true
  data: {
    token: string
    user: AdminUserInfo
  }
}

interface LoginErrorResponse {
  success: false
  message: string
}

type LoginResponse = LoginSuccessResponse | LoginErrorResponse

interface GetMeResponse {
  success: true
  message?: string
  data: {
    user: AdminUserInfo & { status: string; createdAt: string }
  }
}

export async function login(data: LoginRequest): Promise<LoginSuccessResponse['data']> {
  const response = await adminApiClient.post<LoginResponse>('/admin/login', data)
  if (!response.data.success) {
    throw new Error(response.data.message)
  }
  return response.data.data
}

export async function getMe(): Promise<AdminUserInfo> {
  try {
    const response = await adminApiClient.get<GetMeResponse>('/admin/me')
    if (!response.data.success) {
      throw new Error(response.data.message || '获取用户信息失败')
    }
    return response.data.data.user
  } catch (error) {
    // axios 错误已在 adminApiClient 拦截器中处理（401/500/网络错误）
    // 这里只做日志记录，不重复弹窗
    console.error('[Auth] /admin/me 请求失败:', error)
    throw error
  }
}
