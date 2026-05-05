export type AdminRole = 'super_admin' | 'admin' | 'viewer'
export type AdminStatus = 'active' | 'disabled'

export interface AdminUser {
  id: number
  username: string
  passwordHash: string
  role: AdminRole
  status: AdminStatus
  createdAt: string
  updatedAt: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: AdminUser
}
