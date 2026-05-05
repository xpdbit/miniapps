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
  const response = await adminApiClient.get<GetMeResponse>('/admin/me')
  if (!response.data.success) {
    throw new Error('获取用户信息失败')
  }
  return response.data.data.user
}
