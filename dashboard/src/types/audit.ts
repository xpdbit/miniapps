export interface AuditLog {
  id: number
  adminId: number
  action: string
  targetType: string | null
  targetId: string | null
  details: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}
